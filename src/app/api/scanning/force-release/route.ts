import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST: 品控主管快速放行
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userRole = (session.user as any).role;
  const userName = session.user.name || "";

  // 只有品控主管和管理员可以操作
  if (userRole !== "qc_supervisor" && userRole !== "admin") {
    return NextResponse.json({ error: "仅品控主管可执行快速放行操作" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { ticketId, reason } = body;

    if (!ticketId || !reason) {
      return NextResponse.json({ error: "缺少工单ID或复核原因" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { scans: true },
    });

    if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    if (ticket.source !== "scan_trigger") {
      return NextResponse.json({ error: "仅品控工单支持快速放行" }, { status: 400 });
    }
    if (["completed", "closed", "force_released"].includes(ticket.status)) {
      return NextResponse.json({ error: "工单已关闭，无法操作" }, { status: 400 });
    }

    // 事务：更新工单状态 + 解锁批次 + 记录审批
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "force_released", completedAt: new Date() },
      }),
      prisma.scanRecord.updateMany({
        where: { ticketId },
        data: { batchLocked: false },
      }),
      prisma.approvalRecord.create({
        data: {
          ticketId,
          approverId: (session.user as any).id,
          approverName: userName,
          level: 0,
          action: "approve",
          opinion: `【快速放行】${reason}`,
        },
      }),
      // 解锁库存
      ...ticket.scans.map((scan) =>
        prisma.inventory.updateMany({
          where: { sku: scan.sku, lockedQuantity: { gt: 0 } },
          data: {
            lockedQuantity: { decrement: 1 },
            status: "available",
          },
        })
      ),
    ]);

    return NextResponse.json({ success: true, message: "快速放行成功" });
  } catch (error) {
    console.error("Force release error:", error);
    return NextResponse.json({ error: "快速放行失败" }, { status: 500 });
  }
}
