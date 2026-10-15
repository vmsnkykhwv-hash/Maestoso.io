'use server'

import { cookies } from 'next/headers'
import QRCode from 'qrcode'
import { GERAET_COOKIE_NAME, GERAET_GUELTIGKEIT_SEKUNDEN, geraeteTokenErstellen, type GeraeteToken } from '@/lib/geraete/auth'
import {
  geraetAnlegen,
  geraetWiderrufen,
  kopplungscodeEinloesen,
  kopplungscodeErstellen,
  kopplungscodePruefen,
  ladeGeraeteDerOrganisation,
  type Geraet,
} from '@/lib/geraete/daten'
import { ladeMitarbeiter } from '@/lib/mitarbeiter/daten'
import { MITARBEITER_MODULE } from '@/lib/mitarbeiter/types'
import type { ModulSchluessel } from '@/lib/module'
import { pinHashPruefen } from '@/lib/pinHash'
import { rateLimitFehlgeschlagen, rateLimitPruefen, rateLimitZuruecksetzen, warteHinweis } from '@/lib/rateLimit'
import { teamUrl } from '@/lib/url'
import { benutzerAnlegen, ladeBenutzerDerOrganisation, type BenutzerUebersicht } from '@/lib/konten/einladung'
import { einladungVerschicken } from '@/lib/konten/einladungVersand'
import { ladeKonto, sitzungenBeenden } from '@/lib/konten/daten'
import { getBetriebsSitzung } from '@/lib/session'
import { getServiceClient } from '@/lib/supabase/server'
import { protokollieren } from '@/lib/protokoll'
import { verwaltungBenachrichtigen } from '@/lib/konten/sicherheitshinweis'

async function inhaberOderFehler() {
  const sitzung = await getBetriebsSitzung()
  if (sitzung?.art !== 'inhaber') throw new Error('Keine Berechtigung')
  return sitzung
}

async function eigenerName(kontoId: string): Promise<string> {
  const konto = await ladeKonto('benutzer', kontoId)
  return konto ? `${konto.name || konto.email} (${konto.email})` : 'ein Verwaltungskonto'
}

export async function kontoEinladenAktion(
  email: string,
  name: string
): Promise<{ fehler?: string; link?: string; versendet?: boolean; benutzer?: BenutzerUebersicht[] }> {
  const sitzung = await inhaberOderFehler()
  const angelegt = await benutzerAnlegen(sitzung.organisationId, email, name)
  if (!angelegt.benutzerId) return { fehler: angelegt.fehler }
  const einladung = await einladungVerschicken(sitzung.organisationId, angelegt.benutzerId, email)
  await protokollieren('zugaenge', 'Verwaltungskonto eingeladen', email, angelegt.benutzerId)
  await verwaltungBenachrichtigen(sitzung.organisationId, `Neues Verwaltungskonto eingeladen: ${name.trim() || email}`, await eigenerName(sitzung.kontoId), [
    sitzung.kontoId,
    angelegt.benutzerId,
  ])
  return { ...einladung, benutzer: await ladeBenutzerDerOrganisation(sitzung.organisationId) }
}

export async function kontoEinladungErneuernAktion(benutzerId: string): Promise<{ fehler?: string; link?: string; versendet?: boolean }> {
  const sitzung = await inhaberOderFehler()
  const konto = await ladeKonto('benutzer', benutzerId)
  if (!konto || konto.organisationId !== sitzung.organisationId) return { fehler: 'Konto nicht gefunden.' }
  if (konto.passwortHash) return { fehler: 'Das Konto ist schon eingerichtet.' }
  return einladungVerschicken(sitzung.organisationId, benutzerId, konto.email)
}

// Sich selbst zu sperren ginge nur aus Versehen – und dann käme niemand
// mehr ins Dashboard, wenn es das einzige Konto ist.
export async function kontoAktivSetzenAktion(benutzerId: string, aktiv: boolean): Promise<{ fehler?: string; benutzer?: BenutzerUebersicht[] }> {
  const sitzung = await inhaberOderFehler()
  if (benutzerId === sitzung.kontoId) return { fehler: 'Das eigene Konto kann nicht gesperrt werden.' }
  const konto = await ladeKonto('benutzer', benutzerId)
  if (!konto || konto.organisationId !== sitzung.organisationId) return { fehler: 'Konto nicht gefunden.' }

  const { error } = await getServiceClient().from('benutzer').update({ aktiv }).eq('id', benutzerId).eq('organisation_id', sitzung.organisationId)
  if (error) return { fehler: error.message }
  if (!aktiv) await sitzungenBeenden(konto)
  await protokollieren('zugaenge', 'Verwaltungskonto gesperrt/entsperrt', `${konto.email}: ${aktiv ? 'entsperrt' : 'gesperrt'}`, benutzerId)
  await verwaltungBenachrichtigen(
    sitzung.organisationId,
    `Verwaltungskonto ${konto.email} ${aktiv ? 'entsperrt' : 'gesperrt'}`,
    await eigenerName(sitzung.kontoId),
    [sitzung.kontoId]
  )
  return { benutzer: await ladeBenutzerDerOrganisation(sitzung.organisationId) }
}

// ---------- Geräte ----------

async function geraeteCookieSetzen(token: GeraeteToken) {
  const cookieStore = await cookies()
  cookieStore.set(GERAET_COOKIE_NAME, await geraeteTokenErstellen(token), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: GERAET_GUELTIGKEIT_SEKUNDEN,
    path: '/',
  })
}

