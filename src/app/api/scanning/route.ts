import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { validateSkuForWaybill, validateAndGetWaybill } from "@/lib/v2-client";
import { runQcRules, aiClassifyException } from "@/lib/rule-engine";
import { TIMEOUT_CONFIG } from "@/lib/config";

// POST: 扫描录入
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = (session.user as any).id;
  const userName = session.user.name || "操作人";

  try {
    const body = await req.json();
    const {
      waybillNo,
      sku,
      quantityDiffPercent,
      damageLevel,
      specDeviation,
      labelAccuracy,
      batchMatch,
      description,
      deviceInfo,
    } = body;

    if (!waybillNo || !sku) {
      return NextResponse.json({ error: "缺少运单号或SKU" }, { status: 400 });
    }

    // 1. 校验SKU归属（调用V2接口）
    const skuResult = await validateSkuForWaybill(waybillNo, sku);
    if (!skuResult.success || skuResult.error) {
      return NextResponse.json({ error: "SKU不属于该运单或V2服务不可用" }, { status: 400 });
    }

    // 2. 确保运单快照存在
    let waybillSnapshot = await prisma.waybillSnapshot.findUnique({ where: { waybillNo } });
    if (!waybillSnapshot) {
      const v2Result = await validateAndGetWaybill(waybillNo);
      if (v2Result.success && v2Result.data) {
        waybillSnapshot = await prisma.waybillSnapshot.create({
          data: {
            waybillNo,
            senderName: v2Result.data.senderName || "",
            senderPhone: v2Result.data.senderPhone || "",
            senderAddress: v2Result.data.senderAddress || "",
            receiverName: v2Result.data.receiverName || "",
            receiverPhone: v2Result.data.receiverPhone || "",
            receiverAddress: v2Result.data.receiverAddress || "",
            declaredAmount: v2Result.data.declaredAmount || 0,
            skuInfo: JSON.stringify(v2Result.data.skuInfo || []),
            v2Status: v2Result.data.status || "unknown",
            syncedAt: new Date(),
            dataSource: "v2_api",
          },
        });
      } else {
        return NextResponse.json({ error: "运单不存在或V2服务不可用" }, { status: 400 });
      }
    }

    // 3. 品控规则引擎检测
    const ruleResult = await runQcRules({
      waybillNo,
      sku,
      quantityDiffPercent,
      damageLevel,
      specDeviation,
      labelAccuracy,
      batchMatch,
      description,
    });

    // 4. AI辅助判断
    let aiSuggestion = null;
    try {
      aiSuggestion = await aiClassifyException(ruleResult.description || "");
    } catch {}

    // 5. 通过 - 记录扫描并放行
    if (ruleResult.pass) {
      const scanRecord = await prisma.scanRecord.create({
        data: {
          waybillNo,
          waybillId: waybillSnapshot.id,
          sku,
          operatorId: userId,
          operatorName: userName,
          deviceInfo,
          qcResult: "pass",
          batchLocked: false,
        },
      });

      return NextResponse.json({
        success: true,
        pass: true,
        scanRecord,
        message: "品控检测通过，正常出库",
      });
    }

    // 6. 异常 - 检查是否已存在未关闭品控工单（幂等性）
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        waybillNo,
        exceptionType: "quality_control",
        source: "scan_trigger",
        status: { notIn: ["completed", "closed", "force_released"] },
      },
    });

    if (existingTicket) {
      // 重复扫描：追加扫描记录，不创建新工单
      const scanRecord = await prisma.scanRecord.create({
        data: {
          waybillNo,
          waybillId: waybillSnapshot.id,
          sku,
          operatorId: userId,
          operatorName: userName,
          deviceInfo,
          qcResult: "fail",
          exceptionDesc: ruleResult.description,
          ruleHitId: ruleResult.ruleId,
          batchLocked: true,
          ticketId: existingTicket.id,
          isDuplicate: true,
          aiSuggestion: aiSuggestion ? JSON.stringify(aiSuggestion) : null,
        },
      });

      return NextResponse.json({
        success: true,
        pass: false,
        isDuplicate: true,
        existingTicketId: existingTicket.id,
        scanRecord,
        message: `该批次已存在未关闭品控工单 ${existingTicket.ticketNo}，已追加扫描记录`,
      });
    }

    // 7. 创建品控异常工单
    const ticketNo = `QC-${Date.now()}-${uuid().substring(0, 6)}`;
    const severity = ruleResult.severity || "normal";
    const approvalLevel = ruleResult.defaultApprovalLevel || 1;

    const [ticket, scanRecord] = await prisma.$transaction([
      prisma.ticket.create({
        data: {
          ticketNo,
          waybillNo,
          waybillId: waybillSnapshot.id,
          exceptionType: "quality_control",
          exceptionSubtype: ruleResult.exceptionSubtype || "batch_abnormal",
          exceptionDesc: ruleResult.description || "品控检测异常",
          declaredAmount: waybillSnapshot.declaredAmount,
          severity,
          source: "scan_trigger",
          status: "pending",
          reporterId: userId,
        },
      }),
      prisma.scanRecord.create({
        data: {
          waybillNo,
          waybillId: waybillSnapshot.id,
          sku,
          operatorId: userId,
          operatorName: userName,
          deviceInfo,
          qcResult: "fail",
          exceptionDesc: ruleResult.description,
          ruleHitId: ruleResult.ruleId,
          batchLocked: true,
          ticketId: "", // 事务后更新
          aiSuggestion: aiSuggestion ? JSON.stringify(aiSuggestion) : null,
        },
      }),
    ]);

    // 更新 scanRecord 的 ticketId
    await prisma.scanRecord.update({
      where: { id: scanRecord.id },
      data: { ticketId: ticket.id },
    });

    // 锁定库存
    await prisma.inventory.upsert({
      where: { sku },
      create: {
        waybillNo,
        sku,
        productName: sku,
        quantity: 100,
        lockedQuantity: 1,
        status: "locked",
      },
      update: {
        lockedQuantity: { increment: 1 },
        status: "locked",
      },
    });

    return NextResponse.json({
      success: true,
      pass: false,
      ticket,
      scanRecord: { ...scanRecord, ticketId: ticket.id },
      ruleResult,
      aiSuggestion: aiSuggestion
        ? { ...aiSuggestion, note: "AI 建议，需人工确认" }
        : null,
      message: `品控检测异常：${ruleResult.description}，已创建工单 ${ticketNo}`,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: "扫描操作失败" }, { status: 500 });
  }
}

// GET: 获取扫描记录列表
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const waybillNo = searchParams.get("waybillNo");
  const qcResult = searchParams.get("qcResult");

  const where: any = {};
  if (waybillNo) where.waybillNo = { contains: waybillNo };
  if (qcResult) where.qcResult = qcResult;

  try {
    const [records, total] = await Promise.all([
      prisma.scanRecord.findMany({
        where,
        include: {
          ticket: { select: { ticketNo: true, status: true } },
          operator: { select: { displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scanRecord.count({ where }),
    ]);

    return NextResponse.json({
      records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return NextResponse.json({ error: "获取扫描记录失败" }, { status: 500 });
  }
}
