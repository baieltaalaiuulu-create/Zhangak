import webPush from 'web-push'

export function pushEnabled(config) {
  return Boolean(config.vapidSubject && config.vapidPublicKey && config.vapidPrivateKey)
}

export async function sendPush(config, subscription, payload) {
  if (!pushEnabled(config)) throw new Error('Web Push is not configured')
  webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey)
  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
    },
    JSON.stringify(payload),
    { TTL: 3_600, urgency: 'normal' },
  )
}

export function expiredPushEndpoint(error) {
  return error && typeof error === 'object' && [404, 410].includes(error.statusCode)
}

