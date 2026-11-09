import { NextRequest } from 'next/server';
import { auth, database } from '../../../../../lib/auth-server';
import { SESSION_COOKIE } from '../../../../../lib/auth';
import { rematch, RematchError } from '../../../../../lib/rematch';
import { requireSameOrigin } from '../../../../../lib/http';
export const runtime='nodejs';
async function handle(request: NextRequest, context: {params:Promise<{id:string}>}, action: string) {
  const headers={'Cache-Control':'private, no-store'};
  try {
    const user=await auth.current(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return Response.json({error:'Sign in required.'},{status:401,headers});
    return Response.json(await rematch(database(),(await context.params).id,user.id,action),{headers});
  } catch(error) {
    return Response.json({error:error instanceof RematchError?error.message:'Rematch service unavailable.'},{status:error instanceof RematchError?error.status:503,headers});
  }
}
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}) { return handle(request,context,'view'); }
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
  if (!requireSameOrigin(request)) return Response.json({error:'Forbidden'},{status:403});
  // Actions are a fixed allowlist in the URL; no request body is read.
  const action=request.nextUrl.searchParams.get('action')??'';
  if (!['invite','accept','decline','cancel'].includes(action)) return Response.json({error:'Invalid action.'},{status:400});
  return handle(request,context,action);
}
