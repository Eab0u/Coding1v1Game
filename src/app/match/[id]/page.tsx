import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth, database } from "../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../lib/auth";
import { loadArena } from "../../../lib/arena";
import { Arena } from "../../../components/arena";
export const runtime = "nodejs";
export default async function MatchPage({params}:{params:Promise<{id:string}>}) {
  const user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/account");
  const match = await loadArena(database(),(await params).id,user.id);
  if (!match) notFound();
  return <Arena initial={match}/>;
}
