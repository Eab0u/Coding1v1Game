import Link from "next/link";
import { cookies } from "next/headers";
import { auth, database } from "../../lib/auth-server";
import { SESSION_COOKIE } from "../../lib/auth";
import { loadFriends, type FriendEntry } from "../../lib/friends";
import { ratingTier } from "../../lib/profile";
import { Badge, Button, Card } from "../../components/ui";
import { UsernameField } from "../../components/username-field";
export const dynamic = "force-dynamic";
export default async function Friends({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  let user = null;
  let entries: FriendEntry[] = [];
  let unavailable = false;
  try {
    user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
    if (user) entries = await loadFriends(database(), user.id);
  } catch { unavailable = true; }
  const groups = [
    { id: "incoming", title: "Incoming requests", empty: "No requests waiting for your reply.", entries: entries.filter(entry => entry.status === "pending" && entry.incoming) },
    { id: "accepted", title: "Your friends", empty: "No friends yet. Send a request to start your circle.", entries: entries.filter(entry => entry.status === "accepted") },
    { id: "outgoing", title: "Sent requests", empty: "No outstanding invitations.", entries: entries.filter(entry => entry.status === "pending" && !entry.incoming) },
  ];
  const { message } = await searchParams;
  const feedback = message === "Friend list updated." ? { title: "Friend list updated", detail: "Your action was processed. Review your friends and invitations below." }
    : message === "No request sent. Check the username or your existing relationships." ? { title: "No request sent", detail: "Check the player username and your incoming, sent and accepted relationships below before trying again." }
    : message === "Friends unavailable. Please try again later." ? { title: "Action could not be confirmed", detail: "Review your current friends and invitations below before trying again." }
    : null;
  return <div className="shell"><a className="skip-link" href="#main-content">Skip to friends</a><header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link><Link href="/leaderboard?scope=friends">Friends standings</Link></header>
    <main className="account" id="main-content" tabIndex={-1}><p className="eyebrow">BETTER WITH RIVALS</p><h1>Your circle.</h1><p className="intro">Add friends, follow their climb, and find your next rival.</p>
      {feedback && user && !unavailable && <Card className="friend-feedback"><div role="status"><h2>{feedback.title}</h2><p>{feedback.detail}</p></div></Card>}
      {unavailable ? <Card className="ladder-recovery">
        <div role="alert"><h2>Friends unavailable</h2><p>We could not load your circle. Try again to refresh your friends and invitations.</p></div>
        <a className="button button--primary" href="/friends">Retry friends</a>
        <Link className="button button--secondary" href="/">Back to arena</Link>
      </Card> : !user ? <Card className="ladder-empty">
        <p className="eyebrow">BUILD YOUR CIRCLE</p><h2>Keep your rivals close.</h2>
        <p>Sign in or create a player account to invite friends, respond to requests and compare your ratings in friends standings. Friendships begin when the other player accepts.</p>
        <div className="ladder-empty-actions"><Link className="button button--primary" href="/account">Sign in to manage friends</Link><Link className="button button--secondary" href="/leaderboard">Explore public standings</Link></div>
      </Card> : <>
        <nav className="friend-jumps" aria-label="Friend sections">
          {groups.map(group => <a key={group.id} href={`#friend-section-${group.id}`} className={group.id === "incoming" && group.entries.length ? "friend-jump friend-jump--pending" : "friend-jump"}>
            <span>{group.title}</span>{" "}<Badge tone={group.id === "incoming" && group.entries.length ? "accent" : "neutral"}>{group.entries.length}</Badge>
          </a>)}
        </nav>
        <Card className="friend-guide">
          <h2>How your circle works</h2>
          <dl>
            <div><dt>Invitations need a reply</dt><dd>Sending a request does not add a friend. The recipient must choose Accept, even if you both send requests.</dd></div>
            <div><dt>You control your requests</dt><dd>Decline dismisses an incoming invitation. Cancel request withdraws an invitation you sent.</dd></div>
            <div><dt>Removing ends the friendship</dt><dd>Remove friend removes the relationship for both players. To reconnect, send a new invitation and wait for acceptance.</dd></div>
          </dl>
          <p>Friends standings compare accepted friends and your own rating. Pending invitations do not count.</p><p id="friend-rating-note">Player cards show current MMR rounded to a whole number. Tiers use the full rating before rounding.</p>
        </Card>
        <Card><h2>Invite a player</h2><form className="account-form" method="post" action="/api/friends"><input type="hidden" name="action" value="request"/><UsernameField mode="friend" /><Button type="submit">Send friend request</Button></form></Card>
        <div className="friend-groups">{groups.map(group => <section key={group.id} id={`friend-section-${group.id}`} tabIndex={-1} className="friend-section" aria-labelledby={`friends-${group.id}`}>
          <h2 className="friend-group-title" id={`friends-${group.id}`}>{group.title} <Badge tone={group.id === "incoming" && group.entries.length ? "accent" : "neutral"}>{group.entries.length}</Badge></h2>
          {group.entries.length ? <ul className="friend-list">{group.entries.map(entry => <li key={entry.username}><Card><h3><Link className="standings-player" aria-label={`View ${entry.username}'s profile`} href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link></h3><div className="friend-rating" aria-describedby="friend-rating-note"><strong>{Math.round(entry.rating)} <span>MMR</span></strong><Badge tone="accent">{ratingTier(entry.rating)}</Badge></div><p>{entry.status === "accepted" ? "Friends" : entry.incoming ? "Wants to be your friend" : "Request sent"}</p>
            <form aria-label={`Manage ${entry.username}`} className="friend-actions" method="post" action="/api/friends"><input type="hidden" name="username" value={entry.username}/>{entry.incoming && entry.status === "pending" && <Button type="submit" name="action" value="accept" aria-label={`Accept: ${entry.username}`}>Accept</Button>}<Button type="submit" variant="secondary" name="action" value="remove" aria-label={`${entry.status === "accepted" ? "Remove friend" : entry.incoming ? "Decline" : "Cancel request"}: ${entry.username}`}>{entry.status === "accepted" ? "Remove friend" : entry.incoming ? "Decline" : "Cancel request"}</Button></form>
          </Card></li>)}</ul> : <p className="friend-empty">{group.empty}</p>}
        </section>)}</div>
      </>}
    </main></div>;
}
