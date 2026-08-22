import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { DELETE, GET, HttpError, PATCH, POST, readJson } from '../http.js'

const STUDENT_ROLES = new Set(['student', 'math_student'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function student(config, req) {
  const user = await requireAuth(config, req)
  if (!STUDENT_ROLES.has(user.role) || (user.role === 'student' && user.student_type !== 'online')) throw new HttpError(403, 'Доступно только ученику онлайн-курса', 'online_student_required')
  return user
}
function exact(body, keys, code) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== [...keys].sort().join(',')) throw new HttpError(400, 'Некорректные данные', code)
}
function id(value, code) { if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, 'Некорректный идентификатор', code); return value }
function profile(row) { return { publicProfileId: row.public_profile_id, displayName: row.display_name, profileColor: row.profile_color, xp: Number(row.xp ?? 0), friendshipId: row.friendship_id, status: row.status, createdAt: row.created_at } }

GET('/v1/platform/community/friends', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query(
    `SELECT f.id friendship_id, f.status, f.created_at, p.public_profile_id, p.profile_color, COALESCE(t.xp_total,0) xp,
            COALESCE(NULLIF(p.community_display_name,''), 'Ученик-' || upper(substr(replace(p.public_profile_id::text,'-',''),1,5))) display_name
       FROM student_social_friendships f
       JOIN profiles p ON p.user_id = CASE WHEN f.requester_id=$1 THEN f.recipient_id ELSE f.requester_id END
       LEFT JOIN student_xp_totals t ON t.student_id=p.user_id
      WHERE (f.requester_id=$1 OR f.recipient_id=$1) AND f.status='accepted'
        AND NOT EXISTS (SELECT 1 FROM student_social_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1))
      ORDER BY t.xp_total DESC NULLS LAST, p.public_profile_id LIMIT 100`, [user.id])
  return { status: 200, body: { items: result.rows.map(profile) } }
})

GET('/v1/platform/community/friend-requests', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query(
    `SELECT f.id friendship_id, f.status, f.created_at, f.recipient_id=$1 incoming, p.public_profile_id, p.profile_color,
            COALESCE(NULLIF(p.community_display_name,''), 'Ученик-' || upper(substr(replace(p.public_profile_id::text,'-',''),1,5))) display_name
       FROM student_social_friendships f JOIN profiles p ON p.user_id=CASE WHEN f.requester_id=$1 THEN f.recipient_id ELSE f.requester_id END
      WHERE (f.requester_id=$1 OR f.recipient_id=$1) AND f.status='pending'
      ORDER BY f.created_at DESC LIMIT 50`, [user.id])
  return { status: 200, body: { items: result.rows.map(row => ({ ...profile(row), incoming: row.incoming })) } }
})

POST('/v1/platform/community/friend-requests', async ({ req, config }) => {
  const user = await student(config, req); const body = await readJson(req, 1000); exact(body, ['publicProfileId'], 'invalid_friend_request'); const targetId = id(body.publicProfileId, 'invalid_public_profile_id')
  const created = await transaction(async client => {
    const target = await client.query(`SELECT user_id FROM profiles WHERE public_profile_id=$1 AND community_profile_visibility <> 'private' AND community_discoverable=true AND community_allow_friend_requests=true FOR UPDATE`, [targetId])
    const targetUser = target.rows[0]?.user_id
    if (!targetUser) throw new HttpError(404, 'Профиль недоступен для дружбы', 'friend_target_not_found')
    if (targetUser === user.id) throw new HttpError(400, 'Нельзя отправить запрос себе', 'friend_self_request')
    const blocked = await client.query(`SELECT 1 FROM student_social_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`, [user.id, targetUser])
    if (blocked.rows[0]) throw new HttpError(404, 'Профиль недоступен для дружбы', 'friend_target_not_found')
    const rate = await client.query(`SELECT count(*)::int count FROM student_social_friendships WHERE requester_id=$1 AND created_at > now()-interval '24 hours'`, [user.id])
    if (rate.rows[0].count >= 20) throw new HttpError(429, 'Лимит запросов на сегодня исчерпан', 'friend_request_rate_limited')
    const count = await client.query(`SELECT count(*)::int count FROM student_social_friendships WHERE (requester_id=$1 OR recipient_id=$1) AND status='accepted'`, [user.id])
    if (count.rows[0].count >= 100) throw new HttpError(409, 'Достигнут лимит друзей', 'friend_limit_reached')
    const insert = await client.query(`INSERT INTO student_social_friendships (requester_id,recipient_id) VALUES ($1,$2) RETURNING id`, [user.id,targetUser])
    await client.query(`INSERT INTO audit_log (actor_user_id,action,target_type,target_id,metadata) VALUES ($1,'request_friendship','friendship',$2,'{}'::jsonb)`,[user.id,insert.rows[0].id])
    return insert.rows[0].id
  }).catch(error => { if (error?.code==='23505') throw new HttpError(409,'Запрос или дружба уже существуют','friendship_exists'); throw error })
  return { status: 201, body: { friendshipId: created, status: 'pending' } }
})

