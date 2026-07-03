"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { useSession } from "@/lib/session-context";

export default function UsersPage() {
  const { user } = useSession();
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    username: "", displayName: "", password: "", role: "reporter", warehouseId: "",
  });

  const userRole = user?.role;

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        showToast("仅管理员可查看", "error");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data);
    } catch {
      showToast("获取用户列表失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showToast("创建成功");
        setShowCreate(false);
        setForm({ username: "", displayName: "", password: "", role: "reporter", warehouseId: "" });
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error || "创建失败", "error");
      }
    } catch {
      showToast("创建失败", "error");
    }
  };

  const roleLabels: Record<string, string> = {
    reporter: "上报人",
    level1_approver: "一级审批人",
    level2_approver: "二级审批人",
    qc_supervisor: "品控主管",
    admin: "管理员",
  };

  if (userRole !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">用户管理</h1>
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h3 className="text-lg font-medium text-gray-700">仅管理员可访问</h3>
          <p className="text-sm text-gray-400 mt-1">请联系管理员进行用户管理操作</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-500 mt-1">管理系统用户与角色权限</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          + 新增用户
        </button>
      </div>

      {showCreate && (
        <div className="card p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">创建用户</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input type="text" className="input-field" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
                <input type="text" className="input-field" value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input type="password" className="input-field" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select className="select-field" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="reporter">上报人</option>
                  <option value="level1_approver">一级审批人</option>
                  <option value="level2_approver">二级审批人</option>
                  <option value="qc_supervisor">品控主管</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
              <button type="submit" className="btn-primary">创建</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>显示名称</th>
                <th>角色</th>
                <th>仓库</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-mono text-sm">{user.username}</td>
                  <td className="font-medium">{user.displayName}</td>
                  <td>
                    <span className="badge badge-primary">{roleLabels[user.role] || user.role}</span>
                  </td>
                  <td className="text-sm text-gray-500">{user.warehouseId || "-"}</td>
                  <td>
                    <span className={`badge ${user.isActive ? "badge-success" : "badge-danger"}`}>
                      {user.isActive ? "正常" : "禁用"}
                    </span>
                  </td>
                  <td className="text-xs text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
