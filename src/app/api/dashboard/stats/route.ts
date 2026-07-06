import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET: 获取仪表盘统计数据
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }


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
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "pending" } }),
      prisma.ticket.count({
        where: {
          status: { in: ["level1_approving", "level2_approving"] },
        },
      }),
      prisma.ticket.count({
        where: { isOverdue: true },
      }),
      prisma.ticket.count({
        where: {
          completedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.ticket.count({
        where: { source: "scan_trigger", status: "pending" },
      }),
      prisma.ticket.findMany({
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
