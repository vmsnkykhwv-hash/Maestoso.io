import type { NextConfig } from 'next'

// Für alle Seiten, auch die Gästeseiten auf den Domains der Betriebe:
// - frame-ancestors/X-Frame-Options: keine fremde Seite darf Login oder
//   Dashboard unsichtbar einbetten (Clickjacking). Maestoso bettet selbst
//   nichts per iframe ein.
// - HSTS bewusst ohne includeSubDomains: auf der Domain eines Betriebs
//   würde das auch dessen fremd gehostete Subdomains (z. B. Mail) betreffen.
const SICHERHEITS_HEADER = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SICHERHEITS_HEADER }]
  },
}

export default nextConfig
