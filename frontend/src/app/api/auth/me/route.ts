import { NextRequest, NextResponse } from "next/server";
import { verifySignedCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cookieValue = req.cookies.get("poshakh_token")?.value;
  if (!cookieValue) return NextResponse.json({ customer: null });

  const customer = verifySignedCookie(cookieValue);
  if (!customer) {
    const response = NextResponse.json({ customer: null });
    response.cookies.delete("poshakh_token");
    return response;
  }

  return NextResponse.json({ customer });
}
