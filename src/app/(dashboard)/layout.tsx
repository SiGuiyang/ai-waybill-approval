"use client";

import { SessionProvider, useSession } from "@/lib/session-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "@/components/Toast";

const menuItems = [
  { href: "/dashboard", label: "工作台", icon: "📊" },
  { href: "/scanning", label: "扫描品控", icon: "📷" },
  { href: "/tickets", label: "工单管理", icon: "📋" },
  { href: "/approval", label: "审批中心", icon: "✅" },
  { href: "/execution", label: "执行联动", icon: "⚙️" },
  { href: "/monitoring", label: "接口监控", icon: "📡" },
  { href: "/admin/rules", label: "品控规则", icon: "🔧" },
  { href: "/admin/users", label: "用户管理", icon: "👥" },
];

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const roleLabels: Record<string, string> = {
    reporter: "上报人",
    level1_approver: "一级审批人",
    level2_approver: "二级审批人",
    qc_supervisor: "品控主管",
    admin: "管理员",
  };

  return (
    <aside className="sidebar flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0FC6C2] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            V3
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">运单管理系统</div>
            <div className="text-[10px] text-gray-400">全流程管理平台</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? "active" : ""}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#E6F9F8] flex items-center justify-center text-sm font-medium text-[#0A9E9B]">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user?.name || "用户"}
            </div>
            <div className="text-xs text-gray-400">
              {roleLabels[user?.role || ""] || "未知"}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
