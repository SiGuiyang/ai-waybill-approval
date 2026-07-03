import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.displayName,
      role: user.role,
      warehouseId: user.warehouseId,
    },
  });
}
