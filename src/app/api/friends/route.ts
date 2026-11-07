import { NextRequest, NextResponse } from "next/server";
import { auth, database } from "../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../lib/auth";
import { changeFriend } from "../../../lib/friends";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = process.env.APP_ORIGIN || (process.env.NODE_ENV !== "production" ? request.nextUrl.origin : "");
  if (!origin || request.headers.get("origin") !== origin) return new NextResponse("Forbidden", { status: 403 });
  const redirect = (message: string) => NextResponse.redirect(new URL(`/friends?message=${encodeURIComponent(message)}`, origin), 303);
  try {
    const user = await auth.current(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return new NextResponse("Sign in required", { status: 401 });
    if (Number(request.headers.get("content-length")) > 1024) return new NextResponse("Request too large", { status: 413 });
    const text = await request.text();
    if (Buffer.byteLength(text) > 1024) return new NextResponse("Request too large", { status: 413 });
    const form = new URLSearchParams(text);
    const action = form.get("action") ?? "";
    const username = form.get("username") ?? "";
    if (!["request", "accept", "remove"].includes(action) || !/^[A-Za-z0-9_]{3,24}$/.test(username)) return new NextResponse("Invalid request", { status: 400 });
    return redirect(await changeFriend(database(), user.id, action, username));
  } catch { return redirect("Friends unavailable. Please try again later."); }
}
