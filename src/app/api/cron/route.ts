import { NextResponse } from "next/server";
import { checkAndMarkOverdue } from "@/lib/cron";

// GET: 定时任务端点，可通过 Vercel Cron 或外部调度触发
export async function GET() {
  try {
    await checkAndMarkOverdue();
    return NextResponse.json({ success: true, message: "超时检查完成" });
  } catch (error) {
    return NextResponse.json({ error: "超时检查失败" }, { status: 500 });
  }
}
