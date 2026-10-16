import type { MetadataRoute } from 'next'
import { PREISE_OEFFENTLICH } from '@/lib/preise'

// Nur die Plattform-Website; die Seiten der Betriebe laufen unter deren
// eigener Domain und gehören nicht in diese Sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const domain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  if (!domain) return []
  const basis = `https://${domain}`
  return [
    { url: `${basis}/`, changeFrequency: 'monthly', priority: 1 },
    ...(PREISE_OEFFENTLICH ? [{ url: `${basis}/preise`, changeFrequency: 'monthly' as const, priority: 0.8 }] : []),
    { url: `${basis}/impressum`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${basis}/datenschutz`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
