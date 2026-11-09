import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth-server";
import { AuthError, SESSION_COOKIE, SESSION_SECONDS } from "../../../../lib/auth";
import { readBoundedText, requireSameOrigin } from "../../../../lib/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  const origin = requireSameOrigin(request);
  if (!origin) return new NextResponse("Forbidden", { status: 403 });
  if (!["signup", "login", "logout"].includes(action)) return new NextResponse("Not found", { status: 404 });
  const redirect = (error?: string) => NextResponse.redirect(new URL(`/account${error ? `?error=${encodeURIComponent(error)}` : ""}`, origin), 303);
  try {
    const oldToken = request.cookies.get(SESSION_COOKIE)?.value;
    let token = "";
    if (action === "logout") await auth.logout(oldToken);
    else {
      const text = await readBoundedText(request, 4096);
      if (text === null) return new NextResponse("Request too large", { status: 413 });
      const form = new URLSearchParams(text);
      token = (await auth.authenticate(action as "signup" | "login", form.get("username"), form.get("password"), oldToken)).token;
    }
    const response = redirect();
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: token ? SESSION_SECONDS : 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return redirect(error instanceof AuthError ? error.message : "Account service unavailable. Please try again later.");
  }
}
