import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth'
import { GERAET_COOKIE_NAME, geraeteTokenPruefen } from '@/lib/geraete/auth'
import {
  altePlattformAdresse,
  internerPfad,
  internerTeamPfad,
  oeffentlicherPfadAus,
  ORG_HOST_HEADER,
} from '@/lib/gaestePfade'
import { ladeHostOrganisationPerId, ladeOrganisationFuerHost, oeffentlicherHost } from '@/lib/organisationen'

// Zwei Arten von Adressen:
// - Plattform-Domain (maestoso.io): Plattform-Admin (/login, /plattform-admin),
//   Impressum/Datenschutz der Plattform, Webhooks.
// - Domain eines Betriebs (Subdomain oder eigene Domain): Gästeseiten unter
//   kurzen Pfaden, Team-Anmeldung unter /team, Dashboard unter /dashboard.
// Ohne NEXT_PUBLIC_PLATTFORM_DOMAIN (lokale Entwicklung) gibt es nur die
// Plattform-Adresse mit den internen Pfaden (/team/<id>, /reservieren/<id> …).
//
// Hier wird nur die Signatur der Sitzung geprüft (Edge-Runtime, keine
// Datenbank für Konten) – ob das Konto noch gültig ist, prüft lib/session.ts
// in jeder Seite und Server Action.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Der Header darf nur von hier aus gesetzt werden – kommt er schon vom
  // Client mit, wird er verworfen.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(ORG_HOST_HEADER)
  const weiter = () => NextResponse.next({ request: { headers: requestHeaders } })
  const umschreiben = (ziel: string) =>
    NextResponse.rewrite(new URL(ziel + search, request.url), { request: { headers: requestHeaders } })
  // Weiterleitungen nur für GET/HEAD: ein umgeleiteter POST (z. B. eine
  // Server Action) käme als GET an und ginge verloren.
  const umleitbar = request.method === 'GET' || request.method === 'HEAD'

  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  let hostOrganisationId: string | null = null

  if (plattformDomain && host !== plattformDomain && host !== `www.${plattformDomain}`) {
    const organisation = await ladeOrganisationFuerHost(host, plattformDomain)
    if (organisation) {
      // Sobald die eigene Domain funktioniert, soll niemand mehr die
      // Subdomain sehen – auch Suchmaschinen nicht (308 = dauerhaft).
      if (umleitbar && organisation.ueberSubdomain && organisation.customDomain && organisation.customDomainAktiv) {
        return NextResponse.redirect(`https://${organisation.customDomain}${pathname}${search}`, 308)
      }
      hostOrganisationId = organisation.id
      requestHeaders.set(ORG_HOST_HEADER, organisation.id)

      const teamPfad = internerTeamPfad(organisation.id, pathname)
      if (teamPfad) return umschreiben(teamPfad)

      const oeffentlich = oeffentlicherPfadAus(pathname)
      if (oeffentlich !== null) return umschreiben(internerPfad(organisation.id, oeffentlich))
    }
    // Unbekannter Host (z. B. eine Vercel-Vorschau-URL): wie die Plattform behandeln.
  } else if (plattformDomain && umleitbar) {
    // Alte bzw. interne Adressen (maestoso.io/reservieren/<id>, /team/<id> …)
    // auf die Domain des Betriebs umleiten – dort gelten Sitzungen und
    // Gäste sehen nur dessen Adresse.
    const organisationId = altePlattformAdresse(pathname)
    if (organisationId) {
      const organisation = await ladeHostOrganisationPerId(organisationId)
      const zielHost = organisation && oeffentlicherHost(organisation, plattformDomain)
      if (zielHost) {
        const teile = pathname.split('/').filter(Boolean)
        const ziel = teile[0] === 'team' ? `/${['team', ...teile.slice(2)].join('/')}` : oeffentlicherPfadAus(pathname)
        return NextResponse.redirect(`https://${zielHost}${ziel}${search}`, 308)
      }
    }
  }

  // API-Routen (PayPal-/Resend-Webhook) prüfen sich selbst per
  // Signaturprüfung – ohne diese Ausnahme würde ein Request ohne
  // Login-Cookie (also jeder echte Webhook-Aufruf von außen) hier auf
  // /login umgeleitet statt den Route-Handler überhaupt zu erreichen.
  if (pathname.startsWith('/api/')) return weiter()

  const sitzung = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)
  const geraet = await geraeteTokenPruefen(request.cookies.get(GERAET_COOKIE_NAME)?.value)

  if (hostOrganisationId) {
    const sitzungDiesesBetriebs = sitzung?.typ === 'inhaber' && sitzung.organisationId === hostOrganisationId
    const geraetDiesesBetriebs = geraet?.organisationId === hostOrganisationId
    // Bereits angemeldet: /team direkt ins Dashboard. Nur bei normalen
    // Seitenaufrufen – nicht bei der Server Action, die die Anmeldung gerade
    // abschließt, sonst verschwände die Anzeige der Wiederherstellungscodes.
    // Ein Tresen-Gerät darf /team dagegen sehen: dort meldet sich die
    // Inhaberin an, um es zu verwalten.
    if (umleitbar && pathname === '/team' && (sitzungDiesesBetriebs || (geraet?.art === 'handy' && geraetDiesesBetriebs))) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Auf der Domain eines Betriebs gilt nur eine Sitzung genau dieses
    // Betriebs – ein Cookie von Betrieb A öffnet nie das Dashboard von B.
    if (pathname.startsWith('/dashboard')) {
      if (!sitzungDiesesBetriebs && !geraetDiesesBetriebs) {
        return NextResponse.redirect(new URL('/team', request.url))
      }
    }
    return weiter()
  }

  // Ab hier: Plattform-Adresse.
  if (
    pathname.startsWith('/reservieren') ||
    pathname.startsWith('/website') ||
    pathname.startsWith('/bestellen') ||
    pathname.startsWith('/gutschein/') ||
    pathname.startsWith('/veranstaltung/') ||
    pathname.startsWith('/team/') ||
    // Impressum und Datenschutzerklärung der Plattform müssen ohne Login
    // erreichbar sein (§ 5 DDG: "leicht erkennbar, unmittelbar erreichbar").
    pathname === '/impressum' ||
    pathname === '/datenschutz'
  ) {
    return weiter()
  }

  if (pathname === '/login') {
    if (umleitbar && sitzung?.typ === 'plattform-admin') return NextResponse.redirect(new URL('/plattform-admin', request.url))
    return weiter()
  }

  if (pathname.startsWith('/plattform-admin') && sitzung?.typ !== 'plattform-admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Nur in der lokalen Entwicklung erreichbar (im Betrieb läuft das Dashboard
  // unter der Domain des Betriebs, wo der Cookie gesetzt wurde).
  if (pathname.startsWith('/dashboard') && sitzung?.typ !== 'inhaber' && !geraet) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return weiter()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
