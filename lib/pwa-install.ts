// Shared types/helpers for the PWA install experience — no React here so
// both the provider and any server-safe code can import it freely.

// Not in lib.dom yet — Chromium-only event fired when the browser decides
// the site is installable.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// The bottom-sheet banner's own "don't show again" flag (set on install,
// dismiss, or once the full-screen first-login overlay has already made
// the pitch — no need to immediately repeat it in a second surface).
export const INSTALL_DISMISSED_KEY = 'zhangak-install-dismissed'
// Tracks whether the full-screen "install now" overlay has been shown at
// least once for this browser — fires the first time a student reaches
// the cabinet with no key set yet, not strictly tied to account age.
export const FIRST_LOGIN_SHOWN_KEY = 'zhangak-first-login-shown'

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS 13+ reports as "MacIntel" but has touch support, unlike a real Mac.
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return isIOS() || /Android/i.test(navigator.userAgent)
}

// beforeinstallprompt only fires on Chromium-based browsers (Chrome, Edge,
// Samsung Internet, Opera, ...), and doing so isn't instant — there's no
// direct "this browser doesn't support it" signal, so the Settings page's
// "not supported" state is driven by this UA capability check rather than
// "the event hasn't fired yet" (which would also be true for a supported
// browser in the first second or two after load).
export function supportsInstallPrompt(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (!/Chrome|Chromium|Edg\/|SamsungBrowser|OPR\//i.test(ua)) return false
  // Chrome on iOS (CriOS) still uses Apple's WebKit under the hood and
  // never gets beforeinstallprompt — iOS always goes through the manual
  // Share-sheet flow regardless of which browser shell it's running in.
  return !/CriOS|FxiOS|EdgiOS/i.test(ua)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}
