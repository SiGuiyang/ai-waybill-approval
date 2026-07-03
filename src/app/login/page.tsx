"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/dashboard");
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E6F9F8] to-[#F5F7FA]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0FC6C2] text-white text-2xl font-bold mb-4 shadow-lg">
            V3
          </div>
          <h1 className="text-2xl font-bold text-gray-900">运单全流程管理系统</h1>
          <p className="text-gray-500 mt-2">录单 → 扫描品控 → 异常上报 → 分级审批 → 执行联动</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">登录系统</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                className="input-field"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? "登录中..." : "登 录"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">演示账号（密码均为 123456）</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="bg-gray-50 rounded px-2 py-1.5">reporter</div>
              <div className="bg-gray-50 rounded px-2 py-1.5">approver1</div>
              <div className="bg-gray-50 rounded px-2 py-1.5">approver2</div>
              <div className="bg-gray-50 rounded px-2 py-1.5">qcmaster</div>
              <div className="bg-gray-50 rounded px-2 py-1.5 col-span-2 text-center">admin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
