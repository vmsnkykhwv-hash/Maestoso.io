import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth'
import { ladeOrganisationIdFuerHost } from '@/lib/organisationen'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Domain-basiertes Routing fürs Website-Modul: Besucher einer
  // Organisations-Subdomain (z. B. cafedoa.<plattform-domain>) oder einer
  // eigenen, nachträglich eingetragenen Domain (z. B. cafedoa.de) sehen
  // dort ausschließlich die öffentliche Website dieser Organisation – nie
  // Login/Dashboard. Ohne gesetzte NEXT_PUBLIC_PLATTFORM_DOMAIN (lokale
  // Entwicklung) bleibt das komplett inaktiv.
  const plattformDomain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN
  const host = request.headers.get('host') ?? ''
  if (plattformDomain && host !== plattformDomain && host !== `www.${plattformDomain}`) {
    const organisationId = await ladeOrganisationIdFuerHost(host, plattformDomain)
    if (organisationId) {
      return NextResponse.rewrite(new URL(`/website/${organisationId}`, request.url))
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
    pathname.startsWith('/veranstaltung/')
  ) {
    return NextResponse.next()
  }

  // API-Routen (PayPal-/Resend-Webhook) prüfen sich selbst per
  // Signaturprüfung – ohne diese Ausnahme würde ein Request ohne
  // Login-Cookie (also jeder echte Webhook-Aufruf von außen) hier auf
  // /login umgeleitet statt den Route-Handler überhaupt zu erreichen.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (pathname === '/login') {
    if (sitzung) {
      return NextResponse.redirect(
        new URL(sitzung.typ === 'plattform-admin' ? '/plattform-admin' : '/dashboard', request.url)
      )
    }
    return NextResponse.next()
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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
