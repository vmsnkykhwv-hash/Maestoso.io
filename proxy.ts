import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth'
import { altePlattformAdresse, internerPfad, oeffentlicherPfadAus, ORG_HOST_HEADER } from '@/lib/gaestePfade'
import { ladeHostOrganisationPerId, ladeOrganisationFuerHost, oeffentlicherHost } from '@/lib/organisationen'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Der Header darf nur von hier aus gesetzt werden – kommt er schon vom
  // Client mit, wird er verworfen.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(ORG_HOST_HEADER)
  // Weiterleitungen nur für GET/HEAD: ein umgeleiteter POST (z. B. eine
  // Server Action) käme als GET an und ginge verloren.
  const umleitbar = request.method === 'GET' || request.method === 'HEAD'

  // Domain-basiertes Routing: Besucher einer Organisations-Subdomain (z. B.
  // musterbetrieb.<plattform-domain>) oder einer eigenen Domain (z. B.
  // musterbetrieb.de) sehen dort die Gästeseiten dieser Organisation unter
  // kurzen Pfaden (/reservieren, /impressum …), siehe lib/gaestePfade.ts.
  // Ohne gesetzte NEXT_PUBLIC_PLATTFORM_DOMAIN (lokale Entwicklung) bleibt
  // das komplett inaktiv.
  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  const istPlattformHost = !plattformDomain || host === plattformDomain || host === `www.${plattformDomain}`

  if (!istPlattformHost) {
    const organisation = await ladeOrganisationFuerHost(host, plattformDomain!)
    if (organisation) {
      // Sobald die eigene Domain funktioniert, soll niemand mehr die
      // Subdomain sehen – auch Suchmaschinen nicht (308 = dauerhaft).
      if (umleitbar && organisation.ueberSubdomain && organisation.customDomain && organisation.customDomainAktiv) {
        return NextResponse.redirect(`https://${organisation.customDomain}${pathname}${request.nextUrl.search}`, 308)
      }

      const oeffentlich = oeffentlicherPfadAus(pathname)
      if (oeffentlich !== null) {
        requestHeaders.set(ORG_HOST_HEADER, organisation.id)
        return NextResponse.rewrite(new URL(internerPfad(organisation.id, oeffentlich) + request.nextUrl.search, request.url), {
          request: { headers: requestHeaders },
        })
      }
    }
  } else if (plattformDomain && umleitbar) {
    // Alte Plattform-Adressen (maestoso.io/reservieren/<id> …) auf die Domain
    // des Betriebs umleiten, damit Gäste dort nur dessen Adresse sehen.
    const organisationId = altePlattformAdresse(pathname)
    if (organisationId) {
      const organisation = await ladeHostOrganisationPerId(organisationId)
      const zielHost = organisation && oeffentlicherHost(organisation, plattformDomain)
      if (zielHost) {
        return NextResponse.redirect(`https://${zielHost}${oeffentlicherPfadAus(pathname)}${request.nextUrl.search}`, 308)
      }
    }
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const sitzung = await verifySessionToken(token)

  // Öffentliche Gäste-Buchungs-/Bestellseiten – kein Login, jede
  // Organisation kann diese Links auf ihrer eigenen Website
  // verlinken/einbetten.
  if (
    pathname.startsWith('/reservieren') ||
    pathname.startsWith('/website') ||
    pathname.startsWith('/bestellen') ||
    pathname.startsWith('/gutschein/') ||
    pathname.startsWith('/veranstaltung/')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Impressum und Datenschutzerklärung der Plattform müssen ohne Login
  // erreichbar sein (§ 5 DDG: "leicht erkennbar, unmittelbar erreichbar").
  if (pathname === '/impressum' || pathname === '/datenschutz') {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // API-Routen (PayPal-/Resend-Webhook) prüfen sich selbst per
  // Signaturprüfung – ohne diese Ausnahme würde ein Request ohne
  // Login-Cookie (also jeder echte Webhook-Aufruf von außen) hier auf
  // /login umgeleitet statt den Route-Handler überhaupt zu erreichen.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (pathname === '/login') {
    if (sitzung) {
      return NextResponse.redirect(
        new URL(sitzung.typ === 'plattform-admin' ? '/plattform-admin' : '/dashboard', request.url)
      )
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!sitzung) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/plattform-admin') && sitzung.typ !== 'plattform-admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (pathname.startsWith('/dashboard') && sitzung.typ !== 'organisation') {
    return NextResponse.redirect(new URL('/plattform-admin', request.url))
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
