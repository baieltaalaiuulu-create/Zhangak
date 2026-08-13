'use client'

import ReactDOM from 'react-dom'

// Preconnect/dns-prefetch hints for every external origin a page actually
// talks to. Deliberately NOT literal <link rel="preconnect"> tags inside a
// <head> element — the documented way to inject these in the App Router is
// via these ReactDOM methods (React hoists them into <head> regardless of
// where in the tree they're called from); see the "Resource hints" section
// of the metadata docs. They only work from a Client Component, which is
// why this is its own small mounted-in-the-root-layout component rather
// than something in the (Server Component) RootLayout itself.
export default function ResourceHints() {
  // The CSS host for the @import in app/landing/page.tsx and
  // app/math/page.tsx's own <style> blocks (this app doesn't use
  // next/font/google, so there's no built-in preconnect for these).
  // gstatic.com is the actual font-file host those stylesheets reference —
  // not in the original ask, but preconnecting only the CSS host and not
  // the file host it immediately points to would miss most of the benefit.
  ReactDOM.preconnect('https://fonts.googleapis.com')
  ReactDOM.preconnect('https://fonts.gstatic.com', { crossOrigin: 'anonymous' })
  return null
}
