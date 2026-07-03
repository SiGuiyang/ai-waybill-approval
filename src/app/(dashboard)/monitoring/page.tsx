"use client";

import { useState, useEffect } from "react";

export default function MonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/monitoring");
      const data = await res.json();
      setData(data);
    } catch (err) {
      console.error("Failed to fetch monitoring data:", err);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-1">接口监控</h1>
      <p className="text-gray-500 mb-6">V2 接口同步状态与调用日志</p>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${data?.stats?.v2Healthy ? "bg-green-500" : "bg-red-500"}`}></div>
            <span className="stat-label">V2 服务状态</span>
          </div>
          <div className={`stat-value text-lg ${data?.stats?.v2Healthy ? "text-green-600" : "text-red-600"}`}>
            {data?.stats?.v2Healthy ? "正常" : "不可用"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">同步成功率</div>
          <div className="stat-value text-[#0FC6C2]">{data?.stats?.successRate ?? 0}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">总调用次数</div>
          <div className="stat-value text-gray-700">{data?.stats?.totalCalls ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">失败次数</div>
          <div className="stat-value text-red-500">{data?.stats?.failedCalls ?? 0}</div>
        </div>
      </div>

      {/* Last Sync Time */}
      {data?.stats?.lastSyncTime && (
        <div className="card p-4 mb-6 flex items-center gap-3">
          <span className="text-sm text-gray-500">最近同步时间：</span>
          <span className="text-sm font-medium">{new Date(data.stats.lastSyncTime).toLocaleString()}</span>
        </div>
      )}

      {/* Sync Logs */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">接口调用日志</h2>
          <button onClick={fetchData} className="text-sm text-[#0FC6C2] hover:underline">
            刷新
          </button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>接口名</th>
                <th>请求URL</th>
                <th>响应码</th>
                <th>结果</th>
                <th>耗时</th>
                <th>错误信息</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentLogs?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">暂无日志记录</td>
                </tr>
              ) : (
                data?.recentLogs?.map((log: any) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs text-gray-700">{log.apiName}</td>
                    <td className="font-mono text-xs text-gray-500 max-w-xs truncate" title={log.requestUrl}>
                      {log.requestUrl}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${log.responseCode && log.responseCode < 400 ? "badge-success" : "badge-danger"}`}>
                        {log.responseCode || "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${log.isSuccess ? "badge-success" : "badge-danger"}`}>
                        {log.isSuccess ? "成功" : "失败"}
                      </span>
                    </td>
                    <td className="text-center text-xs text-gray-500">{log.duration}ms</td>
                    <td className="text-xs text-red-500 max-w-xs truncate">{log.errorMessage || "-"}</td>
                    <td className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
