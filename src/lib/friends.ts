import type { AuthDatabase } from "./auth";

export type FriendEntry = { username: string; rating: number; status: "pending" | "accepted"; incoming: boolean };
export async function loadFriends(db: AuthDatabase, userId: string): Promise<FriendEntry[]> {
  return (await db.query<FriendEntry>(`SELECT u.username, u.rating, f.status, (f.recipient_id=$1) AS incoming
    FROM friendships f JOIN users u ON u.id=CASE WHEN f.requester_id=$1 THEN f.recipient_id ELSE f.requester_id END
    WHERE f.requester_id=$1 OR f.recipient_id=$1 ORDER BY f.status, lower(u.username)`, [userId])).rows;
}

export async function changeFriend(db: AuthDatabase, userId: string, action: string, username: string) {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) throw new Error("Invalid username");
  if (action === "request") {
    // Reciprocal requests remain pending until the recipient explicitly accepts.
    const result = await db.query(`INSERT INTO friendships (requester_id,recipient_id)
      SELECT $1,id FROM users WHERE lower(username)=lower($2) AND id<>$1
      ON CONFLICT DO NOTHING RETURNING requester_id`, [userId, username]);
    if (!result.rows.length) return "No request sent. Check the username or your existing relationships.";
  } else if (action === "accept") {
    await db.query(`UPDATE friendships SET status='accepted' WHERE recipient_id=$1 AND status='pending'
      AND requester_id=(SELECT id FROM users WHERE lower(username)=lower($2))`, [userId, username]);
  } else if (action === "remove") {
    await db.query(`DELETE FROM friendships WHERE
      (requester_id=$1 AND recipient_id=(SELECT id FROM users WHERE lower(username)=lower($2))) OR
      (recipient_id=$1 AND requester_id=(SELECT id FROM users WHERE lower(username)=lower($2)))`, [userId, username]);
  } else throw new Error("Invalid action");
  return "Friend list updated.";
}
