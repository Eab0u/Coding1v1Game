import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth, database } from "../../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../../lib/auth";
import { loadResult } from "../../../../lib/results";
import { Results } from "../../../../components/results";
import Link from "next/link";
import { Card } from "../../../../components/ui";
export const runtime = "nodejs";
export default async function ResultsPage({params}:{params:Promise<{id:string}>}) {
  const { id } = await params;
  const recovery = <main id="main-content" className="shell ladder"><Card className="ladder-recovery">
    <div role="alert"><h1>Results unavailable</h1><p>We could not load this duel. Try again to refresh your result and rating change.</p></div>
    <a className="button button--primary" href={`/match/${encodeURIComponent(id)}/results`}>Retry results</a>
    <Link className="button button--secondary" href="/">Back to arena</Link>
  </Card></main>;
  let user;
  try { user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value); }
  catch { return recovery; }
  if (!user) redirect("/account");
  let result;
  try { result = await loadResult(database(),id,user.id); }
  catch { return recovery; }
  if (!result) notFound();
  return <Results result={result} matchId={id}/>;
}
