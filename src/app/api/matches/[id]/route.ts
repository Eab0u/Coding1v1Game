import { cookies } from "next/headers";
import { auth, database } from "../../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../../lib/auth";
import { loadArena } from "../../../../lib/arena";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) return Response.json({error:"Sign in to view this match."},{status:401,headers});
    const match = await loadArena(database(), (await params).id, user.id);
    return Response.json(match ?? {error:"Match not found."},{status:match ? 200 : 404,headers});
  } catch { return Response.json({error:"Match service unavailable."},{status:503,headers}); }
}
export { POST } from "./actions";
