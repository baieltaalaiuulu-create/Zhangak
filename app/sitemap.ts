import type { MetadataRoute } from 'next'

const baseUrl = 'https://zhangak.com'

// Only real, publicly-reachable routes belong here. Login lives as a modal
// on the landing page (there is no separate /login route in this app), so
// the home page entry below already covers that intent.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
