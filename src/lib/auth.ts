// ============================================================
// 自定义 JWT 认证系统
// ============================================================
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-in-production-min-32-chars!!"
);

const COOKIE_NAME = "v3-auth-token";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  warehouseId: string | null;
}

// 生成 JWT Token
export async function createToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

// 验证 JWT Token
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

// 获取当前用户（Server Component / API Route）
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const user = await verifyToken(token);
  if (!user) return null;

  // 验证用户是否仍然活跃
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || !dbUser.isActive) return null;

  return user;
}

// 设置登录 Cookie
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

// 清除登录 Cookie
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// 确保已登录（API Route 辅助）
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new Error("未登录");
  return user;
}

// 兼容别名：现有 API Routes 使用 auth() 获取 session
export async function auth() {
  const user = await getAuthUser();
  if (!user) return null;
  return {
    user: {
      id: user.id,
      name: user.displayName,
      role: user.role,
      warehouseId: user.warehouseId,
    },
  };
}
