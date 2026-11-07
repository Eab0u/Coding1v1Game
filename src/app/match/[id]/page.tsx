import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth, database } from "../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../lib/auth";
import { loadArena } from "../../../lib/arena";
import { Arena } from "../../../components/arena";
import Link from "next/link";
import { Card } from "../../../components/ui";
export const runtime = "nodejs";
export default async function MatchPage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  const recovery = <main id="main-content" className="shell ladder"><Card className="ladder-recovery">
    <div role="alert"><h1>Arena unavailable</h1><p>We could not load this duel. Retry to check its current state before playing.</p></div>
    <a className="button button--primary" href={`/match/${encodeURIComponent(id)}`}>Retry duel</a>
    <Link className="button button--secondary" href="/">Back to arena</Link>
  </Card></main>;
  let user;
  try { user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value); }
  catch { return recovery; }
  if (!user) redirect("/account");
  let match;
  try { match = await loadArena(database(),id,user.id); }
  catch { return recovery; }
  if (!match) notFound();
  return <Arena initial={match}/>;
}