PATCH('/v1/platform/community/friend-requests/:friendshipId/accept', async ({ req, params, config }) => {
  const user = await student(config, req); exact(await readJson(req, 1000), [], 'invalid_friend_accept'); const friendshipId=id(params.friendshipId,'invalid_friendship_id')
  const result=await query(`UPDATE student_social_friendships SET status='accepted',responded_at=now(),updated_at=now() WHERE id=$1 AND recipient_id=$2 AND status='pending' RETURNING id`,[friendshipId,user.id])
  if(!result.rows[0]) throw new HttpError(404,'Запрос не найден','friend_request_not_found')
  return {status:200,body:{friendshipId,status:'accepted'}}
})

PATCH('/v1/platform/community/friend-requests/:friendshipId/decline', async ({ req, params, config }) => {
  const user=await student(config,req); exact(await readJson(req,1000),[],'invalid_friend_decline'); const friendshipId=id(params.friendshipId,'invalid_friendship_id')
  const result=await query(`UPDATE student_social_friendships SET status='declined',responded_at=now(),updated_at=now() WHERE id=$1 AND recipient_id=$2 AND status='pending' RETURNING id`,[friendshipId,user.id])
  if(!result.rows[0]) throw new HttpError(404,'Запрос не найден','friend_request_not_found')
  return {status:200,body:{friendshipId,status:'declined'}}
})

DELETE('/v1/platform/community/friends/:friendshipId', async ({ req, params, config }) => {
  const user=await student(config,req); const friendshipId=id(params.friendshipId,'invalid_friendship_id')
  const result=await query(`UPDATE student_social_friendships SET status='cancelled',updated_at=now() WHERE id=$1 AND status IN ('pending','accepted') AND (requester_id=$2 OR recipient_id=$2) RETURNING id`,[friendshipId,user.id])
  if(!result.rows[0]) throw new HttpError(404,'Дружба не найдена','friendship_not_found')
  return {status:200,body:{removed:true}}
})

POST('/v1/platform/community/blocks', async ({ req, config }) => {
  const user=await student(config,req); const body=await readJson(req,1000); exact(body,['publicProfileId'],'invalid_block'); const targetProfile=id(body.publicProfileId,'invalid_public_profile_id')
  await transaction(async client=>{ const target=await client.query(`SELECT user_id FROM profiles WHERE public_profile_id=$1`,[targetProfile]); const targetId=target.rows[0]?.user_id; if(!targetId||targetId===user.id) throw new HttpError(400,'Некорректный профиль','invalid_block'); await client.query(`INSERT INTO student_social_blocks (blocker_id,blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[user.id,targetId]); await client.query(`UPDATE student_social_friendships SET status='cancelled',updated_at=now() WHERE status IN ('pending','accepted') AND ((requester_id=$1 AND recipient_id=$2) OR (requester_id=$2 AND recipient_id=$1))`,[user.id,targetId]); await client.query(`INSERT INTO audit_log (actor_user_id,action,target_type,target_id,metadata) VALUES ($1,'block_community_profile','profile',$2,'{}'::jsonb)`,[user.id,targetId]) })
  return {status:200,body:{blocked:true}}
})

DELETE('/v1/platform/community/blocks/:publicProfileId', async ({ req, params, config }) => {
  const user=await student(config,req); const targetProfile=id(params.publicProfileId,'invalid_public_profile_id'); await query(`DELETE FROM student_social_blocks b USING profiles p WHERE b.blocker_id=$1 AND b.blocked_id=p.user_id AND p.public_profile_id=$2`,[user.id,targetProfile]); return {status:200,body:{blocked:false}}
})
