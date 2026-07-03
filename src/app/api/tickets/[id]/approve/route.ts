import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import {
  isValidTransition,
  getNextStatusOnApprove,
  getApprovalLevel,
  calculateOverdueTime,
  checkResubmitLimit,
} from "@/lib/state-machine";
import { aiApprovalSuggestion } from "@/lib/rule-engine";
import { RESUBMIT_CONFIG } from "@/lib/config";
import { LOGISTICS_ACTIONS, QC_ACTIONS } from "@/lib/config";

// POST: 审批操作（通过/拒绝）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: ticketId } = await params;
  const userId = (session.user as any).id;
  const userName = session.user.name || "";
  const userRole = (session.user as any).role;

  try {
    const body = await req.json();
    const { action, opinion } = body; // action: approve | reject

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "无效的审批动作" }, { status: 400 });
    }

    // 获取当前工单
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    }

    // === 权限边界校验 ===

    // 上报人不能审批自己的工单
    if (ticket.reporterId === userId) {
      return NextResponse.json({ error: "不能审批自己提交的工单" }, { status: 403 });
    }

    // 检查审批层级权限
    const approvalLevel = getApprovalLevel(ticket.status);
    if (approvalLevel === 1 && userRole !== "level1_approver" && userRole !== "admin") {
      return NextResponse.json({ error: "无权进行一级审批" }, { status: 403 });
    }
    if (approvalLevel === 2 && userRole !== "level2_approver" && userRole !== "admin") {
      return NextResponse.json({ error: "无权进行二级审批" }, { status: 403 });
    }

    // === 并发冲突处理：操作令牌 ===
    const operationToken = uuid();
    const existingApproval = await prisma.approvalRecord.findFirst({
      where: {
        ticketId,
        level: approvalLevel,
        action: { in: ["approve", "reject"] },
      },
    });
    if (existingApproval) {
      return NextResponse.json({
        error: "该工单已被处理，请刷新页面",
        conflict: true,
        previousAction: existingApproval.action,
        processedBy: existingApproval.approverName,
      }, { status: 409 });
    }

    // === 执行审批操作 ===
    const isApproved = action === "approve";

    if (isApproved) {
      const nextStatus = getNextStatusOnApprove(
        ticket.status,
        ticket.declaredAmount,
        ticket.exceptionType === "quality_control"
      );

      if (!isValidTransition(ticket.status, nextStatus)) {
        return NextResponse.json({ error: "无效的状态转换" }, { status: 400 });
      }

      // 事务：创建审批记录 + 更新工单状态
      const [approvalRecord] = await prisma.$transaction([
        prisma.approvalRecord.create({
          data: {
            ticketId,
            approverId: userId,
            approverName: userName,
            level: approvalLevel,
            action: "approve",
            opinion,
            operationToken,
          },
        }),
        prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: nextStatus,
            currentApproverId: null,
            isOverdue: false,
            overdueAt: null,
            ...(nextStatus === "completed"
              ? { completedAt: new Date() }
              : {}),
            ...(nextStatus === "executing"
              ? { currentApproverId: null }
              : {}),
          },
        }),
      ]);

      // AI 审批建议（记录但不影响流程）
      let aiSuggestion = null;
      try {
        aiSuggestion = await aiApprovalSuggestion(ticketId);
      } catch {}

      return NextResponse.json({
        approvalRecord,
        aiSuggestion,
        newStatus: nextStatus,
      });
    } else {
      // 拒绝操作
      if (!isValidTransition(ticket.status, "rejected")) {
        return NextResponse.json({ error: "无效的状态转换" }, { status: 400 });
      }

      // 检查重提次数
      const canResubmit = await checkResubmitLimit(ticketId);

      const [approvalRecord] = await prisma.$transaction([
        prisma.approvalRecord.create({
          data: {
            ticketId,
            approverId: userId,
            approverName: userName,
            level: approvalLevel,
            action: "reject",
            opinion,
            operationToken,
          },
        }),
        prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: canResubmit ? "pending" : "closed",
            currentApproverId: null,
            resubmitCount: { increment: 1 },
            isOverdue: false,
            overdueAt: null,
          },
        }),
      ]);

      const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });

      return NextResponse.json({
        approvalRecord,
        newStatus: updatedTicket?.status,
        resubmitCount: updatedTicket?.resubmitCount,
        maxResubmit: updatedTicket?.maxResubmit,
        message: canResubmit
          ? "工单已驳回，可重新提交"
          : `工单已驳回超过${updatedTicket?.maxResubmit}次上限，已自动关闭`,
      });
    }
  } catch (error: any) {
    // 检查是否是唯一约束冲突（幂等性保证）
    if (error?.code === "P2002") {
      return NextResponse.json({
        error: "操作已提交，请勿重复操作",
        duplicate: true,
      }, { status: 409 });
    }
    console.error("Approval error:", error);
    return NextResponse.json({ error: "审批操作失败" }, { status: 500 });
  }
}

// PUT: 重新提交工单
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: ticketId } = await params;
  const body = await req.json();
  const { updatedDesc } = body;

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });

    if (ticket.status !== "pending") {
      return NextResponse.json({ error: "只有待审批状态的工单可以重新提交" }, { status: 400 });
    }

    if (ticket.resubmitCount >= RESUBMIT_CONFIG.maxRetries) {
      return NextResponse.json({ error: "超过重提次数上限" }, { status: 400 });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "level1_approving",
        exceptionDesc: updatedDesc || ticket.exceptionDesc,
        overdueAt: calculateOverdueTime("level1_approving", new Date()),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "重新提交失败" }, { status: 500 });
  }
}
