"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/session-context";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function ApprovalPage() {
  const { user } = useSession();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [opinion, setOpinion] = useState("");
  const [processing, setProcessing] = useState(false);

  const userRole = user?.role;
  const userId = user?.id;

  const fetchPendingApprovals = useCallback(async () => {
    setLoading(true);
    try {
      let statuses: string[] = [];
      if (userRole === "level1_approver" || userRole === "admin") {
        statuses = ["level1_approving"];
      }
      if (userRole === "level2_approver" || userRole === "admin") {
        statuses = [...statuses, "level2_approving"];
      }
      if (statuses.length === 0) {
        statuses = ["level1_approving", "level2_approving"];
      }

      const params = new URLSearchParams();
      statuses.forEach((s) => params.append("status", s));
      params.set("pageSize", "100");

      const res = await fetch(`/api/tickets?${params}`);
      const data = await res.json();
      // 过滤掉自己上报的工单（自批自核防护）
      const filtered = (data.tickets || []).filter((t: any) => t.reporterId !== userId);
      setTickets(filtered);
    } catch {
      showToast("获取审批列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [userRole, userId, showToast]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleApprove = async (ticketId: string, action: "approve" | "reject") => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, opinion }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(action === "approve" ? "审批通过" : "已驳回", "success");
        setSelectedTicket(null);
        setOpinion("");
        fetchPendingApprovals();
      } else {
        if (data.conflict) {
          showToast(`该工单已被处理，请刷新`, "warning");
          fetchPendingApprovals();
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">审批中心</h1>
      <p className="text-gray-500 mb-6">
        待审批工单 · {userRole === "level1_approver" ? "一级审批" : userRole === "level2_approver" ? "二级审批" : "全部"}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                待处理 ({tickets.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="animate-spin inline-block rounded-full h-5 w-5 border-b-2 border-[#0FC6C2]"></div>
                  <span className="ml-2">加载中...</span>
                </div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">暂无待审批工单</div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => { setSelectedTicket(ticket); setOpinion(""); }}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedTicket?.id === ticket.id ? "bg-[#E6F9F8] border-l-2 border-[#0FC6C2]" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-gray-500">{ticket.ticketNo}</span>
                      {ticket.isOverdue && (
                        <span className="badge badge-overdue">超时</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{ticket.exceptionSubtype}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{ticket.waybillNo}</span>
                      <span className="text-xs font-medium">¥{ticket.declaredAmount?.toFixed(0)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                      <span className={`ml-2 badge ${ticket.status === "level2_approving" ? "badge-info" : "badge-info"}`}>
                        {ticket.status === "level1_approving" ? "一级" : "二级"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Approval Form */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <div className="space-y-4">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{selectedTicket.ticketNo}</h2>
                  <span className={`badge ${selectedTicket.status === "level1_approving" ? "badge-info" : "badge-info"}`}>
                    {selectedTicket.status === "level1_approving" ? "一级审批" : "二级审批"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">运单号：</span>
                    <span className="font-medium">{selectedTicket.waybillNo}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">金额：</span>
                    <span className="font-medium">¥{selectedTicket.declaredAmount?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">异常类型：</span>
                    <span>{selectedTicket.exceptionSubtype}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">严重度：</span>
                    <span className={`badge ${selectedTicket.severity === "critical" ? "badge-danger" : "badge-warning"}`}>{selectedTicket.severity}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">上报人：</span>
                    <span>{selectedTicket.reporter?.displayName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">创建时间：</span>
                    <span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedTicket.isOverdue && (
                    <div className="col-span-2 p-2 bg-red-50 rounded text-sm text-red-600">
                      ⚠️ 此工单已超时，请优先处理
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-1">异常描述</div>
                  <p className="text-sm text-gray-600">{selectedTicket.exceptionDesc}</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">审批意见</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    placeholder="请输入审批意见..."
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    className="btn-primary flex-1 py-2.5"
                    disabled={processing}
                    onClick={() => handleApprove(selectedTicket.id, "approve")}
                  >
                    ✓ 审批通过
                  </button>
                  <button
                    className="btn-danger flex-1 py-2.5"
                    disabled={processing}
                    onClick={() => handleApprove(selectedTicket.id, "reject")}
                  >
                    ✗ 驳回
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-lg font-medium text-gray-700 mb-1">选择工单开始审批</h3>
              <p className="text-sm text-gray-400">从左侧列表选择待审批工单</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
