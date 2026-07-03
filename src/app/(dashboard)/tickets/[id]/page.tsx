"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/Toast";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const { showToast } = useToast();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) { router.push("/tickets"); return; }
      const data = await res.json();
      setTicket(data);
    } catch (err) {
      showToast("获取工单详情失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (action: "approve" | "reject") => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/tickets/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, opinion }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(action === "approve" ? "审批通过" : "已驳回", "success");
        fetchTicket();
        setOpinion("");
      } else {
        if (data.conflict) {
          showToast(`${data.error}（${data.processedBy} 已${data.previousAction === "approve" ? "通过" : "驳回"}）`, "error");
        } else {
          showToast(data.error || "操作失败", "error");
        }
      }
    } catch {
      showToast("操作失败", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleResubmit = async () => {
    const updatedDesc = prompt("如需更新异常描述，请输入（留空保持不变）：");
    setProcessing(true);
    try {
      const res = await fetch(`/api/tickets/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedDesc: updatedDesc || undefined }),
      });
      const data = await res.json();
      if (res.ok) { showToast("重新提交成功", "success"); fetchTicket(); }
      else { showToast(data.error, "error"); }
    } catch { showToast("操作失败", "error"); }
    finally { setProcessing(false); }
  };

  const handleForceRelease = async () => {
    const reason = prompt("请输入复核原因：");
    if (!reason) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/scanning/force-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id, reason }),
      });
      const data = await res.json();
      if (res.ok) { showToast("快速放行成功", "success"); fetchTicket(); }
      else { showToast(data.error, "error"); }
    } catch { showToast("操作失败", "error"); }
    finally { setProcessing(false); }
  };

  const handleExecution = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id }),
      });
      const data = await res.json();
      if (res.ok) { showToast("执行联动完成", "success"); fetchTicket(); }
      else { showToast(data.error, "error"); }
    } catch { showToast("操作失败", "error"); }
    finally { setProcessing(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0FC6C2]"></div>
      </div>
    );
  }

  if (!ticket) return null;

  const userRole = user?.role;
  const userId = user?.id;
  const canApprove = (
    (ticket.status === "level1_approving" && (userRole === "level1_approver" || userRole === "admin")) ||
    (ticket.status === "level2_approving" && (userRole === "level2_approver" || userRole === "admin"))
  ) && ticket.reporterId !== userId;
  const canForceRelease = ticket.source === "scan_trigger" &&
    (userRole === "qc_supervisor" || userRole === "admin") &&
    !["completed", "closed", "force_released"].includes(ticket.status);
  const canResubmit = ticket.status === "pending" && ticket.resubmitCount < ticket.maxResubmit;
  const canExecute = ticket.status === "executing";

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-[#0FC6C2] hover:underline mb-4 inline-block">
        ← 返回列表
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-bold text-gray-900">{ticket.ticketNo}</h1>
              <span className={`badge ${getBadgeClass(ticket.status)}`}>{getStatusLabel(ticket.status)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">运单号：</span>
                <span className="font-medium">{ticket.waybillNo}</span>
              </div>
              <div>
                <span className="text-gray-500">异常大类：</span>
                <span>{ticket.exceptionType === "logistics" ? "物流异常" : "品控异常"}</span>
              </div>
              <div>
                <span className="text-gray-500">异常子类型：</span>
                <span>{ticket.exceptionSubtype}</span>
              </div>
              <div>
                <span className="text-gray-500">严重度：</span>
                <span className={`badge ${ticket.severity === "critical" ? "badge-danger" : ticket.severity === "serious" ? "badge-warning" : "badge-info"}`}>
                  {ticket.severity}
                </span>
              </div>
              <div>
                <span className="text-gray-500">来源：</span>
                <span className={`badge ${ticket.source === "manual_report" ? "badge-neutral" : "badge-primary"}`}>
                  {ticket.source === "manual_report" ? "手工上报" : "扫描自动触发"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">金额：</span>
                <span className="font-medium">¥{ticket.declaredAmount?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">上报人：</span>
                <span>{ticket.reporter?.displayName}</span>
              </div>
              <div>
                <span className="text-gray-500">重提次数：</span>
                <span>{ticket.resubmitCount} / {ticket.maxResubmit}</span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-1">异常描述</div>
              <p className="text-sm text-gray-600">{ticket.exceptionDesc}</p>
            </div>

            {ticket.waybillInfo?.isStale && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                ⚠️ 运单数据可能非最新，获取自 {new Date(ticket.waybillInfo.syncedAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Waybill Info */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">运单信息</h2>
            <div className="text-xs text-gray-400 mb-3">{ticket.waybillInfo?.sourceLabel}</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">发件人：</span>
                <span>{ticket.waybill?.senderName}</span>
              </div>
              <div>
                <span className="text-gray-500">收件人：</span>
                <span>{ticket.waybill?.receiverName}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">发件地址：</span>
                <span>{ticket.waybill?.senderAddress}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">收件地址：</span>
                <span>{ticket.waybill?.receiverAddress}</span>
              </div>
              <div>
                <span className="text-gray-500">V2状态：</span>
                <span>{ticket.waybill?.v2Status}</span>
              </div>
            </div>
          </div>

          {/* Approval Records / Audit Trail */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">审批历史</h2>
            {ticket.approvalRecords?.length === 0 ? (
              <p className="text-sm text-gray-400">暂无审批记录</p>
            ) : (
              <div className="space-y-3">
                {ticket.approvalRecords.map((record: any) => (
                  <div key={record.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${record.action === "approve" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {record.action === "approve" ? "✓" : "✗"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{record.approver?.displayName || record.approverName}</span>
                        <span className={`badge ${record.action === "approve" ? "badge-success" : "badge-danger"}`}>
                          {record.action === "approve" ? "通过" : "驳回"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {record.level === 0 ? "快速放行" : `${record.level}级审批`}
                        </span>
                      </div>
                      {record.opinion && (
                        <p className="text-sm text-gray-600 mt-1">{record.opinion}</p>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(record.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scan Records */}
          {ticket.scans?.length > 0 && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">扫描记录</h2>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>操作人</th>
                      <th>结果</th>
                      <th>批次锁定</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.scans.map((scan: any) => (
                      <tr key={scan.id}>
                        <td className="font-mono text-xs">{scan.sku}</td>
                        <td>{scan.operator?.displayName}</td>
                        <td>
                          <span className={`badge ${scan.qcResult === "pass" ? "badge-success" : "badge-danger"}`}>
                            {scan.qcResult === "pass" ? "通过" : "异常"}
                          </span>
                        </td>
                        <td>
                          {scan.batchLocked
                            ? <span className="badge badge-warning">锁定</span>
                            : <span className="badge badge-success">已解锁</span>}
                        </td>
                        <td className="text-xs text-gray-400">{new Date(scan.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Compensation */}
          {ticket.compensation && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">赔付记录</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">赔付金额：</span>
                  <span className="font-medium text-red-600">¥{ticket.compensation.amount?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">赔付方向：</span>
                  <span>{ticket.compensation.direction === "supplier_recovery" ? "向供应商追偿" : "赔付客户"}</span>
                </div>
                <div>
                  <span className="text-gray-500">状态：</span>
                  <span className={`badge ${ticket.compensation.status === "completed" ? "badge-success" : "badge-warning"}`}>
                    {ticket.compensation.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">触发审批记录：</span>
                  <span className="font-mono text-xs">{ticket.compensation.triggeredBy?.substring(0, 8)}...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-4">
          {canApprove && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                {ticket.status === "level1_approving" ? "一级审批" : "二级审批"}
              </h2>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">审批意见</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="请输入审批意见..."
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1"
                  disabled={processing}
                  onClick={() => handleApprove("approve")}
                >
                  ✓ 通过
                </button>
                <button
                  className="btn-danger flex-1"
                  disabled={processing}
                  onClick={() => handleApprove("reject")}
                >
                  ✗ 驳回
                </button>
              </div>
            </div>
          )}

          {canResubmit && ticket.reporterId === userId && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">重新提交</h2>
              <p className="text-sm text-gray-500 mb-3">
                剩余次数：{ticket.maxResubmit - ticket.resubmitCount} / {ticket.maxResubmit}
              </p>
              <button className="btn-secondary w-full" disabled={processing} onClick={handleResubmit}>
                重新提交审批
              </button>
            </div>
          )}

          {canForceRelease && (
            <div className="card p-5 border-l-4 border-yellow-400">
              <h2 className="text-base font-semibold text-gray-900 mb-2">品控主管操作</h2>
              <p className="text-sm text-gray-500 mb-3">误判快速放行：直接解锁批次、关闭工单</p>
              <button className="btn-secondary w-full border-yellow-400 text-yellow-700" disabled={processing} onClick={handleForceRelease}>
                ⚡ 快速放行
              </button>
            </div>
          )}

          {canExecute && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">执行联动</h2>
              <p className="text-sm text-gray-500 mb-3">
                审批已通过，执行下游动作（赔付/库存/退仓等）
              </p>
              <button className="btn-primary w-full" disabled={processing} onClick={handleExecution}>
                ⚙️ 执行联动
              </button>
            </div>
          )}

          {/* Status Timeline */}
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">基本信息</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span>{new Date(ticket.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span>{new Date(ticket.updatedAt).toLocaleString()}</span>
              </div>
              {ticket.completedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">完成时间</span>
                  <span>{new Date(ticket.completedAt).toLocaleString()}</span>
                </div>
              )}
              {ticket.overdueAt && (
                <div className="flex justify-between text-red-600">
                  <span>超时时间</span>
                  <span>{new Date(ticket.overdueAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "待审批", level1_approving: "一级审批中", level2_approving: "二级审批中",
    executing: "执行中", completed: "已完成", rejected: "已驳回",
    closed: "已关闭", force_released: "已快速放行",
  };
  return map[status] || status;
}

function getBadgeClass(status: string): string {
  switch (status) {
    case "pending": return "badge-warning";
    case "level1_approving": case "level2_approving": return "badge-info";
    case "executing": return "badge-primary";
    case "completed": case "force_released": return "badge-success";
    case "rejected": return "badge-danger";
    default: return "badge-neutral";
  }
}
