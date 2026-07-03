"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

export default function ScanningPage() {
  const { showToast } = useToast();
  const [waybillNo, setWaybillNo] = useState("");
  const [sku, setSku] = useState("");
  const [damageLevel, setDamageLevel] = useState(0);
  const [quantityDiffPercent, setQuantityDiffPercent] = useState(0);
  const [specDeviation, setSpecDeviation] = useState(0);
  const [batchMatch, setBatchMatch] = useState(true);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waybillNo || !sku) {
      showToast("请输入运单号和SKU", "warning");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/scanning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waybillNo,
          sku,
          quantityDiffPercent,
          damageLevel,
          specDeviation,
          batchMatch,
          description,
          deviceInfo: navigator.userAgent.substring(0, 100),
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        if (data.pass) {
          showToast("品控检测通过 ✓", "success");
        } else if (data.isDuplicate) {
          showToast(data.message, "warning");
        } else {
          showToast(data.message, "error");
        }
      } else {
        showToast(data.error || "扫描失败", "error");
      }
    } catch (err) {
      showToast("请求失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const quickSets: Record<string, Partial<{
    damageLevel: number;
    quantityDiffPercent: number;
    specDeviation: number;
    description: string;
  }>> = {
    damaged: { damageLevel: 3, description: "外包装有裂痕，角部轻微变形" },
    quantity: { quantityDiffPercent: 15, description: "实际到货数量比运单少3件" },
    spec: { specDeviation: 10, description: "产品规格与运单描述不符" },
    label: { damageLevel: 1, description: "标签贴错位置" },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">扫描品控</h1>
      <p className="text-gray-500 mb-6">SKU扫描录入 → 品控规则引擎检测 → 通过出库 / 异常暂扣</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Form */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">扫描录入</h2>
          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                运单号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入运单号，如 WB20240101001"
                value={waybillNo}
                onChange={(e) => setWaybillNo(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入SKU编号"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  破损等级 (0-5)
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  className="input-field"
                  value={damageLevel}
                  onChange={(e) => setDamageLevel(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  数量差异 (%)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={quantityDiffPercent}
                  onChange={(e) => setQuantityDiffPercent(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  规格偏差 (%)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={specDeviation}
                  onChange={(e) => setSpecDeviation(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  批次匹配
                </label>
                <select
                  className="select-field"
                  value={batchMatch ? "true" : "false"}
                  onChange={(e) => setBatchMatch(e.target.value === "true")}
                >
                  <option value="true">匹配</option>
                  <option value="false">不匹配</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                异常描述
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="如有异常请描述具体情况..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? "扫描检测中..." : "🔍 开始品控检测"}
            </button>
          </form>
        </div>

        {/* Quick Presets */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">快速预设场景</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(quickSets).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (preset.description) setDescription(preset.description);
                    if (preset.damageLevel !== undefined) setDamageLevel(preset.damageLevel);
                    if (preset.quantityDiffPercent !== undefined) setQuantityDiffPercent(preset.quantityDiffPercent);
                    if (preset.specDeviation !== undefined) setSpecDeviation(preset.specDeviation);
                  }}
                  className="p-3 rounded-lg border border-gray-200 text-left hover:border-[#0FC6C2] hover:bg-[#E6F9F8] transition-all"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {key === "damaged" && "外观破损"}
                    {key === "quantity" && "数量不符"}
                    {key === "spec" && "规格不符"}
                    {key === "label" && "标签错误"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`card p-6 border-l-4 ${result.pass ? "border-green-400" : result.isDuplicate ? "border-yellow-400" : "border-red-400"}`}>
              <h2 className="text-base font-semibold text-gray-900 mb-3">检测结果</h2>
              {result.pass ? (
                <div className="text-green-700">
                  <div className="font-semibold">✓ 品控检测通过</div>
                  <div className="text-sm mt-1">{result.message}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.ruleResult && !result.isDuplicate && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-red-700">命中规则: {result.ruleResult.ruleName}</div>
                      <div className="text-xs text-red-600 mt-1">
                        异常子类型: {result.ruleResult.exceptionSubtype} | 严重度: {result.ruleResult.severity}
                      </div>
                    </div>
                  )}
                  {result.ticket && (
                    <div className="bg-yellow-50 rounded-lg p-3">
                      <div className="text-sm font-medium text-yellow-700">
                        已创建工单: {result.ticket.ticketNo}
                      </div>
                    </div>
                  )}
                  {result.isDuplicate && (
                    <div className="text-sm text-yellow-700">
                      ⚠️ {result.message}
                    </div>
                  )}
                  {result.aiSuggestion && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-sm text-blue-700">
                        🤖 {result.aiSuggestion.note}: {result.aiSuggestion.exceptionSubtype}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
