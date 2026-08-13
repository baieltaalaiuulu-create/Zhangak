import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'
import { hashPassword } from '../src/security.js'

const email = process.env.ZHANGAK_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ZHANGAK_ADMIN_PASSWORD
const fullName = process.env.ZHANGAK_ADMIN_NAME?.trim()
if (!email || !password || !fullName) {
  throw new Error('ZHANGAK_ADMIN_EMAIL, ZHANGAK_ADMIN_PASSWORD and ZHANGAK_ADMIN_NAME are required')
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid administrator email')

const config = loadConfig()
connectDatabase(config)
try {
  const passwordHash = await hashPassword(password)
  const id = await transaction(async client => {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rowCount > 0) throw new Error('Account already exists')
    const user = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash],
    )
    const userId = user.rows[0].id
    await client.query(
      `INSERT INTO profiles (user_id, full_name, role)
       VALUES ($1, $2, 'super_admin')`,
      [userId, fullName],
    )
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id)
       VALUES ($1, 'bootstrap_super_admin', 'user', $2)`,
      [userId, userId],
    )
    return userId
  })
  console.log(JSON.stringify({ created: true, id }))
} finally {
  await closeDatabase()
}
