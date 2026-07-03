"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

export default function TicketsPage() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    status: "",
    exceptionType: "",
    waybillNo: "",
    source: "",
  });
  // 创建工单表单
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    waybillNo: "",
    exceptionType: "logistics",
    exceptionSubtype: "damaged",
    exceptionDesc: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("pageSize", String(pagination.pageSize));
      if (filters.status) params.set("status", filters.status);
      if (filters.exceptionType) params.set("exceptionType", filters.exceptionType);
      if (filters.waybillNo) params.set("waybillNo", filters.waybillNo);
      if (filters.source) params.set("source", filters.source);

      const res = await fetch(`/api/tickets?${params}`);
      const data = await res.json();
      setTickets(data.tickets || []);
      setPagination((prev) => ({ ...prev, ...data.pagination }));
    } catch (err) {
      showToast("获取工单列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters, showToast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("工单创建成功");
        setShowCreate(false);
        setCreateForm({ waybillNo: "", exceptionType: "logistics", exceptionSubtype: "damaged", exceptionDesc: "" });
        fetchTickets();
      } else {
        showToast(data.error || "创建失败", "error");
      }
    } catch {
      showToast("创建失败", "error");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, [string, string]> = {
      pending: ["待审批", "badge-warning"],
      level1_approving: ["一级审批中", "badge-info"],
      level2_approving: ["二级审批中", "badge-info"],
      executing: ["执行中", "badge-primary"],
      completed: ["已完成", "badge-success"],
      rejected: ["已驳回", "badge-danger"],
      closed: ["已关闭", "badge-neutral"],
      force_released: ["已放行", "badge-success"],
    };
    const [label, cls] = map[status] || [status, "badge-neutral"];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const subtypeLabels: Record<string, string> = {
    lost: "丢件", damaged: "破损", rejected: "客户拒收", timeout: "超时未签收", wrong_address: "地址错误",
    quantity_mismatch: "数量不符", appearance_damage: "外观破损", spec_mismatch: "规格不符",
    label_error: "标签错误", batch_abnormal: "批次异常",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工单管理</h1>
          <p className="text-gray-500 mt-1">管理所有异常工单</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          + 创建工单
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">手工上报异常工单</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  运单号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="WB20240101001"
                  value={createForm.waybillNo}
                  onChange={(e) => setCreateForm({ ...createForm, waybillNo: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">异常大类</label>
                <select
                  className="select-field"
                  value={createForm.exceptionType}
                  onChange={(e) => setCreateForm({ ...createForm, exceptionType: e.target.value })}
                >
                  <option value="logistics">物流类异常</option>
                  <option value="quality_control">品控类异常</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">异常子类型</label>
                <select
                  className="select-field"
                  value={createForm.exceptionSubtype}
                  onChange={(e) => setCreateForm({ ...createForm, exceptionSubtype: e.target.value })}
                >
                  {createForm.exceptionType === "logistics" ? (
                    <>
                      <option value="lost">丢件</option>
                      <option value="damaged">破损</option>
                      <option value="rejected">客户拒收</option>
                      <option value="timeout">超时未签收</option>
                      <option value="wrong_address">地址错误</option>
                    </>
                  ) : (
                    <>
                      <option value="quantity_mismatch">数量不符</option>
                      <option value="appearance_damage">外观破损</option>
                      <option value="spec_mismatch">规格不符</option>
                      <option value="label_error">标签错误</option>
                      <option value="batch_abnormal">批次异常</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">异常描述</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={createForm.exceptionDesc}
                  onChange={(e) => setCreateForm({ ...createForm, exceptionDesc: e.target.value })}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? "创建中..." : "提交工单"}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <select
            className="select-field w-auto"
            value={filters.status}
            onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPagination((p) => ({ ...p, page: 1 })); }}
          >
            <option value="">全部状态</option>
            <option value="pending">待审批</option>
            <option value="level1_approving">一级审批中</option>
            <option value="level2_approving">二级审批中</option>
            <option value="executing">执行中</option>
            <option value="completed">已完成</option>
            <option value="rejected">已驳回</option>
            <option value="closed">已关闭</option>
          </select>
          <select
            className="select-field w-auto"
            value={filters.exceptionType}
            onChange={(e) => { setFilters({ ...filters, exceptionType: e.target.value }); setPagination((p) => ({ ...p, page: 1 })); }}
          >
            <option value="">全部类型</option>
            <option value="logistics">物流异常</option>
            <option value="quality_control">品控异常</option>
          </select>
          <select
            className="select-field w-auto"
            value={filters.source}
            onChange={(e) => { setFilters({ ...filters, source: e.target.value }); setPagination((p) => ({ ...p, page: 1 })); }}
          >
            <option value="">全部来源</option>
            <option value="manual_report">手工上报</option>
            <option value="scan_trigger">扫描触发</option>
          </select>
          <input
            type="text"
            className="input-field w-48"
            placeholder="搜索运单号..."
            value={filters.waybillNo}
            onChange={(e) => setFilters({ ...filters, waybillNo: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { setPagination((p) => ({ ...p, page: 1 })); fetchTickets(); } }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>工单号</th>
                <th>运单号</th>
                <th>异常类型</th>
                <th>来源</th>
                <th>金额</th>
                <th>状态</th>
                <th>上报人</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    <div className="animate-spin inline-block rounded-full h-5 w-5 border-b-2 border-[#0FC6C2] mr-2"></div>
                    加载中...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">暂无工单</td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="font-mono text-xs">{ticket.ticketNo}</td>
                    <td className="font-medium">{ticket.waybillNo}</td>
                    <td>
                      <span className="text-sm">{subtypeLabels[ticket.exceptionSubtype] || ticket.exceptionSubtype}</span>
                      {ticket.isOverdue && <span className="badge badge-overdue ml-2">即将超时</span>}
                    </td>
                    <td>
                      <span className={`badge ${ticket.source === "manual_report" ? "badge-neutral" : "badge-primary"}`}>
                        {ticket.source === "manual_report" ? "手工上报" : "扫描触发"}
                      </span>
                    </td>
                    <td className="text-right">¥{ticket.declaredAmount?.toFixed(2)}</td>
                    <td>{getStatusBadge(ticket.status)}</td>
                    <td className="text-sm text-gray-600">{ticket.reporter?.displayName}</td>
                    <td className="text-xs text-gray-400">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link href={`/tickets/${ticket.id}`} className="text-[#0FC6C2] text-sm hover:underline">
                        详情
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              共 {pagination.total} 条记录
            </div>
            <div className="flex gap-1">
              <button
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                上一页
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const startPage = Math.max(1, pagination.page - 3);
                const pageNum = startPage + i;
                if (pageNum > pagination.totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn ${pagination.page === pageNum ? "active" : ""}`}
                    onClick={() => setPagination((p) => ({ ...p, page: pageNum }))}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
