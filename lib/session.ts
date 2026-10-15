import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySessionToken, type Sitzung } from '@/lib/auth'
import { ORG_HOST_HEADER } from '@/lib/gaestePfade'
import { GERAET_COOKIE_NAME, geraeteTokenPruefen } from '@/lib/geraete/auth'
import { geraetGesehen, ladeGeraet } from '@/lib/geraete/daten'
import { ladeKonto } from '@/lib/konten/daten'
import { MITARBEITER_COOKIE_NAME, verifyMitarbeiterToken } from '@/lib/mitarbeiter/auth'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import type { Mitarbeiter } from '@/lib/mitarbeiter/types'
import type { ModulSchluessel } from '@/lib/module'

// Nur in Server Components/Actions verwendbar (next/headers) – proxy.ts
// liest den Cookie direkt über NextRequest und prüft nur die Signatur.
// Hier zusätzlich gegen die Datenbank: gesperrtes Konto, geänderte Version
// (Passwort geändert, 2FA zurückgesetzt) oder falsche Organisation machen die
// Sitzung sofort ungültig, auch wenn der Cookie noch nicht abgelaufen ist.
// cache(): pro Anfrage nur einmal nachschlagen, auch wenn Layout, Seite und
// Komponenten getSitzung() mehrfach aufrufen.
export const getSitzung = cache(async (): Promise<Sitzung | null> => {
  const cookieStore = await cookies()
  const sitzung = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  if (!sitzung) return null

  if (sitzung.typ === 'plattform-admin' || sitzung.typ === 'inhaber') {
    const konto = await ladeKonto(sitzung.typ === 'plattform-admin' ? 'admin' : 'benutzer', sitzung.kontoId)
    if (!konto || !konto.aktiv || !konto.totpAktiv || konto.sitzungVersion !== sitzung.version) return null
    if (sitzung.typ === 'inhaber' && konto.organisationId !== sitzung.organisationId) return null
  }
  return sitzung
})

// Wer im Dashboard eines Betriebs arbeitet. Bewusst eine eigene Form statt
// der rohen Cookies: die Module fragen nur "welche Organisation, wer genau,
// und darf diese Person das?" (siehe lib/zugriff.ts).
export type MitarbeiterKurz = { id: string; name: string; rolle: Mitarbeiter['rolle']; module: ModulSchluessel[] }

export type BetriebsSitzung =
  | { art: 'inhaber'; organisationId: string; kontoId: string }
  // Tresen-Gerät: freigegeben, aber erst mit Mitarbeiter-PIN benutzbar.
  | { art: 'tresen'; organisationId: string; geraetId: string; geraetName: string; mitarbeiter: MitarbeiterKurz | null }
  | { art: 'handy'; organisationId: string; geraetId: string; mitarbeiter: MitarbeiterKurz }

function kurz(m: Mitarbeiter): MitarbeiterKurz {
  return { id: m.id, name: m.name, rolle: m.rolle, module: m.module }
}

export const getBetriebsSitzung = cache(async (): Promise<BetriebsSitzung | null> => {
  const ergebnis = await betriebsSitzungErmitteln()
  // Zusätzlich zu proxy.ts: kommt die Anfrage über die Domain eines
  // Betriebs, gilt nur eine Sitzung genau dieses Betriebs.
  const hostOrganisation = (await headers()).get(ORG_HOST_HEADER)
  if (ergebnis && hostOrganisation && hostOrganisation !== ergebnis.organisationId) return null
  return ergebnis
})

async function betriebsSitzungErmitteln(): Promise<BetriebsSitzung | null> {
  // Ein Verwaltungskonto hat Vorrang: meldet sich die Inhaberin am
  // Tresen-Tablet an, arbeitet sie dort mit ihren vollen Rechten.
  const sitzung = await getSitzung()
  if (sitzung?.typ === 'inhaber') return { art: 'inhaber', organisationId: sitzung.organisationId, kontoId: sitzung.kontoId }

  const cookieStore = await cookies()
  const token = await geraeteTokenPruefen(cookieStore.get(GERAET_COOKIE_NAME)?.value)
  if (!token) return null
  const geraet = await ladeGeraet(token.geraetId)
  // Entzogen, umgezogen oder manipuliert: sofort keine Sitzung mehr.
  if (!geraet || geraet.widerrufen || geraet.organisationId !== token.organisationId || geraet.art !== token.art) return null
  await geraetGesehen(geraet)

  if (geraet.art === 'handy') {
    const mitarbeiter = geraet.mitarbeiterId ? await ladeMitarbeiter(geraet.mitarbeiterId, geraet.organisationId) : null
    if (!mitarbeiter?.aktiv) return null
    return { art: 'handy', organisationId: geraet.organisationId, geraetId: geraet.id, mitarbeiter: kurz(mitarbeiter) }
  }

  const pinSitzung = await verifyMitarbeiterToken(cookieStore.get(MITARBEITER_COOKIE_NAME)?.value)
  const mitarbeiter =
    pinSitzung && pinSitzung.organisationId === geraet.organisationId
      ? await ladeMitarbeiter(pinSitzung.mitarbeiterId, geraet.organisationId)
      : null
  return {
    art: 'tresen',
    organisationId: geraet.organisationId,
    geraetId: geraet.id,
    geraetName: geraet.name,
    mitarbeiter: mitarbeiter?.aktiv ? kurz(mitarbeiter) : null,
  }
}
