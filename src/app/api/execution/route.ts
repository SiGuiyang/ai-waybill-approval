import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LOGISTICS_ACTIONS, QC_ACTIONS } from "@/lib/config";

// POST: 执行联动操作（审批通过后触发）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await req.json();
    const { ticketId, executionType } = body;
    // executionType: compensate | reship | return_warehouse | release |
    //                return_supplier | repurchase | downgrade

    if (!ticketId) {
      return NextResponse.json({ error: "缺少工单ID" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { approvalRecords: true, scans: true },
    });

    if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    if (ticket.status !== "executing") {
      return NextResponse.json({ error: "工单不在执行中状态" }, { status: 400 });
    }

    // 获取最新通过的那条审批记录作为触发源
    const lastApproval = [...ticket.approvalRecords]
      .reverse()
      .find((r) => r.action === "approve");

    if (!lastApproval) {
      return NextResponse.json({ error: "找不到审批记录" }, { status: 400 });
    }

    // 获取动作配置
    const isLogistics = ticket.exceptionType === "logistics";
    const actionConfig: any = isLogistics
      ? LOGISTICS_ACTIONS[ticket.exceptionSubtype]
      : QC_ACTIONS[ticket.exceptionSubtype];

    if (!actionConfig) {
      return NextResponse.json({ error: "未找到对应的执行动作配置" }, { status: 400 });
    }

    // 事务保证一致性
    const operations: any[] = [];

    // 1. 处理赔付
    if (actionConfig.compensate) {
      operations.push(
        prisma.compensation.create({
          data: {
            ticketId,
            amount: ticket.declaredAmount,
            direction: actionConfig.compensateDirection,
            status: "pending",
            triggeredBy: lastApproval.id,
          },
        })
      );
    }

    // 2. 处理库存
    for (const scan of ticket.scans) {
      if (actionConfig.returnToSupplier || actionConfig.returnToWarehouse) {
        operations.push(
          prisma.inventoryChange.create({
            data: {
              inventoryId: (await prisma.inventory.findFirst({ where: { sku: scan.sku } }))?.id || "",
              changeType: "return",
              quantity: 1,
              beforeQuantity: 0,
              afterQuantity: 1,
              triggeredBy: lastApproval.id,
              remark: `工单 ${ticket.ticketNo} 退货入库`,
            },
          })
        );
      }
    }

    // 3. 解锁品控暂扣
    if (ticket.exceptionType === "quality_control") {
      operations.push(
        prisma.scanRecord.updateMany({
          where: { ticketId },
          data: { batchLocked: false },
        }),
        ...ticket.scans.map((scan) =>
          prisma.inventory.updateMany({
            where: { sku: scan.sku, lockedQuantity: { gt: 0 } },
            data: {
              lockedQuantity: { decrement: 1 },
              status: "available",
            },
          })
        )
      );
    }

    // 4. 更新工单状态
    operations.push(
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "completed", completedAt: new Date() },
      })
    );

    // 执行事务
    await prisma.$transaction(operations);

    return NextResponse.json({
      success: true,
      message: "执行联动完成",
      action: actionConfig.label,
    });
  } catch (error) {
    console.error("Execution error:", error);
    return NextResponse.json({ error: "执行联动失败" }, { status: 500 });
  }
}

// GET: 获取执行记录列表
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  try {
    const [compensations, inventoryChanges, totalComp, totalInv] = await Promise.all([
      prisma.compensation.findMany({
        include: { ticket: { select: { ticketNo: true, exceptionSubtype: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inventoryChange.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.compensation.count(),
      prisma.inventoryChange.count(),
    ]);

    return NextResponse.json({
      compensations,
      inventoryChanges,
      pagination: {
        page,
        pageSize,
        compensationTotal: totalComp,
        inventoryTotal: totalInv,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "获取执行记录失败" }, { status: 500 });
  }
}
