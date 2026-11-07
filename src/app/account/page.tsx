import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "../../lib/auth-server";
import { SESSION_COOKIE } from "../../lib/auth";
import { RATING_TIERS, ratingTier } from "../../lib/profile";
import { Badge, Button, Card } from "../../components/ui";
import { Play } from "../../components/play";
import { PasswordField } from "../../components/password-field";
import { UsernameField } from "../../components/username-field";
import { accountFeedback } from "../../lib/account-feedback";
export const runtime = "nodejs";
async function accountState(token?: string) {
  try { return { user: await auth.current(token), unavailable: false }; }
  catch { return { user: null, unavailable: true }; }
}
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const feedback = accountFeedback(error);

  const result = await accountState((await cookies()).get(SESSION_COOKIE)?.value);
  const { user, unavailable } = result;
  return <div className="shell"><a className="skip-link" href="#account-main">Skip to account</a><header className="site-header"><Link href="/" className="brand">Code<span className="accent">Duel</span></Link><span>Player account</span></header>
    <main id="account-main" tabIndex={-1} className="account"><p className="eyebrow">YOUR NEXT RIVAL IS WAITING</p><h1>{user ? `Welcome, ${user.username}` : "Enter the arena."}</h1>
      {!unavailable && feedback && <div className="account-error" role="alert"><h2>Account action needs attention</h2><p>{feedback.message}</p><p>{feedback.guidance}</p></div>}
      {user && <aside className="account-refresh" aria-labelledby="account-refresh-title">
        <div><h2 id="account-refresh-title">Your account at a glance</h2><p id="account-refresh-note">Your MMR, tier and signed-in player reflect when this page loaded. Refresh after a completed duel or an account change in another tab to check the latest available state.</p></div>
        <a className="button button--secondary" href="/account" aria-describedby="account-refresh-note">Refresh account</a>
      </aside>}
      {unavailable ? <Card className="ladder-recovery">
        <div role="alert"><h2>Account service unavailable</h2><p>We could not check your account. Try again to refresh your session and player options.</p></div>
        {/* A document request rechecks the session instead of reusing cached account state. */}
        <a className="button button--primary" href="/account">Retry account</a>
        <Link className="button button--secondary" href="/">Back to arena</Link>
      </Card> : user ? <div className="account-grid"><Card className="account-play"><p className="eyebrow">READY FOR YOUR NEXT DUEL</p><h2>Your arena awaits</h2><div className="account-standing" aria-describedby="account-rating-note"><p className="account-rating"><strong>{Math.round(user.rating)}</strong> MMR</p><Badge tone="accent">{ratingTier(user.rating)}</Badge></div><p id="account-rating-note" className="account-rating-note">Your tier follows your current MMR at full precision. Displayed ratings are rounded.</p><details className="tier-guide">
          <summary>Explore rating tiers</summary>
          <p>Tier boundaries use your full rating, even when the displayed MMR rounds up. New players start in Bronze at 800 MMR.</p>
          <ul aria-label="Rating tier thresholds">{RATING_TIERS.map(tier => <li key={tier.name} className={ratingTier(user.rating) === tier.name ? "tier-guide-current" : undefined}>
            <strong>{tier.name}</strong><span>{tier.minimum}+ MMR</span>{ratingTier(user.rating) === tier.name && <span className="tier-guide-marker">Current tier</span>}
          </li>)}</ul>
          <p>Your tier can rise or fall after completed duels. Refresh this page to check your latest standing.</p>
        </details><p>Race an opponent on the same Python problem. Correctness comes first, then runtime and submission time.</p><Play signedIn /></Card>
        <Card><h2>Your player hub</h2><nav className="account-links" aria-label="Player account"><Link className="button button--secondary" href={`/profile/${encodeURIComponent(user.username)}`}>View your profile</Link><Link className="button button--secondary" href="/friends">Manage friends</Link><Link className="button button--secondary" href="/leaderboard">View leaderboard</Link></nav><form method="post" action="/api/auth/logout"><Button type="submit" variant="ghost">Sign out</Button></form></Card></div> :
        <><nav className="account-entry-nav" aria-label="Account options"><a className="button button--secondary" href="#account-login">Go to sign in</a><a className="button button--secondary" href="#account-signup">Go to create account</a></nav>
        <div className="account-grid">{(["login", "signup"] as const).map(mode => <Card key={mode}><h2 id={`account-${mode}`} tabIndex={-1}>{mode === "login" ? "Welcome back" : "Create your player"}</h2><p>{mode === "login" ? "Pick up where you left off." : "Start at 800. Earn every point."}</p>
          <form method="post" action={`/api/auth/${mode}`} className="account-form" aria-labelledby={`account-${mode}`}><UsernameField mode={mode} />
            <PasswordField mode={mode} /><Button type="submit">{mode === "login" ? "Sign in" : "Create account"}</Button><Button type="reset" variant="ghost">Clear form</Button></form></Card>)}</div></>}
    </main></div>;
}



