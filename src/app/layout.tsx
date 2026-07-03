import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "运单全流程管理系统 V3",
  description: "录单 → 扫描品控 → 异常上报 → 分级审批 → 执行联动 —— 运单全生命周期管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
