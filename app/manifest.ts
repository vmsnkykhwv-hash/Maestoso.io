import type { MetadataRoute } from 'next'

// Damit Tresen-Tablet und Mitarbeiter-Handy Maestoso wie eine App vom
// Homescreen öffnen. Relative start_url: gilt auf jeder Domain eines
// Betriebs, ohne Maestoso in der Adresse.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Maestoso',
    short_name: 'Maestoso',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#faf7f0',
    theme_color: '#1b2340',
    lang: 'de',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
