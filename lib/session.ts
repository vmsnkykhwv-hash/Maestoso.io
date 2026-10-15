import { cache } from 'react'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySessionToken, type Sitzung } from '@/lib/auth'
import { ladeKonto } from '@/lib/konten/daten'

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
// der rohen Sitzung: die Module fragen nur "welche Organisation, und darf
// diese Person verwalten?", nicht nach der Art des Cookies.
export type BetriebsSitzung = { organisationId: string; art: 'inhaber'; kontoId: string }

export const getBetriebsSitzung = cache(async (): Promise<BetriebsSitzung | null> => {
  const sitzung = await getSitzung()
  if (sitzung?.typ === 'inhaber') return { organisationId: sitzung.organisationId, art: 'inhaber', kontoId: sitzung.kontoId }
  return null
})
