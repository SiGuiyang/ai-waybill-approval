import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 开始初始化数据...");

  // 1. 创建用户
  const passwordHash = await bcrypt.hash("123456", 10);

  const users = [
    { username: "reporter", displayName: "上报人张三", role: "reporter", warehouseId: "WH-001" },
    { username: "approver1", displayName: "一级审批李四", role: "level1_approver", warehouseId: "WH-001" },
    { username: "approver2", displayName: "二级审批王五", role: "level2_approver", warehouseId: "WH-001" },
    { username: "qcmaster", displayName: "品控主管赵六", role: "qc_supervisor", warehouseId: "WH-001" },
    { username: "admin", displayName: "管理员", role: "admin", warehouseId: "WH-001" },
    { username: "reporter2", displayName: "上报人钱七", role: "reporter", warehouseId: "WH-002" },
    { username: "approver3", displayName: "审批人孙八", role: "level2_approver", warehouseId: "WH-002" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  console.log(`✅ 创建了 ${users.length} 个用户`);

  // 2. 创建品控规则
  const rules = [
    {
      ruleName: "数量差异超10%",
      exceptionSubtype: "quantity_mismatch",
      triggerField: "quantityDiffPercent",
      triggerOperator: "gt",
      triggerValue: 10,
      severity: "serious",
      autoCreateTicket: true,
      defaultApprovalLevel: 1,
    },
    {
      ruleName: "破损等级≥2级",
      exceptionSubtype: "appearance_damage",
      triggerField: "damageLevel",
      triggerOperator: "gte",
      triggerValue: 2,
      severity: "serious",
      autoCreateTicket: true,
      defaultApprovalLevel: 1,
    },
    {
      ruleName: "破损等级≥3级（严重）",
      exceptionSubtype: "appearance_damage",
      triggerField: "damageLevel",
      triggerOperator: "gte",
      triggerValue: 3,
      severity: "critical",
      autoCreateTicket: true,
      defaultApprovalLevel: 2,
    },
    {
      ruleName: "规格偏差超5%",
      exceptionSubtype: "spec_mismatch",
      triggerField: "specDeviation",
      triggerOperator: "gt",
      triggerValue: 5,
      severity: "normal",
      autoCreateTicket: true,
      defaultApprovalLevel: 1,
    },
    {
      ruleName: "标签准确度低于80%",
      exceptionSubtype: "label_error",
      triggerField: "labelAccuracy",
      triggerOperator: "lt",
      triggerValue: 80,
      severity: "normal",
      autoCreateTicket: true,
      defaultApprovalLevel: 1,
    },
    {
      ruleName: "批次不匹配",
      exceptionSubtype: "batch_abnormal",
      triggerField: "batchMatch",
      triggerOperator: "eq",
      triggerValue: 0,
      severity: "serious",
      autoCreateTicket: true,
      defaultApprovalLevel: 2,
    },
  ];

  for (const r of rules) {
    await prisma.qcRule.create({ data: r });
  }
  console.log(`✅ 创建了 ${rules.length} 条品控规则`);

  // 3. 创建运单快照（模拟从V2同步的数据）
  const waybillNos = Array.from({ length: 50 }, (_, i) => {
    const num = String(i + 1).padStart(3, "0");
    return {
      waybillNo: `WB20240101${num}`,
      senderName: `发件人${i + 1}`,
      senderPhone: `1380000${num}`,
      senderAddress: `北京市朝阳区XX路${i + 1}号`,
      receiverName: `收件人${i + 1}`,
      receiverPhone: `1390000${num}`,
      receiverAddress: `上海市浦东新区YY路${i + 1}号`,
      declaredAmount: [100, 250, 500, 800, 1200, 2000, 3500, 6000][i % 8],
      skuInfo: JSON.stringify([{ sku: `SKU-${num}-A`, name: `商品A-${i+1}`, qty: 10 }]),
      v2Status: "in_transit",
      warehouseId: i < 25 ? "WH-001" : "WH-002",
      syncedAt: new Date(),
      dataSource: "v2_api",
    };
  });

  for (const w of waybillNos) {
    await prisma.waybillSnapshot.upsert({
      where: { waybillNo: w.waybillNo },
      update: {},
      create: w,
    });
  }
  console.log(`✅ 创建了 ${waybillNos.length} 个运单快照`);

  // 4. 创建200+工单（覆盖不同状态、类型、来源）
  const reporter = await prisma.user.findUnique({ where: { username: "reporter" } });
  const reporter2 = await prisma.user.findUnique({ where: { username: "reporter2" } });
  const approver1 = await prisma.user.findUnique({ where: { username: "approver1" } });

  const subtypes = [
    { type: "logistics", subtype: "lost", desc: "快件在运输途中丢失，客户未收到件", amount: 350 },
    { type: "logistics", subtype: "damaged", desc: "外包装严重破损，内部商品受损", amount: 500 },
    { type: "logistics", subtype: "rejected", desc: "客户当场拒收快件", amount: 200 },
    { type: "logistics", subtype: "timeout", desc: "快件超时72小时未签收", amount: 800 },
    { type: "logistics", subtype: "wrong_address", desc: "收货地址填写错误，快件无法投递", amount: 100 },
    { type: "quality_control", subtype: "quantity_mismatch", desc: "出库扫描发现数量与运单不符，短少2件", amount: 300 },
    { type: "quality_control", subtype: "appearance_damage", desc: "品控扫描发现外箱有压痕，内部可能损坏", amount: 450 },
    { type: "quality_control", subtype: "spec_mismatch", desc: "扫描发现商品规格与运单描述不一致", amount: 600 },
    { type: "quality_control", subtype: "label_error", desc: "标签粘贴错误，运单信息与实物不匹配", amount: 150 },
    { type: "quality_control", subtype: "batch_abnormal", desc: "批次号与采购单记录不一致", amount: 1200 },
  ];

  const statuses = ["pending", "level1_approving", "level2_approving", "executing", "completed", "rejected", "closed", "force_released"];
  const statusWeights = [0.1, 0.15, 0.1, 0.1, 0.35, 0.1, 0.05, 0.05];

  // Clear existing tickets for clean seed
  await prisma.compensation.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.inventoryChange.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.scanRecord.deleteMany();
  await prisma.ticket.deleteMany();

  const tickets: any[] = [];
  for (let i = 0; i < 220; i++) {
    const sub = subtypes[i % subtypes.length];
    const wbIdx = i % 50;
    const waybill = waybillNos[wbIdx];

    // Weighted random status
    let s = 0;
    const r = Math.random();
    for (let j = 0; j < statusWeights.length; j++) {
      s += statusWeights[j];
      if (r <= s) { break; }
    }
    const status = statuses[Math.floor(r * statuses.length)];

    const isOverdue = ["level1_approving", "level2_approving"].includes(status) && Math.random() < 0.15;
    const source = sub.type === "quality_control" ? "scan_trigger" : "manual_report";
    const completedAt = ["completed", "force_released"].includes(status)
      ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      : null;

    const ticketNo = source === "scan_trigger"
      ? `QC-${1700000000000 + i}-${uuid().substring(0, 4)}`
      : `TK-${1700000000000 + i}-${uuid().substring(0, 4)}`;

    tickets.push({
      ticketNo,
      waybillNo: waybill.waybillNo,
      waybillId: "", // Will be set after creation
      exceptionType: sub.type,
      exceptionSubtype: sub.subtype,
      exceptionDesc: sub.desc,
      declaredAmount: waybill.declaredAmount,
      severity: waybill.declaredAmount >= 5000 ? "critical" : waybill.declaredAmount >= 1000 ? "serious" : "normal",
      source,
      status,
      reporterId: (i % 2 === 0 ? reporter : reporter2)!.id,
      isOverdue,
      overdueAt: isOverdue ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
      completedAt,
      resubmitCount: status === "rejected" ? Math.floor(Math.random() * 3) : 0,
    });
  }

  const snapshotMap = new Map<string, string>();
  for (const snap of await prisma.waybillSnapshot.findMany()) {
    snapshotMap.set(snap.waybillNo, snap.id);
  }

  for (const t of tickets) {
    t.waybillId = snapshotMap.get(t.waybillNo) || "";
  }

  await prisma.ticket.createMany({ data: tickets });
  console.log(`✅ 创建了 ${tickets.length} 个工单（覆盖所有状态和类型）`);

  // 5. 创建一些审批记录（已完成状态的工单）
  const completedTickets = await prisma.ticket.findMany({
    where: { status: "completed" },
    take: 50,
  });

  for (const ticket of completedTickets) {
    // Level 1 approval
    const isQc = ticket.exceptionType === "quality_control";
    const needL2 = ticket.declaredAmount >= 500 || isQc;

    await prisma.approvalRecord.create({
      data: {
        ticketId: ticket.id,
        approverId: approver1!.id,
        approverName: approver1!.displayName,
        level: 1,
        action: "approve",
        opinion: "经核实，异常情况属实，同意处理",
        createdAt: new Date(ticket.completedAt!.getTime() - 2 * 60 * 60 * 1000),
      },
    });

    if (needL2) {
      const approver2 = await prisma.user.findUnique({ where: { username: "approver2" } });
      await prisma.approvalRecord.create({
        data: {
          ticketId: ticket.id,
          approverId: approver2!.id,
          approverName: approver2!.displayName,
          level: 2,
          action: "approve",
          opinion: "同意一级审批意见，批准执行",
          createdAt: new Date(ticket.completedAt!.getTime() - 1 * 60 * 60 * 1000),
        },
      });
    }

    // Create compensation record
    await prisma.compensation.create({
      data: {
        ticketId: ticket.id,
        amount: ticket.declaredAmount,
        direction: ticket.exceptionType === "quality_control" ? "supplier_recovery" : "customer_compensation",
        status: "completed",
        triggeredBy: "seed",
        createdAt: ticket.completedAt!,
      },
    });
  }
  console.log(`✅ 创建了审批记录和赔付记录`);

  // 6. 创建库存数据
  for (const sku of ["SKU-001-A", "SKU-002-A", "SKU-003-A", "SKU-004-A", "SKU-005-A"]) {
    await prisma.inventory.create({
      data: {
        waybillNo: "WB20240101001",
        sku,
        productName: sku,
        quantity: 100,
        lockedQuantity: 0,
        warehouseId: "WH-001",
        status: "available",
      },
    });
  }
  console.log("✅ 创建了库存数据");

  console.log("\n🎉 数据初始化完成！");
  console.log("演示账号（密码均为 123456）：");
  console.log("  - reporter / 123456 （上报人）");
  console.log("  - approver1 / 123456 （一级审批人）");
  console.log("  - approver2 / 123456 （二级审批人）");
  console.log("  - qcmaster / 123456 （品控主管）");
  console.log("  - admin / 123456 （管理员）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
