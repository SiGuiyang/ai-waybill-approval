// ============================================================
// 品控规则引擎 - 可配置的规则匹配
// ============================================================
import { prisma } from "./prisma";

export interface ScanInput {
  waybillNo: string;
  sku: string;
  quantityDiffPercent?: number;
  damageLevel?: number;       // 0-5
  specDeviation?: number;     // 偏差百分比
  labelAccuracy?: number;     // 0-100
  batchMatch?: boolean;       // 批次是否匹配
  description?: string;
}

export interface RuleMatchResult {
  pass: boolean;
  ruleName?: string;
  ruleId?: string;
  exceptionSubtype?: string;
  severity?: string;
  description?: string;
  defaultApprovalLevel?: number;
}

// 评估单条规则
function evaluateRule(rule: any, input: ScanInput): boolean {
  const fieldValue = (input as any)[rule.triggerField];
  if (fieldValue === undefined || fieldValue === null) return false;

  switch (rule.triggerOperator) {
    case "gt":
      return fieldValue > rule.triggerValue;
    case "gte":
      return fieldValue >= rule.triggerValue;
    case "lt":
      return fieldValue < rule.triggerValue;
    case "lte":
      return fieldValue <= rule.triggerValue;
    case "eq":
      return fieldValue === rule.triggerValue;
    default:
      return false;
  }
}

// 规则引擎主入口：扫描录入数据 → 判定结果
export async function runQcRules(input: ScanInput): Promise<RuleMatchResult> {
  // 获取所有活跃规则
  const rules = await prisma.qcRule.findMany({
    where: { isActive: true },
    orderBy: { severity: "desc" }, // 严重度高的优先匹配
  });

  let matchedRule: any = null;

  for (const rule of rules) {
    if (evaluateRule(rule, input)) {
      // 取第一个匹配的（已按严重度排序）
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    return { pass: true, description: "品控规则检测通过" };
  }

  return {
    pass: false,
    ruleName: matchedRule.ruleName,
    ruleId: matchedRule.id,
    exceptionSubtype: matchedRule.exceptionSubtype,
    severity: matchedRule.severity,
    description: matchedRule.description || `命中规则: ${matchedRule.ruleName}`,
    defaultApprovalLevel: matchedRule.defaultApprovalLevel,
  };
}

// AI辅助分类（模拟）
export async function aiClassifyException(
  description: string
): Promise<{ exceptionSubtype: string; severity: string; confidence: number } | null> {
  // 如果配置了AI API则调用，否则返回null
  if (!process.env.AI_API_KEY) return null;

  // 模拟AI分类逻辑
  try {
    // 这里是模拟实现，实际应该调用大模型API
    const subtypes: Record<string, string[]> = {
      quantity_mismatch: ["数量", "少", "多", "不对", "差异"],
      appearance_damage: ["破损", "坏", "摔", "裂", "变形"],
      spec_mismatch: ["规格", "尺寸", "型号", "不符"],
      label_error: ["标签", "贴错", "条码"],
      batch_abnormal: ["批次", "过期", "混批"],
    };

    for (const [subtype, keywords] of Object.entries(subtypes)) {
      for (const kw of keywords) {
        if (description.includes(kw)) {
          return {
            exceptionSubtype: subtype,
            severity: "normal",
            confidence: 0.7,
          };
        }
      }
    }

    return { exceptionSubtype: "appearance_damage", severity: "normal", confidence: 0.3 };
  } catch {
    return null; // AI失败不影响主流程
  }
}

// AI辅助审批建议
export async function aiApprovalSuggestion(
  ticketId: string
): Promise<{ suggestion: string; basis: string } | null> {
  if (!process.env.AI_API_KEY) return null;

  try {
    const { prisma } = await import("./prisma");
    // 查找历史相似工单的审批结果
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return null;

    const similarRecords = await prisma.approvalRecord.findMany({
      where: {
        ticket: {
          exceptionSubtype: ticket.exceptionSubtype,
          severity: ticket.severity,
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    if (similarRecords.length === 0) return null;

    const approveCount = similarRecords.filter((r) => r.action === "approve").length;
    const suggestApprove = approveCount >= similarRecords.length / 2;

    return {
      suggestion: suggestApprove ? "建议通过" : "建议驳回",
      basis: `参考了 ${similarRecords.length} 条历史审批记录（${approveCount}/${similarRecords.length} 通过），历史通过率 ${Math.round((approveCount / similarRecords.length) * 100)}%`,
    };
  } catch {
    return null;
  }
}
