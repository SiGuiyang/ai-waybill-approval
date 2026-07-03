// ============================================================
// 状态机 - 工单状态流转逻辑
// ============================================================
import { APPROVAL_THRESHOLDS, TIMEOUT_CONFIG, RESUBMIT_CONFIG } from "./config";
import { prisma } from "./prisma";

// 有效状态转换映射
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["level1_approving", "level2_approving", "closed"],
  level1_approving: ["level2_approving", "executing", "rejected", "closed"],
  level2_approving: ["executing", "rejected", "closed"],
  executing: ["completed", "closed"],
  rejected: ["pending", "closed"], // 可重提或关闭
  completed: [], // 终态
  closed: [], // 终态
  force_released: [], // 终态
};

// 校验状态转换是否合法
export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// 判断是否需要二级审批
export function requiresLevel2Approval(amount: number): boolean {
  return amount >= APPROVAL_THRESHOLDS.level2RequiredAmount;
}

// 判断严重度
export function determineSeverity(amount: number): string {
  if (amount >= APPROVAL_THRESHOLDS.criticalAmount) return "critical";
  if (amount >= APPROVAL_THRESHOLDS.seriousAmount) return "serious";
  return "normal";
}

// 计算超时时间
export function calculateOverdueTime(status: string, createdAt: Date): Date {
  const hours =
    status === "level1_approving"
      ? TIMEOUT_CONFIG.level1ApprovalHours
      : status === "level2_approving"
        ? TIMEOUT_CONFIG.level2ApprovalHours
        : TIMEOUT_CONFIG.qcHoldHours;

  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

// 获取下一步状态（审批通过时）
export function getNextStatusOnApprove(
  currentStatus: string,
  amount: number,
  isQcTicket: boolean
): string {
  if (currentStatus === "pending") {
    // 品控工单强制升级二级审批是通过扫描批次状态机触发的
    // 但正常流程中，pending → level1_approving
    if (isQcTicket && requiresLevel2Approval(amount)) {
      return "level2_approving";
    }
    return requiresLevel2Approval(amount) ? "level1_approving" : "level1_approving";
  }

  if (currentStatus === "level1_approving") {
    return requiresLevel2Approval(amount) ? "level2_approving" : "executing";
  }

  if (currentStatus === "level2_approving") {
    return "executing";
  }

  return "completed";
}

// 获取审批层级
export function getApprovalLevel(status: string): number {
  if (status === "level1_approving") return 1;
  if (status === "level2_approving") return 2;
  return 0;
}

// 处理超时工单
export async function processOverdueTickets() {
  const now = new Date();

  // 查找所有超时未处理的工单
  const overdueTickets = await prisma.ticket.findMany({
    where: {
      isOverdue: true,
      status: { in: ["level1_approving", "level2_approving"] },
    },
  });

  for (const ticket of overdueTickets) {
    const newStatus =
      ticket.status === "level1_approving" ? "level2_approving" : "rejected";

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: newStatus,
        isOverdue: false,
        overdueAt: null,
        // 自动升级时清除当前审批人
        currentApproverId: newStatus === "rejected" ? null : undefined,
      },
    });

    console.log(`[超时处理] 工单 ${ticket.ticketNo} 超时，自动流转至 ${newStatus}`);
  }

  // 检查品控暂扣超时
  const qcOverdueScans = await prisma.scanRecord.findMany({
    where: {
      batchLocked: true,
      ticketId: { not: null },
      ticket: {
        status: { notIn: ["completed", "closed", "force_released"] },
      },
    },
    include: { ticket: true },
  });

  const qcHoldTimeoutMs = TIMEOUT_CONFIG.qcHoldHours * 60 * 60 * 1000;

  for (const scan of qcOverdueScans) {
    const elapsed = now.getTime() - scan.createdAt.getTime();
    if (elapsed > qcHoldTimeoutMs && scan.ticket) {
      // 品控暂扣超时 → 强制升级二级审批
      if (scan.ticket.status === "level1_approving") {
        await prisma.ticket.update({
          where: { id: scan.ticket.id },
          data: {
            status: "level2_approving",
            currentApproverId: null,
          },
        });
        console.log(`[品控暂扣超时] 工单 ${scan.ticket.ticketNo} 强制升级二级审批`);
      }
    }
  }
}

// 检查重提次数并处理
export async function checkResubmitLimit(ticketId: string): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return false;

  if (ticket.resubmitCount >= RESUBMIT_CONFIG.maxRetries) {
    // 超上限处理
    if (RESUBMIT_CONFIG.onExceedAction === "auto_upgrade") {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "level2_approving", currentApproverId: null },
      });
    } else {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "closed" },
      });
    }
    return false;
  }

  return true;
}
