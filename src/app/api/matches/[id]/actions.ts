import { NextRequest } from "next/server";
import { auth, database } from "../../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../../lib/auth";
import { matchAction, MatchActionError } from "../../../../lib/match-lifecycle";
export async function POST(request: NextRequest, { params }: { params: Promise<{id:string}> }) {
  const headers = {"Cache-Control":"private, no-store"};
  const origin = process.env.APP_ORIGIN || (process.env.NODE_ENV !== 'production' ? request.nextUrl.origin : '');
  if (!origin || request.headers.get('origin') !== origin) return Response.json({error:'Forbidden'},{status:403,headers});
  try {
    const user = await auth.current(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return Response.json({error:'Sign in required.'},{status:401,headers});
    // Bound the streamed body even when Content-Length is absent or forged.
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) { try { while (true) { const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 270000) { await reader.cancel(); return Response.json({error:'Request too large.'},{status:413,headers}); } chunks.push(value);
    } } finally { reader.releaseLock(); } }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return Response.json({error:'Invalid request.'},{status:400,headers}); }
    if (!body || !['ready','submit'].includes(body.action) || (body.action==='submit' && typeof body.source!=='string')) return Response.json({error:'Invalid request.'},{status:400,headers});
    const result = await matchAction(database(),(await params).id,user.id,body.action,body.source);
    return Response.json(result,{status:200,headers});
  } catch (error) {
    return Response.json({error:error instanceof MatchActionError ? error.message : 'Match service unavailable.'},{status:error instanceof MatchActionError ? error.status : 503,headers});
  }
}
