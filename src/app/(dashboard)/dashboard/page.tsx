"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session-context";
import Link from "next/link";

interface DashboardStats {
  totalTickets: number;
  pendingTickets: number;
  approvingTickets: number;
  overdueTickets: number;
  completedToday: number;
  qcPendingTickets: number;
  recentTickets: any[];
  recentLogs: any[];
}

export default function DashboardPage() {
  const { user } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0FC6C2]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
        <p className="text-gray-500 mt-1">运单全流程管理概览</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value text-[#0FC6C2]">{stats?.totalTickets ?? 0}</div>
          <div className="stat-label">总工单数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-[#F59E0B]">{stats?.pendingTickets ?? 0}</div>
          <div className="stat-label">待处理</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-[#3B82F6]">{stats?.approvingTickets ?? 0}</div>
          <div className="stat-label">审批中</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-[#EF4444]">{stats?.overdueTickets ?? 0}</div>
          <div className="stat-label">即将超时</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">最近工单</h2>
            <Link href="/tickets" className="text-sm text-[#0FC6C2] hover:underline">
              查看全部
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentTickets?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">暂无工单</p>
            )}
            {stats?.recentTickets?.map((ticket: any) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {ticket.ticketNo}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    运单 {ticket.waybillNo} · {ticket.exceptionSubtype}
                  </div>
                </div>
                <span className={`badge badge-${getStatusBadgeClass(ticket.status)}`}>
                  {getStatusLabel(ticket.status)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Sync Logs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">接口同步状态</h2>
            <Link href="/monitoring" className="text-sm text-[#0FC6C2] hover:underline">
              查看详情
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentLogs?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">暂无记录</p>
            )}
            {stats?.recentLogs?.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{log.apiName}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className={`badge ${log.isSuccess ? "badge-success" : "badge-danger"}`}>
                  {log.isSuccess ? "成功" : "失败"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "待审批",
    level1_approving: "一级审批中",
    level2_approving: "二级审批中",
    executing: "执行中",
    completed: "已完成",
    rejected: "已驳回",
    closed: "已关闭",
    force_released: "已放行",
  };
  return map[status] || status;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending": return "badge-warning";
    case "level1_approving":
    case "level2_approving": return "badge-info";
    case "executing": return "badge-primary";
    case "completed": return "badge-success";
    case "rejected": return "badge-danger";
    case "force_released": return "badge-success";
    default: return "badge-neutral";
  }
}
