import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET: 获取用户列表
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== "admin") {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        warehouseId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

// POST: 创建用户
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userRole = (session.user as any).role;
  if (userRole !== "admin") {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { username, displayName, password, role, warehouseId } = body;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { username, displayName, passwordHash, role, warehouseId },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        warehouseId: true,
        isActive: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}
