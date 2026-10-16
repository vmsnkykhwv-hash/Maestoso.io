import type { MetadataRoute } from 'next'
import { RECHTSTEXTE_VOLLSTAENDIG } from '@/lib/rechtliches/plattform'

// Gilt auf allen Domains (Plattform und Betriebe): Gästeseiten dürfen in die
// Suche, Anmeldung, Dashboard und Verwaltung nie. Solange das Impressum der
// Plattform Platzhalter hat, bleibt die Plattform-Website ganz draußen.
export default function robots(): MetadataRoute.Robots {
  const domain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/plattform-admin', '/login', '/team', '/konto', '/anmeldung', '/api', ...(RECHTSTEXTE_VOLLSTAENDIG ? [] : ['/preise'])],
    },
    ...(domain ? { sitemap: `https://${domain}/sitemap.xml` } : {}),
  }
}
