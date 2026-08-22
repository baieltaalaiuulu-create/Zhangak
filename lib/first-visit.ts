/**
 * Small, defensive browser-storage helpers for optional first-visit UI.
 * They are intentionally not authentication or consent mechanisms: required
 * security cookies are handled by the API and must work even if local storage
 * is unavailable. These flags only remember that a visitor dismissed a guide.
 */
export const COOKIE_INFORMATION_DISMISSED_KEY = 'zhangak-cookie-information-v1'
export const MARKETING_TOUR_DISMISSED_KEY = 'zhangak-marketing-tour-v1'
export const PLATFORM_ONBOARDING_DISMISSED_KEY = 'zhangak-onboarding-done'
export const FIRST_VISIT_DISMISSED_EVENT = 'zhangak:first-visit-dismissed'

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

export function wasDismissed(storage: BrowserStorage, key: string): boolean {
  try {
    return storage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function markDismissed(storage: BrowserStorage, key: string): void {
  try {
    storage.setItem(key, '1')
  } catch {
    // Private browsing or a storage policy may reject writes. The guide stays
    // optional and the rest of the product must remain fully usable.
  }
}

export function shouldShowCookieInformation(storage: BrowserStorage): boolean {
  return wasDismissed(storage, MARKETING_TOUR_DISMISSED_KEY)
    && !wasDismissed(storage, COOKIE_INFORMATION_DISMISSED_KEY)
}
