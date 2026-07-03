import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkV2Health } from "@/lib/v2-client";

// GET: 接口监控数据
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const [
      recentLogs,
      successRate,
      lastSyncTime,
      totalCalls,
      failedCalls,
      v2Healthy,
    ] = await Promise.all([
      prisma.apiSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.$queryRawUnsafe<[{ rate: number }]>(
        `SELECT
           CASE WHEN COUNT(*) > 0
             THEN CAST(SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
             ELSE 0
           END as rate
         FROM api_sync_logs`
      ).then((r) => r[0]?.rate || 0),
      prisma.apiSyncLog.findFirst({
        where: { isSuccess: true },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.apiSyncLog.count(),
      prisma.apiSyncLog.count({ where: { isSuccess: false } }),
      checkV2Health(),
    ]);

    return NextResponse.json({
      recentLogs,
      stats: {
        successRate: Math.round(successRate * 100),
        totalCalls,
        failedCalls,
        lastSyncTime: lastSyncTime?.createdAt || null,
        v2Healthy,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "获取监控数据失败" }, { status: 500 });
  }
}
