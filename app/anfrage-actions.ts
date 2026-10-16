'use server'

import { adminEmails, anfrageSpeichern, type AnfrageArt, type Tageszeit } from '@/lib/anfragen/daten'
import { anfrageMelden } from '@/lib/anfragen/email'
import { oeffentlicheAnfrageSchluessel, rateLimitFehlgeschlagen, rateLimitPruefen, warteHinweis } from '@/lib/rateLimit'
import { plattformUrl } from '@/lib/url'

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ARTEN: AnfrageArt[] = ['demo', 'frage', 'sonstiges']
const TAGESZEITEN: Tageszeit[] = ['vormittags', 'nachmittags', 'abends']

export type AnfrageEingabe = {
  art: string
  name: string
  betrieb: string
  email: string
  telefon: string
  wunschtag: string
  tageszeit: string
  nachricht: string
  // Spamschutz: ein für Menschen unsichtbares Feld, das Bots ausfüllen,
  // und der Zeitpunkt, zu dem das Formular angezeigt wurde.
  firma: string
  angezeigtUm: number
}

function kuerzen(wert: string, max: number): string | null {
  const t = wert.trim()
  return t ? t.slice(0, max) : null
}

export async function anfrageSendenAktion(e: AnfrageEingabe): Promise<{ fehler?: string; ok?: boolean }> {
  // Bots bekommen dieselbe Erfolgsmeldung – sonst lernen sie, was sie ändern müssen.
  if (e.firma.trim() || Date.now() - e.angezeigtUm < 3000) return { ok: true }

  const art = ARTEN.includes(e.art as AnfrageArt) ? (e.art as AnfrageArt) : null
  if (!art) return { fehler: 'Bitte wähle, worum es geht.' }
  const name = kuerzen(e.name, 80)
  if (!name) return { fehler: 'Bitte gib deinen Namen an.' }
  const email = e.email.trim().toLowerCase()
  if (!EMAIL_MUSTER.test(email) || email.length > 120) return { fehler: 'Bitte gib eine gültige E-Mail-Adresse an.' }
  const nachricht = kuerzen(e.nachricht, 3000)
  if (art !== 'demo' && !nachricht) return { fehler: 'Bitte schreib kurz, worum es geht.' }

  let wunschtag: string | null = null
  if (art === 'demo' && e.wunschtag) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.wunschtag)) return { fehler: 'Bitte wähle einen gültigen Wunschtag.' }
    const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
    if (e.wunschtag < heute) return { fehler: 'Der Wunschtag liegt in der Vergangenheit.' }
    wunschtag = e.wunschtag
  }
  const tageszeit = art === 'demo' && TAGESZEITEN.includes(e.tageszeit as Tageszeit) ? (e.tageszeit as Tageszeit) : null

  // Pro IP höchstens wenige Anfragen am Stück – genug für einen Menschen,
  // der sich vertippt hat, zu wenig für eine Spamwelle.
  const sperrschluessel = await oeffentlicheAnfrageSchluessel('anfrage', 'plattform')
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }
  await rateLimitFehlgeschlagen(sperrschluessel, 4)

  const anfrage = {
    art,
    name,
    betrieb: kuerzen(e.betrieb, 120),
    email,
    telefon: kuerzen(e.telefon, 40),
    wunschtag,
    tageszeit,
    nachricht,
  }
  if (!(await anfrageSpeichern(anfrage))) {
    return { fehler: 'Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal oder schreib uns eine Mail.' }
  }
  await anfrageMelden(await adminEmails(), anfrage, `${await plattformUrl()}/plattform-admin/anfragen`)
  return { ok: true }
}
