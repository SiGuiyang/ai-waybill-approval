// ============================================================
// V2 系统接口客户端
// ============================================================
import { createHmac } from "crypto";
import { V2_API_CONFIG } from "./config";

interface V2ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 生成签名：X-Sign = HMAC-SHA256(timestamp + appId, appSecret)
function generateSign(timestamp: string, appId: string, appSecret: string): string {
  return createHmac("sha256", appSecret)
    .update(timestamp + appId)
    .digest("hex");
}

// 构建签名请求头
function buildAuthHeaders(): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const appId = V2_API_CONFIG.appId;
  const appSecret = V2_API_CONFIG.appSecret;
  const sign = generateSign(timestamp, appId, appSecret);

  return {
    "X-App-Id": appId,
    "X-Timestamp": timestamp,
    "X-Sign": sign,
  };
}

// 通用请求函数
async function v2Request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<V2ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), V2_API_CONFIG.timeout);

  const url = `${V2_API_CONFIG.baseUrl}${endpoint}`;

  // 记录开始时间
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      // 记录失败日志
      await logApiCall(endpoint, url, options.body as string, response.status, null, false, `HTTP ${response.status}`, duration);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    await logApiCall(endpoint, url, options.body as string, response.status, JSON.stringify(data).substring(0, 500), true, null, duration);
    return { success: true, data };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const errorMsg = error.name === "AbortError" ? "请求超时" : error.message;
    await logApiCall(endpoint, url, options.body as string, null, null, false, errorMsg, duration);
    return { success: false, error: errorMsg };
  }
}

// 带重试的请求
async function v2RequestWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = V2_API_CONFIG.retryCount
): Promise<V2ApiResponse<T>> {
  let lastError: V2ApiResponse<T> = { success: false, error: "未知错误" };

  for (let i = 0; i <= retries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, V2_API_CONFIG.retryDelay * i));
    }

    const result = await v2Request<T>(endpoint, options);
    if (result.success) return result;
    lastError = result;

    // 非超时错误不重试
    if (result.error !== "请求超时") break;
  }

  return lastError;
}

// 记录接口调用日志
async function logApiCall(
  apiName: string,
  requestUrl: string,
  requestParams: string | null,
  responseCode: number | null,
  responseBody: string | null,
  isSuccess: boolean,
  errorMessage: string | null,
  duration: number
) {
  try {
    const { prisma } = await import("./prisma");
    await prisma.apiSyncLog.create({
      data: {
        apiName,
        requestUrl,
        requestParams: requestParams?.substring(0, 1000),
        responseCode,
        responseBody: responseBody?.substring(0, 1000),
        isSuccess,
        errorMessage,
        duration,
      },
    });
  } catch {
    // 日志记录失败不影响主流程
  }
}

// ============ 核心接口 ============

// 1. 校验运单是否存在 + 获取运单详情
export async function validateAndGetWaybill(waybillNo: string) {
  return v2RequestWithRetry<any>(`/api/waybills/${waybillNo}/validate`);
}

// 2. 校验 SKU 是否归属于指定运单
export async function validateSkuForWaybill(waybillNo: string, sku: string) {
  return v2RequestWithRetry<any>(`/api/waybills/${waybillNo}/sku/${sku}/validate`);
}

// 3. 按条件查询/同步运单列表
export async function syncWaybillList(params?: {
  page?: number;
  pageSize?: number;
  updatedAfter?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.updatedAfter) query.set("updatedAfter", params.updatedAfter);
  const qs = query.toString();
  return v2RequestWithRetry<any>(`/api/waybills/sync${qs ? `?${qs}` : ""}`);
}

// 4. 回写运单异常状态标记（可选加分项）
export async function notifyWaybillException(waybillNo: string, ticketId: string) {
  return v2RequestWithRetry<any>(`/api/waybills/${waybillNo}/exception-notify`, {
    method: "POST",
    body: JSON.stringify({ ticketId }),
  });
}

// 检查V2服务健康状态
export async function checkV2Health() {
  try {
    const result = await v2Request<any>("/api/health");
    return result.success;
  } catch {
    return false;
  }
}
