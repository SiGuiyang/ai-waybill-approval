import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    let user;
    try {
      user = await prisma.user.findUnique({ where: { username } });
    } catch (dbError: any) {
      console.error("Database error during login:", dbError.message);
      return NextResponse.json(
        { error: "数据库连接失败，请检查 Neon 连接字符串是否正确，以及是否已执行 prisma db push" },
        { status: 500 }
      );
    }

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const token = await createToken({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      warehouseId: user.warehouseId,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        warehouseId: user.warehouseId,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: `登录失败：${error.message}` }, { status: 500 });
  }
}
