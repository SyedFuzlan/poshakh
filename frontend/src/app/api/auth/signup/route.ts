import { NextRequest, NextResponse } from "next/server";
import { createSignedCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

const BACKEND = process.env.API_URL ?? "http://localhost:9000";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, phone, email, password } = await req.json();

    const res = await fetch(`${BACKEND}/api/customers/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, email, password }),
    });

    const text = await res.text();
    let data: { success?: boolean; customer?: Record<string, unknown>; error?: string } = {};
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (!res.ok) {
      return NextResponse.json({ success: false, error: data.error ?? "Signup failed" }, { status: res.status });
    }

    const customer = data.customer as { id: string; email: string | null; phone: string | null; firstName: string; lastName: string };
    const response = NextResponse.json({ success: true, customer });
    response.cookies.set("poshakh_token", createSignedCookie(customer), COOKIE_OPTS);
    return response;
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
