"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

export default function RulesPage() {
  const { showToast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/admin/rules");
      const data = await res.json();
      setRules(data);
    } catch {
      showToast("获取规则失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = "/api/admin/rules";
      const method = editing.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        showToast("保存成功");
        setEditing(null);
        fetchRules();
      } else {
        showToast("保存失败", "error");
      }
    } catch {
      showToast("保存失败", "error");
    }
  };

  const handleToggleActive = async (rule: any) => {
    try {
      await fetch("/api/admin/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      fetchRules();
    } catch {
      showToast("操作失败", "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">品控规则配置</h1>
          <p className="text-gray-500 mt-1">可配置的品控触发规则，不硬编码触发条件</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setEditing({
            ruleName: "",
            exceptionSubtype: "quantity_mismatch",
            triggerField: "quantityDiffPercent",
            triggerOperator: "gt",
            triggerValue: 10,
            severity: "normal",
            autoCreateTicket: true,
            defaultApprovalLevel: 1,
            isActive: true,
          })}
        >
          + 新增规则
        </button>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editing.id ? "编辑规则" : "新增规则"}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                <input
                  type="text" className="input-field"
                  value={editing.ruleName}
                  onChange={(e) => setEditing({ ...editing, ruleName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">异常子类型</label>
                <select
                  className="select-field"
                  value={editing.exceptionSubtype}
                  onChange={(e) => setEditing({ ...editing, exceptionSubtype: e.target.value })}
                >
                  <option value="quantity_mismatch">数量不符</option>
                  <option value="appearance_damage">外观破损</option>
                  <option value="spec_mismatch">规格不符</option>
                  <option value="label_error">标签错误</option>
                  <option value="batch_abnormal">批次异常</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">触发字段</label>
                <select
                  className="select-field"
                  value={editing.triggerField}
                  onChange={(e) => setEditing({ ...editing, triggerField: e.target.value })}
                >
                  <option value="quantityDiffPercent">数量差异百分比</option>
                  <option value="damageLevel">破损等级</option>
                  <option value="specDeviation">规格偏差</option>
                  <option value="labelAccuracy">标签准确度</option>
                  <option value="batchMatch">批次匹配</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">比较操作符</label>
                <select
                  className="select-field"
                  value={editing.triggerOperator}
                  onChange={(e) => setEditing({ ...editing, triggerOperator: e.target.value })}
                >
                  <option value="gt">大于 ({'>'})</option>
                  <option value="gte">大于等于 ({'>='})</option>
                  <option value="lt">小于 ({'<'})</option>
                  <option value="lte">小于等于 ({'<='})</option>
                  <option value="eq">等于</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">触发阈值</label>
                <input
                  type="number" className="input-field"
                  value={editing.triggerValue}
                  onChange={(e) => setEditing({ ...editing, triggerValue: Number(e.target.value) })}
                  step="0.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">严重度</label>
                <select
                  className="select-field"
                  value={editing.severity}
                  onChange={(e) => setEditing({ ...editing, severity: e.target.value })}
                >
                  <option value="normal">普通</option>
                  <option value="serious">严重</option>
                  <option value="critical">危险</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">默认审批级别</label>
                <select
                  className="select-field"
                  value={editing.defaultApprovalLevel}
                  onChange={(e) => setEditing({ ...editing, defaultApprovalLevel: Number(e.target.value) })}
                >
                  <option value={1}>一级审批</option>
                  <option value={2}>二级审批</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>取消</button>
              <button type="submit" className="btn-primary">保存</button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>规则名称</th>
                <th>异常子类型</th>
                <th>触发条件</th>
                <th>严重度</th>
                <th>默认审批</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="font-medium">{rule.ruleName}</td>
                  <td className="text-sm">{rule.exceptionSubtype}</td>
                  <td className="font-mono text-xs">
                    {rule.triggerField} {rule.triggerOperator} {rule.triggerValue}
                  </td>
                  <td>
                    <span className={`badge ${rule.severity === "critical" ? "badge-danger" : rule.severity === "serious" ? "badge-warning" : "badge-info"}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="text-sm">级别{rule.defaultApprovalLevel}</td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={`badge cursor-pointer ${rule.isActive ? "badge-success" : "badge-neutral"}`}
                    >
                      {rule.isActive ? "启用" : "禁用"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="text-[#0FC6C2] text-sm hover:underline"
                      onClick={() => setEditing(rule)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
