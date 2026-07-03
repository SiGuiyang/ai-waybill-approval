"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

export default function ExecutionPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/execution?pageSize=50");
      const data = await res.json();
      setData(data);
    } catch {
      showToast("获取数据失败", "error");
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
      <h1 className="text-2xl font-bold text-gray-900 mb-1">执行联动</h1>
      <p className="text-gray-500 mb-6">赔付记录 · 库存变更 · 退仓/重新采购</p>

      {/* Compensation Records */}
      <div className="card mb-6">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">赔付记录</h2>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>工单号</th>
                <th>异常类型</th>
                <th>赔付金额</th>
                <th>赔付方向</th>
                <th>状态</th>
                <th>对账方式</th>
                <th>触发审批</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {data?.compensations?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">暂无赔付记录</td>
                </tr>
              ) : (
                data?.compensations?.map((comp: any) => (
                  <tr key={comp.id}>
                    <td className="font-mono text-xs">{comp.ticket?.ticketNo}</td>
                    <td className="text-sm">{comp.ticket?.exceptionSubtype}</td>
                    <td className="text-right font-medium text-red-600">¥{comp.amount?.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${comp.direction === "supplier_recovery" ? "badge-warning" : "badge-info"}`}>
                        {comp.direction === "supplier_recovery" ? "向供应商追偿" : "赔付客户"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${comp.status === "completed" ? "badge-success" : "badge-warning"}`}>
                        {comp.status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{comp.reconciliationMethod || "-"}</td>
                    <td className="font-mono text-xs text-gray-400">{comp.triggeredBy?.substring(0, 8)}...</td>
                    <td className="text-xs text-gray-400">{new Date(comp.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Changes */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">库存变更记录</h2>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>变更类型</th>
                <th>数量变更</th>
                <th>变更前</th>
                <th>变更后</th>
                <th>触发审批</th>
                <th>备注</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {data?.inventoryChanges?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">暂无库存变更记录</td>
                </tr>
              ) : (
                data?.inventoryChanges?.map((change: any) => (
                  <tr key={change.id}>
                    <td>
                      <span className={`badge ${change.changeType === "lock" ? "badge-danger" : change.changeType === "return" ? "badge-info" : "badge-success"}`}>
                        {change.changeType}
                      </span>
                    </td>
                    <td className={`text-right font-medium ${change.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                      {change.quantity > 0 ? "+" : ""}{change.quantity}
                    </td>
                    <td className="text-right">{change.beforeQuantity}</td>
                    <td className="text-right">{change.afterQuantity}</td>
                    <td className="font-mono text-xs text-gray-400">{change.triggeredBy?.substring(0, 8)}...</td>
                    <td className="text-sm text-gray-500">{change.remark || "-"}</td>
                    <td className="text-xs text-gray-400">{new Date(change.createdAt).toLocaleString()}</td>
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
