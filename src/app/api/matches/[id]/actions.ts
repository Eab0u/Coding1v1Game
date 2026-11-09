import { NextRequest } from "next/server";
import { auth, database } from "../../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../../lib/auth";
import { matchAction, MatchActionError } from "../../../../lib/match-lifecycle";
import { RateLimit } from "../../../../lib/rate-limit";
import { readBoundedText, requireSameOrigin } from "../../../../lib/http";
// Unlike 'submit', 'ready' has no DB-enforced cap; throttle it here against scripted spam.
const readyLimit = new RateLimit(10, 10_000);
export async function POST(request: NextRequest, { params }: { params: Promise<{id:string}> }) {
  const headers = {"Cache-Control":"private, no-store"};
  if (!requireSameOrigin(request)) return Response.json({error:'Forbidden'},{status:403,headers});
  try {
    const user = await auth.current(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return Response.json({error:'Sign in required.'},{status:401,headers});
    const text = await readBoundedText(request, 270000);
    if (text === null) return Response.json({error:'Request too large.'},{status:413,headers});
    let body;
    try { body = JSON.parse(text); } catch { return Response.json({error:'Invalid request.'},{status:400,headers}); }
    if (!body || !['ready','submit'].includes(body.action) || (body.action==='submit' && typeof body.source!=='string')) return Response.json({error:'Invalid request.'},{status:400,headers});
    const matchId = (await params).id;
    if (body.action === 'ready' && !readyLimit.allow(`${user.id}:${matchId}`)) return Response.json({error:'Too many requests.'},{status:429,headers});
    const result = await matchAction(database(),matchId,user.id,body.action,body.source);
    return Response.json(result,{status:200,headers});
  } catch (error) {
    return Response.json({error:error instanceof MatchActionError ? error.message : 'Match service unavailable.'},{status:error instanceof MatchActionError ? error.status : 503,headers});
  }
}
