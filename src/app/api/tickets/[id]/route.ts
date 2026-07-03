import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET: 获取工单详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        reporter: { select: { displayName: true, username: true } },
        waybill: true,
        approvalRecords: {
          include: { approver: { select: { displayName: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
        compensation: true,
        scans: {
          include: { operator: { select: { displayName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    }

    // 格式化响应
    return NextResponse.json({
      ...ticket,
      waybillInfo: {
        ...ticket.waybill,
        sourceLabel:
          ticket.waybill.dataSource === "v2_api"
            ? `实时获取自 V2（同步于 ${new Date(ticket.waybill.syncedAt).toLocaleString()}）`
            : `使用本地缓存，同步于 ${new Date(ticket.waybill.syncedAt).toLocaleString()}`,
        isStale:
          Date.now() - new Date(ticket.waybill.syncedAt).getTime() >
          24 * 60 * 60 * 1000,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "获取工单详情失败" }, { status: 500 });
  }
}
