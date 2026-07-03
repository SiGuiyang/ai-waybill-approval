import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET: 获取仪表盘统计数据
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  const warehouseId = (session.user as any).warehouseId;

  // 构建仓库过滤条件（多租户）
  const warehouseFilter = warehouseId ? { waybill: { warehouseId } } : {};

  try {
    const [
      totalTickets,
      pendingTickets,
      approvingTickets,
      overdueTickets,
      completedToday,
      qcPendingTickets,
      recentTickets,
      recentLogs,
    ] = await Promise.all([
      prisma.ticket.count({ where: warehouseFilter }),
      prisma.ticket.count({ where: { ...warehouseFilter, status: "pending" } }),
      prisma.ticket.count({
        where: {
          ...warehouseFilter,
          status: { in: ["level1_approving", "level2_approving"] },
        },
      }),
      prisma.ticket.count({
        where: { ...warehouseFilter, isOverdue: true },
      }),
      prisma.ticket.count({
        where: {
          ...warehouseFilter,
          completedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.ticket.count({
        where: { ...warehouseFilter, source: "scan_trigger", status: "pending" },
      }),
      prisma.ticket.findMany({
        where: warehouseFilter,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          ticketNo: true,
          waybillNo: true,
          exceptionSubtype: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.apiSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          apiName: true,
          isSuccess: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalTickets,
      pendingTickets,
      approvingTickets,
      overdueTickets,
      completedToday,
      qcPendingTickets,
      recentTickets,
      recentLogs,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
