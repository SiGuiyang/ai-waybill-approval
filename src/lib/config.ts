// ============================================================
// 系统配置常量 - 对应《需求理解与假设说明》中的所有可配置项
// ============================================================

// 分级审批金额阈值（可配置）
export const APPROVAL_THRESHOLDS = {
  // 金额 >= 此值需要二级审批
  level2RequiredAmount: 500,
  // 金额 >= 此值为严重级别
  seriousAmount: 1000,
  // 金额 >= 此值为危险级别
  criticalAmount: 5000,
};

// 超时时长（小时）
export const TIMEOUT_CONFIG = {
  // 一级审批超时：3个工作日（按24*3=72h）
  level1ApprovalHours: 72,
  // 二级审批超时：2个工作日（按24*2=48h）
  level2ApprovalHours: 48,
  // 品控暂扣超时：4小时（远短于审批，货物压仓成本高）
  qcHoldHours: 4,
};

// 重提次数上限
export const RESUBMIT_CONFIG = {
  maxRetries: 3,
  // 超过上限后的处理：auto_upgrade（自动升级）| auto_close（自动关闭）
  onExceedAction: "auto_upgrade" as const,
};

// 物流异常类型 → 下游动作映射
export const LOGISTICS_ACTIONS: Record<string, {
  label: string;
  compensate: boolean;
  compensateDirection: string;
  reship: boolean;
  returnToWarehouse: boolean;
  rollbackInventory: boolean;
}> = {
  lost: {
    label: "丢件",
    compensate: true,
    compensateDirection: "customer_compensation",
    reship: true,
    returnToWarehouse: false,
    rollbackInventory: true,
  },
  damaged: {
    label: "破损",
    compensate: true,
    compensateDirection: "customer_compensation",
    reship: true,
    returnToWarehouse: true,
    rollbackInventory: true,
  },
  rejected: {
    label: "客户拒收",
    compensate: false,
    compensateDirection: "customer_compensation",
    reship: false,
    returnToWarehouse: true,
    rollbackInventory: false,
  },
  timeout: {
    label: "超时未签收",
    compensate: true,
    compensateDirection: "customer_compensation",
    reship: false,
    returnToWarehouse: false,
    rollbackInventory: false,
  },
  wrong_address: {
    label: "收货地址错误",
    compensate: false,
    compensateDirection: "customer_compensation",
    reship: true,
    returnToWarehouse: true,
    rollbackInventory: false,
  },
};

// 品控异常类型 → 下游动作映射
export const QC_ACTIONS: Record<string, {
  label: string;
  compensate: boolean;
  compensateDirection: string;
  returnToSupplier: boolean;
  repurchase: boolean;
  downgrade: boolean;
  release: boolean;
}> = {
  quantity_mismatch: {
    label: "数量不符",
    compensate: true,
    compensateDirection: "supplier_recovery",
    returnToSupplier: true,
    repurchase: true,
    downgrade: false,
    release: false,
  },
  appearance_damage: {
    label: "外观破损",
    compensate: true,
    compensateDirection: "supplier_recovery",
    returnToSupplier: true,
    repurchase: true,
    downgrade: true,
    release: false,
  },
  spec_mismatch: {
    label: "规格不符",
    compensate: true,
    compensateDirection: "supplier_recovery",
    returnToSupplier: true,
    repurchase: true,
    downgrade: false,
    release: false,
  },
  label_error: {
    label: "标签错误",
    compensate: false,
    compensateDirection: "supplier_recovery",
    returnToSupplier: false,
    repurchase: false,
    downgrade: false,
    release: true,
  },
  batch_abnormal: {
    label: "批次异常",
    compensate: true,
    compensateDirection: "supplier_recovery",
    returnToSupplier: true,
    repurchase: true,
    downgrade: false,
    release: false,
  },
};

// 工单状态枚举
export const TICKET_STATUS = {
  pending: "待审批",
  level1_approving: "一级审批中",
  level2_approving: "二级审批中",
  executing: "执行中",
  completed: "已完成",
  rejected: "已驳回",
  closed: "已关闭",
  force_released: "已快速放行",
} as const;

// 用户角色枚举
export const USER_ROLES = {
  reporter: "上报人",
  level1_approver: "一级审批人",
  level2_approver: "二级审批人",
  qc_supervisor: "品控主管",
  admin: "管理员",
} as const;

// V2 接口配置
export const V2_API_CONFIG = {
  baseUrl: process.env.V2_API_BASE_URL || "https://ai-import.vercel.app",
  appId: process.env.V2_APP_ID || "default-app-id",
  appSecret: process.env.V2_APP_SECRET || "default-app-secret",
  timeout: 10000, // 10秒超时
  retryCount: 2,
  retryDelay: 1000, // 重试间隔1秒
};

// 数据同步策略
export const SYNC_CONFIG = {
  // 同步触发方式：on_demand（按需实时同步）| scheduled（定时批量）
  mode: "on_demand" as const,
  // 定时同步间隔（小时），仅在scheduled模式下生效
  scheduledIntervalHours: 1,
  // 快照数据过期时间（小时），超过此时间的数据标注为"可能过期"
  staleThresholdHours: 24,
};
