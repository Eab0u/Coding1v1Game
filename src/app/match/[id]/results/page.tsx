import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth, database } from "../../../../lib/auth-server";
import { SESSION_COOKIE } from "../../../../lib/auth";
import { loadResult } from "../../../../lib/results";
import { Results } from "../../../../components/results";
export const runtime = "nodejs";
export default async function ResultsPage({params}:{params:Promise<{id:string}>}) {
  const user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/account");
  let result;
  try { result = await loadResult(database(),(await params).id,user.id); }
  catch { return <main id="main-content" className="shell"><p role="alert">Results unavailable. Please try again.</p></main>; }
  if (!result) notFound();
  return <Results result={result} matchId={(await params).id}/>;
}
