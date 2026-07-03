import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkV2Health } from "@/lib/v2-client";

// GET: 接口监控数据
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10")));

  try {
    const [
      logs,
      totalLogs,
      successRate,
      lastSyncTime,
      totalCalls,
      failedCalls,
      v2Healthy,
    ] = await Promise.all([
      prisma.apiSyncLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.apiSyncLog.count(),
      prisma.$queryRawUnsafe<[{ rate: number }]>(
        `SELECT
           CASE WHEN COUNT(*) > 0
             THEN SUM(CASE WHEN "isSuccess" IS TRUE THEN 1 ELSE 0 END)::float / COUNT(*)
             ELSE 0
           END as rate
         FROM "api_sync_logs"`
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
      logs,
      pagination: {
        page,
        pageSize,
        total: totalLogs,
        totalPages: Math.ceil(totalLogs / pageSize),
      },
      stats: {
        successRate: Math.round(successRate * 100),
        totalCalls,
        failedCalls,
        lastSyncTime: lastSyncTime?.createdAt || null,
        v2Healthy,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取监控数据失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
