'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSessionToken, pruefePlattformAdminPin, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth'
import { pinHashPruefen } from '@/lib/pinHash'
import { rateLimitFehlgeschlagen, rateLimitPruefen, rateLimitZuruecksetzen } from '@/lib/rateLimit'
import { getServiceClient } from '@/lib/supabase/server'

const SPERRE_AB_VERSUCHEN = 5

async function sitzungSetzen(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
}

function warteHinweis(wartenSekunden: number): string {
  const minuten = Math.ceil(wartenSekunden / 60)
  return `Zu viele Fehlversuche. Bitte in ${minuten} Minute${minuten === 1 ? '' : 'n'} erneut versuchen.`
}

export async function login(formData: FormData): Promise<{ fehler?: string }> {
  const modus = String(formData.get('modus') ?? 'organisation')
  const pin = String(formData.get('pin') ?? '')

  if (modus === 'plattform-admin') {
    const sperrschluessel = 'admin'
    const sperre = await rateLimitPruefen(sperrschluessel)
    if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

    if (!pruefePlattformAdminPin(pin)) {
      await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)
      return { fehler: 'Falscher PIN' }
    }

    await rateLimitZuruecksetzen(sperrschluessel)
    await sitzungSetzen(await createSessionToken({ typ: 'plattform-admin' }))
    redirect('/plattform-admin')
  }

  const loginCode = String(formData.get('loginCode') ?? '').trim().toLowerCase()
  if (!loginCode || !pin) {
    return { fehler: 'Zugangscode und PIN eingeben' }
  }

  // Sperre ist an den Zugangscode gebunden, nicht an die IP – ein Skript
  // kann sonst über wechselnde IPs trotzdem unbegrenzt denselben Code
  // durchprobieren.
  const sperrschluessel = `org:${loginCode}`
  const sperre = await rateLimitPruefen(sperrschluessel)
  if (!sperre.erlaubt) return { fehler: warteHinweis(sperre.wartenSekunden!) }

  const supabase = getServiceClient()
  const { data: organisation } = await supabase
    .from('organisationen')
    .select('id, pin_hash')
    .eq('login_code', loginCode)
    .maybeSingle()

  if (!organisation || !(await pinHashPruefen(pin, organisation.pin_hash as string))) {
    await rateLimitFehlgeschlagen(sperrschluessel, SPERRE_AB_VERSUCHEN)
    return { fehler: organisation ? 'Falscher PIN' : 'Unbekannter Zugangscode' }
  }

  await rateLimitZuruecksetzen(sperrschluessel)
  await sitzungSetzen(await createSessionToken({ typ: 'organisation', organisationId: organisation.id }))
  redirect('/dashboard')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect('/login')
}
