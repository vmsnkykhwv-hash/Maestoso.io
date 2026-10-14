// Generisches Rate-Limiting gegen Brute-Force (Login-PINs) und Spam
// (öffentliche Formulare) – ein Versuchszähler pro Schlüssel, mit
// steigender Sperrdauer statt harter Grenze, damit ein einzelner
// vertippter Login nie jemanden aussperrt, ein Skript aber schnell
// ausgebremst wird.
import { headers } from 'next/headers'
import { getServiceClient } from '@/lib/supabase/server'

function sperrdauerMinuten(fehlversuche: number, abVersuchen: number): number {
  const ueberschuss = fehlversuche - abVersuchen + 1
  return Math.min(2 ** Math.max(0, ueberschuss), 60)
}

export async function rateLimitPruefen(schluessel: string): Promise<{ erlaubt: boolean; wartenSekunden?: number }> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('login_versuche').select('gesperrt_bis').eq('schluessel', schluessel).maybeSingle()

  const gesperrtBis = data?.gesperrt_bis as string | null | undefined
  if (gesperrtBis && new Date(gesperrtBis).getTime() > Date.now()) {
    return { erlaubt: false, wartenSekunden: Math.ceil((new Date(gesperrtBis).getTime() - Date.now()) / 1000) }
  }
  return { erlaubt: true }
}

// abVersuchen: ab wie vielen Fehlversuchen überhaupt gesperrt wird (vorher
// nur gezählt, kein Warten) – Logins vertragen ein paar Tippfehler,
// öffentliche Formulare dürfen strenger sein.
export async function rateLimitFehlgeschlagen(schluessel: string, abVersuchen: number): Promise<void> {
  const supabase = getServiceClient()
  const { data } = await supabase.from('login_versuche').select('fehlversuche').eq('schluessel', schluessel).maybeSingle()

  const fehlversuche = ((data?.fehlversuche as number | undefined) ?? 0) + 1
  const gesperrtBis =
    fehlversuche >= abVersuchen ? new Date(Date.now() + sperrdauerMinuten(fehlversuche, abVersuchen) * 60000).toISOString() : null

  await supabase
    .from('login_versuche')
    .upsert({ schluessel, fehlversuche, letzter_versuch: new Date().toISOString(), gesperrt_bis: gesperrtBis })
}

export async function rateLimitZuruecksetzen(schluessel: string): Promise<void> {
  const supabase = getServiceClient()
  await supabase.from('login_versuche').delete().eq('schluessel', schluessel)
}

export function warteHinweis(wartenSekunden: number): string {
  const minuten = Math.ceil(wartenSekunden / 60)
  return `Zu viele Anfragen. Bitte in ${minuten} Minute${minuten === 1 ? '' : 'n'} erneut versuchen.`
}

// Schlüssel für öffentliche Gäste-Formulare (Gutschein kaufen, Bestellen,
// Reservieren): anders als beim Login nicht nur an einen Schlüssel/Code
// gebunden, sondern zusätzlich an die anfragende IP – sonst könnte ein
// einzelner Spam-Versuch alle Gäste derselben Organisation aussperren.
// `x-forwarded-for` kann vom Client selbst gesetzt werden, ist aber nur ein
// Reibungsfaktor gegen Spam-Skripte, keine Sicherheitsgrenze – deshalb reicht
// hier "erstes Element vertrauen" statt einer vollständigen Proxy-Validierung.
export async function oeffentlicheAnfrageSchluessel(praefix: string, organisationId: string): Promise<string> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unbekannt'
  return `${praefix}:${organisationId}:${ip}`
}
