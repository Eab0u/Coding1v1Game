import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "../../lib/auth-server";
import { SESSION_COOKIE } from "../../lib/auth";
import { Button, Card } from "../../components/ui";
import { Play } from "../../components/play";
export const runtime = "nodejs";
async function accountState(token?: string) {
  try { return { user: await auth.current(token), unavailable: false }; }
  catch { return { user: null, unavailable: true }; }
}
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  const result = await accountState((await cookies()).get(SESSION_COOKIE)?.value);
  const { user, unavailable } = result;
  return <div className="shell"><header className="site-header"><Link href="/" className="brand">Code<span className="accent">Duel</span></Link><span>Player account</span></header>
    <main className="account"><p className="eyebrow">YOUR NEXT RIVAL IS WAITING</p><h1>{user ? `Welcome, ${user.username}` : "Enter the arena."}</h1>
      {error && <p role="alert">{error.slice(0, 200)}</p>}
      {unavailable && <p role="alert">Account service unavailable. Please try again later.</p>}
      {user ? <div className="account-grid"><Card className="account-play"><p className="eyebrow">READY FOR YOUR NEXT DUEL</p><h2>Your arena awaits</h2><p className="account-rating"><strong>{Math.round(user.rating)}</strong> current rating</p><p>Race an opponent on the same Python problem. Correctness comes first, then runtime and submission time.</p><Play signedIn /></Card>
        <Card><h2>Your player hub</h2><nav className="account-links" aria-label="Player account"><Link className="button button--secondary" href={`/profile/${encodeURIComponent(user.username)}`}>View your profile</Link><Link className="button button--secondary" href="/friends">Manage friends</Link><Link className="button button--secondary" href="/leaderboard">View leaderboard</Link></nav><form method="post" action="/api/auth/logout"><Button type="submit" variant="ghost">Sign out</Button></form></Card></div> :
        <div className="account-grid">{(["login", "signup"] as const).map(mode => <Card key={mode}><h2>{mode === "login" ? "Welcome back" : "Create your player"}</h2><p>{mode === "login" ? "Pick up where you left off." : "Start at 800. Earn every point."}</p>
          <form method="post" action={`/api/auth/${mode}`} className="account-form"><label htmlFor={`${mode}-username`}>Username</label><input id={`${mode}-username`} name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" />
            <label htmlFor={`${mode}-password`}>Password</label><input id={`${mode}-password`} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={256} aria-describedby={`${mode}-hint`} /><p id={`${mode}-hint`}>At least 12 characters; up to 256 bytes.</p><Button type="submit">{mode === "login" ? "Sign in" : "Create account"}</Button></form></Card>)}</div>}
    </main></div>;
}



