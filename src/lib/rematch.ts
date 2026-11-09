import type { Pool } from "pg";
import { reserveMatch } from "./matchmaking-store";
import { difficultyFor } from "./matchmaking";
import { transaction } from "./db";

export class RematchError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export type RematchState = { status: string; outgoing: boolean; expiresAt: string | null; matchId: string | null; serverNow?: string };
export async function rematch(db: Pool, id: string, userId: string, action = 'view'): Promise<RematchState> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new RematchError('Match not found.',404);
  if (!['view','invite','accept','decline','cancel'].includes(action)) throw new RematchError('Invalid action.',400);
  return transaction(db, async c => {
    // Serialize every invitation action, including duplicate acceptance.
    const {rows:[m]} = await c.query(`SELECT player_one_id,player_two_id FROM matches WHERE id=$1
      AND $2 IN (player_one_id,player_two_id) AND status='completed' AND completed_at<=now() FOR UPDATE`,[id,userId]);
    if (!m) throw new RematchError('Match not found.',404);
    let {rows:[inv]} = await c.query('SELECT *, expires_at<=clock_timestamp() AS expired FROM rematch_invitations WHERE match_id=$1',[id]);
    if (action==='invite' && !inv) {
      const result = await c.query('INSERT INTO rematch_invitations(match_id,sender_id) VALUES ($1,$2) RETURNING *,false AS expired',[id,userId]);
      inv=result.rows[0];
    } else if (action!=='view') {
      if (!inv) throw new RematchError('No invitation.');
      if (inv.status==='accepted' && action==='accept' && inv.sender_id!==userId) {
        // A retried acceptance recovers the same reservation.
      } else {
        if (inv.status!=='pending' || inv.expired) throw new RematchError('Invitation is no longer available.');
        const outgoing=inv.sender_id===userId;
        if ((action==='accept' || action==='decline') && outgoing || action==='cancel' && !outgoing)
          throw new RematchError('Only the opponent can respond; only the sender can cancel.',403);
        if (action==='invite') {
          if (!outgoing) throw new RematchError('Accept the existing invitation.');
        } else if (action==='accept') {
          const {rows:players} = await c.query('SELECT id,username,rating FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[m.player_one_id,m.player_two_id]]);
          const {rows:[fresh]} = await c.query('SELECT expires_at>clock_timestamp() AS valid FROM rematch_invitations WHERE match_id=$1',[id]);
          if (!fresh.valid) throw new RematchError('Invitation is no longer available.');
          let ticket;
          try { ticket=await reserveMatch(c,players[0],players[1],difficultyFor((players[0].rating+players[1].rating)/2)); }
          catch { throw new RematchError('Both players must be available and a published problem must exist.'); }
          inv.status='accepted'; inv.rematch_id=ticket.id;
          await c.query("UPDATE rematch_invitations SET status='accepted',rematch_id=$2 WHERE match_id=$1",[id,ticket.id]);
        } else {
          inv.status=action==='decline'?'declined':'cancelled';
          await c.query('UPDATE rematch_invitations SET status=$2 WHERE match_id=$1',[id,inv.status]);
        }
      }
    }
    const {rows:[clock]} = await c.query('SELECT clock_timestamp() AS now');
    return {status:!inv?'none':inv.status==='pending' && inv.expired?'expired':inv.status,
      outgoing:inv?.sender_id===userId,expiresAt:inv?new Date(inv.expires_at).toISOString():null,matchId:inv?.rematch_id??null,serverNow:new Date(clock.now).toISOString()};
  });
}
