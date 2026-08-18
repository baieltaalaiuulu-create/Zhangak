import type { MetadataRoute } from 'next'

const baseUrl = 'https://zhangak.com'

// Only the public marketing host is indexable. Authenticated platform and
// administration routes are deliberately absent and noindex at the host
// boundary.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/math`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
