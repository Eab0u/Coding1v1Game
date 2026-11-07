import Link from "next/link";
import { cookies } from "next/headers";
import { auth, database } from "../../lib/auth-server";
import { SESSION_COOKIE } from "../../lib/auth";
import { loadFriends, type FriendEntry } from "../../lib/friends";
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
  return <div className="shell"><header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link><Link href="/leaderboard?scope=friends">Friends standings</Link></header>
    <main className="account"><p className="eyebrow">BETTER WITH RIVALS</p><h1>Your circle.</h1><p className="intro">Add friends, follow their climb, and find your next rival.</p>
      {message && <p role="status">{message.slice(0, 200)}</p>}
      {unavailable ? <Card className="ladder-recovery">
        <div role="alert"><h2>Friends unavailable</h2><p>We could not load your circle. Try again to refresh your friends and invitations.</p></div>
        <a className="button button--primary" href="/friends">Retry friends</a>
        <Link className="button button--secondary" href="/">Back to arena</Link>
      </Card> : !user ? <Link href="/account">Sign in to manage friends</Link> : <>
        <Card><h2>Invite a player</h2><form className="account-form" method="post" action="/api/friends"><input type="hidden" name="action" value="request"/><UsernameField mode="friend" /><Button type="submit">Send friend request</Button></form></Card>
        <div className="friend-groups">{groups.map(group => <section key={group.id} aria-labelledby={`friends-${group.id}`}>
          <h2 className="friend-group-title" id={`friends-${group.id}`}>{group.title} <Badge tone={group.id === "incoming" && group.entries.length ? "accent" : "neutral"}>{group.entries.length}</Badge></h2>
          {group.entries.length ? <ul className="friend-list">{group.entries.map(entry => <li key={entry.username}><Card><h3><Link href={`/profile/${entry.username}`}>{entry.username}</Link></h3><p>{entry.status === "accepted" ? "Friends" : entry.incoming ? "Wants to be your friend" : "Request sent"}</p>
            <form aria-label={`Manage ${entry.username}`} className="friend-actions" method="post" action="/api/friends"><input type="hidden" name="username" value={entry.username}/>{entry.incoming && entry.status === "pending" && <Button type="submit" name="action" value="accept">Accept</Button>}<Button type="submit" variant="secondary" name="action" value="remove">{entry.status === "accepted" ? "Remove friend" : entry.incoming ? "Decline" : "Cancel request"}</Button></form>
          </Card></li>)}</ul> : <p className="friend-empty">{group.empty}</p>}
        </section>)}</div>
      </>}
    </main></div>;
}
