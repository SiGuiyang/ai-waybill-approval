import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET: 获取品控规则列表
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const rules = await prisma.qcRule.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json({ error: "获取规则失败" }, { status: 500 });
  }
}

// POST: 创建品控规则
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== "admin" && userRole !== "qc_supervisor") {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const rule = await prisma.qcRule.create({ data: body });
    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json({ error: "创建规则失败" }, { status: 500 });
  }
}

// PUT: 更新品控规则
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== "admin" && userRole !== "qc_supervisor") {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...data } = body;
    const rule = await prisma.qcRule.update({ where: { id }, data });
    return NextResponse.json(rule);
  } catch (error) {
    return NextResponse.json({ error: "更新规则失败" }, { status: 500 });
  }
}
