import Link from "next/link";
import { cookies } from "next/headers";
import { auth, database } from "../../lib/auth-server";
import { SESSION_COOKIE } from "../../lib/auth";
import { loadFriends, type FriendEntry } from "../../lib/friends";
import { Button, Card } from "../../components/ui";
export const dynamic = "force-dynamic";
export default async function Friends({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  let user = null;
  let entries: FriendEntry[] = [];
  let unavailable = false;
  try {
    user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
    if (user) entries = await loadFriends(database(), user.id);
  } catch { unavailable = true; }
  const { message } = await searchParams;
  return <div className="shell"><header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link><Link href="/leaderboard?scope=friends">Friends standings</Link></header>
    <main className="account"><p className="eyebrow">BETTER WITH RIVALS</p><h1>Your circle.</h1><p className="intro">Add friends, follow their climb, and find your next rival.</p>
      {message && <p role="status">{message.slice(0, 200)}</p>}
      {unavailable ? <p role="alert">Friends unavailable. Please try again later.</p> : !user ? <Link href="/account">Sign in to manage friends</Link> : <>
        <Card><h2>Invite a player</h2><form className="account-form" method="post" action="/api/friends"><input type="hidden" name="action" value="request"/><label htmlFor="friend-username">Player username</label><input id="friend-username" name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}"/><Button type="submit">Send friend request</Button></form></Card>
        <div className="friend-list">{entries.length ? entries.map(entry => <Card key={entry.username}><h2><Link href={`/profile/${entry.username}`}>{entry.username}</Link></h2><p>{entry.status === "accepted" ? "Friends" : entry.incoming ? "Wants to be your friend" : "Request sent"}</p>
          <form className="friend-actions" method="post" action="/api/friends"><input type="hidden" name="username" value={entry.username}/>{entry.incoming && entry.status === "pending" && <Button name="action" value="accept">Accept</Button>}<Button variant="secondary" name="action" value="remove">{entry.status === "accepted" ? "Remove friend" : entry.incoming ? "Decline" : "Cancel request"}</Button></form>
        </Card>) : <p>No friends yet. Send a request to start your circle.</p>}</div>
      </>}
    </main></div>;
}
