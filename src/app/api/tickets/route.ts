import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { validateAndGetWaybill } from "@/lib/v2-client";
import { determineSeverity, calculateOverdueTime } from "@/lib/state-machine";
import { RESUBMIT_CONFIG } from "@/lib/config";
import { aiClassifyException } from "@/lib/rule-engine";

// GET: 获取工单列表（支持筛选和分页）
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const status = searchParams.get("status");
  const exceptionType = searchParams.get("exceptionType");
  const waybillNo = searchParams.get("waybillNo");
  const approverId = searchParams.get("approverId");
  const source = searchParams.get("source");

  const where: any = {};
  if (status) where.status = status;
  if (exceptionType) where.exceptionType = exceptionType;
  if (waybillNo) where.waybillNo = { contains: waybillNo };
  if (approverId) where.currentApproverId = approverId;
  if (source) where.source = source;

  try {
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          reporter: { select: { displayName: true } },
          waybill: { select: { senderName: true, receiverName: true, declaredAmount: true } },
          _count: { select: { approvalRecords: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Get tickets error:", error);
    return NextResponse.json({ error: "获取工单列表失败" }, { status: 500 });
  }
}

// POST: 创建异常工单（手工上报）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  const warehouseId = (session.user as any).warehouseId;

  try {
    const body = await req.json();
    const { waybillNo, exceptionType, exceptionSubtype, exceptionDesc } = body;

    if (!waybillNo || !exceptionSubtype || !exceptionDesc) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 1. 实时校验运单是否存在（调用V2接口）
    const v2Result = await validateAndGetWaybill(waybillNo);
    if (!v2Result.success) {
      return NextResponse.json({
        error: "运单不存在或V2服务不可用",
        detail: v2Result.error,
      }, { status: 400 });
    }

    // 2. 更新/创建本地快照
    const v2Data = v2Result.data;
    let waybillSnapshot = await prisma.waybillSnapshot.findUnique({ where: { waybillNo } });
    if (waybillSnapshot) {
      waybillSnapshot = await prisma.waybillSnapshot.update({
        where: { waybillNo },
        data: {
          declaredAmount: v2Data?.declaredAmount || waybillSnapshot.declaredAmount,
          v2Status: v2Data?.status || waybillSnapshot.v2Status,
          syncedAt: new Date(),
          dataSource: "v2_api",
        },
      });
    } else {
      waybillSnapshot = await prisma.waybillSnapshot.create({
        data: {
          waybillNo,
          senderName: v2Data?.senderName || "",
          senderPhone: v2Data?.senderPhone || "",
          senderAddress: v2Data?.senderAddress || "",
          receiverName: v2Data?.receiverName || "",
          receiverPhone: v2Data?.receiverPhone || "",
          receiverAddress: v2Data?.receiverAddress || "",
          declaredAmount: v2Data?.declaredAmount || 0,
          skuInfo: JSON.stringify(v2Data?.skuInfo || []),
          v2Status: v2Data?.status || "unknown",
          warehouseId: v2Data?.warehouseId || warehouseId,
          syncedAt: new Date(),
          dataSource: "v2_api",
        },
      });
    }

    // 3. 检查是否存在未关闭的同类型工单
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        waybillNo,
        exceptionSubtype,
        exceptionType,
        status: { notIn: ["completed", "closed", "force_released"] },
      },
    });
    if (existingTicket) {
      return NextResponse.json({
        error: `该运单已存在未关闭的同类型异常工单（${existingTicket.ticketNo}，状态：${existingTicket.status}）`,
        existingTicketId: existingTicket.id,
      }, { status: 409 });
    }

    // 4. AI 辅助分类（可选）
    let aiSuggestion = null;
    try {
      aiSuggestion = await aiClassifyException(exceptionDesc);
    } catch { /* AI 失败不阻塞 */ }

    // 5. 创建工单
    const severity = determineSeverity(waybillSnapshot.declaredAmount);
    const ticketNo = `TK-${Date.now()}-${uuid().substring(0, 6)}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNo,
        waybillNo,
        waybillId: waybillSnapshot.id,
        exceptionType: exceptionType || "logistics",
        exceptionSubtype,
        exceptionDesc,
        declaredAmount: waybillSnapshot.declaredAmount,
        severity,
        source: "manual_report",
        status: "pending",
        reporterId: userId,
        maxResubmit: RESUBMIT_CONFIG.maxRetries,
      },
    });

    return NextResponse.json({
      ticket,
      aiSuggestion: aiSuggestion
        ? { ...aiSuggestion, note: "AI 建议，需人工确认" }
        : null,
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json({ error: "创建工单失败" }, { status: 500 });
  }
}