// Die Inhaberin meldet sich einmal am Tablet an und gibt es frei – danach
// kann sie sich dort wieder abmelden, das Tablet bleibt Tresen-Gerät.
export async function tresenFreigebenAktion(name: string): Promise<{ fehler?: string; geraete?: Geraet[] }> {
  const sitzung = await inhaberOderFehler()
  const geraet = await geraetAnlegen({ organisationId: sitzung.organisationId, art: 'tresen', name, erstelltVon: sitzung.kontoId })
  await geraeteCookieSetzen({ geraetId: geraet.id, organisationId: sitzung.organisationId, art: 'tresen' })
  await protokollieren('zugaenge', 'Tresen-Gerät freigegeben', name, geraet.id)
  return { geraete: await ladeGeraeteDerOrganisation(sitzung.organisationId) }
}

// Wirkt sofort: jede Anfrage prüft das Gerät gegen die Datenbank.
export async function geraetEntziehenAktion(geraetId: string): Promise<{ fehler?: string; geraete?: Geraet[] }> {
  const sitzung = await inhaberOderFehler()
  if (!(await geraetWiderrufen(sitzung.organisationId, geraetId))) return { fehler: 'Gerät nicht gefunden.' }
  await protokollieren('zugaenge', 'Gerät entzogen', null, geraetId)
  return { geraete: await ladeGeraeteDerOrganisation(sitzung.organisationId) }
}

export async function handyKoppelnAktion(mitarbeiterId: string): Promise<{ fehler?: string; link?: string; qrSvg?: string }> {
  const sitzung = await inhaberOderFehler()
  const mitarbeiter = await ladeMitarbeiter(mitarbeiterId, sitzung.organisationId)
  if (!mitarbeiter?.aktiv) return { fehler: 'Mitarbeiter*in nicht gefunden.' }
  const code = await kopplungscodeErstellen(sitzung.organisationId, mitarbeiterId)
  const link = await teamUrl(sitzung.organisationId, `/koppeln?code=${encodeURIComponent(code)}`)
  const qrSvg = await QRCode.toString(link, { type: 'svg', margin: 1, width: 200 })
  await protokollieren('zugaenge', 'Handy-Kopplung gestartet', mitarbeiter.name, mitarbeiterId)
  return { link, qrSvg }
}

// Vom Handy selbst aus: Kopplung aufheben (z. B. Handy wird verkauft).
export async function geraetEntkoppelnAktion(): Promise<void> {
  const sitzung = await getBetriebsSitzung()
  if (sitzung?.art === 'handy') await geraetWiderrufen(sitzung.organisationId, sitzung.geraetId)
  const cookieStore = await cookies()
  cookieStore.delete(GERAET_COOKIE_NAME)
}

// Auf dem Handy der Mitarbeiterin: Code aus dem QR-Link + eigene PIN. Die PIN
// muss zu genau der Person passen, für die der Code erstellt wurde – sonst
// könnte, wer einen fremden QR-Code abfotografiert, ihn mit der eigenen PIN
// für sich nutzen.
export async function handyKopplungAbschliessenAktion(
  organisationId: string,
  code: string,
  pin: string,
  geraetName: string
): Promise<{ fehler?: string }> {
  const sperrschluessel = `kopplung:${organisationId}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const gefunden = await kopplungscodePruefen(code, organisationId)
  if (!gefunden) return { fehler: 'Der QR-Code ist abgelaufen oder wurde schon benutzt. Bitte einen neuen erstellen lassen.' }

  const { data } = await getServiceClient()
    .from('mitarbeiter')
    .select('pin_hash, aktiv')
    .eq('id', gefunden.mitarbeiterId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!data?.aktiv || !(await pinHashPruefen(pin, data.pin_hash as string))) {
    await rateLimitFehlgeschlagen(sperrschluessel, 5)
    return { fehler: 'Falscher PIN' }
  }
  await rateLimitZuruecksetzen(sperrschluessel)
  if (!(await kopplungscodeEinloesen(gefunden.id))) return { fehler: 'Der QR-Code wurde gerade schon benutzt.' }

  const geraet = await geraetAnlegen({ organisationId, art: 'handy', name: geraetName || 'Handy', mitarbeiterId: gefunden.mitarbeiterId })
  await geraeteCookieSetzen({ geraetId: geraet.id, organisationId, art: 'handy' })
  return {}
}

// Freischaltung je Tool: welche Module diese Person am Tresen bzw. auf dem
// Handy sieht. Nur bekannte Mitarbeiter-Module, egal was der Client schickt.
export async function mitarbeiterModuleSetzenAktion(mitarbeiterId: string, module: ModulSchluessel[]): Promise<{ fehler?: string }> {
  const sitzung = await inhaberOderFehler()
  const erlaubt = module.filter((m) => MITARBEITER_MODULE.includes(m))
  const { data, error } = await getServiceClient()
    .from('mitarbeiter')
    .update({ module: erlaubt })
    .eq('id', mitarbeiterId)
    .eq('organisation_id', sitzung.organisationId)
    .select('id')
  if (error) return { fehler: error.message }
  if (!data?.length) return { fehler: 'Mitarbeiter*in nicht gefunden.' }
  await protokollieren('zugaenge', 'Tools geändert', erlaubt.join(', ') || 'keine', mitarbeiterId)
  return {}
}
