// ============================================================
// 定时任务 - 检查并处理超时工单
// 可通过 Vercel Cron Jobs 或外部调度触发
// ============================================================
import { prisma } from "./prisma";
import { processOverdueTickets } from "./state-machine";
import { TIMEOUT_CONFIG, SYNC_CONFIG } from "./config";

async function checkAndMarkOverdue() {
  console.log("[Cron] 检查超时工单...");

  const now = new Date();

  // 标记超时工单
  const activeTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["level1_approving", "level2_approving"] },
      isOverdue: false,
    },
  });

  for (const ticket of activeTickets) {
    const hours =
      ticket.status === "level1_approving"
        ? TIMEOUT_CONFIG.level1ApprovalHours
        : TIMEOUT_CONFIG.level2ApprovalHours;

    const deadline = new Date(ticket.createdAt.getTime() + hours * 60 * 60 * 1000);

    if (now > deadline) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { isOverdue: true, overdueAt: deadline },
      });
      console.log(`[Cron] 工单 ${ticket.ticketNo} 已标记为超时`);
    }
  }

  // 处理超时工单自动流转
  await processOverdueTickets();
}

// ============ Vercel Cron 模式 ============
// 如果通过 Vercel Cron 触发，直接执行
if (process.env.CRON_TRIGGER === "true") {
  checkAndMarkOverdue()
    .then(() => {
      console.log("[Cron] 超时检查完成");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Cron] 错误:", err);
      process.exit(1);
    });
}

export { checkAndMarkOverdue };
