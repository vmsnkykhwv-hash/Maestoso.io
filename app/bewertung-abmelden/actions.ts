'use server'

import { redirect } from 'next/navigation'
import { abmelden, abmeldeTokenPruefen } from '@/lib/bewertung/abmeldung'

// Abgemeldet wird erst per Klick auf den Knopf, nicht schon beim Öffnen des
// Links – Virenscanner mancher Mailanbieter rufen Links vorab auf und
// würden sonst Gäste abmelden, die das nie wollten.
export async function abmeldenAktion(formData: FormData) {
  const token = String(formData.get('t') ?? '')
  const daten = await abmeldeTokenPruefen(token)
  if (!daten) redirect('/bewertung-abmelden')
  const ok = await abmelden(daten.organisationId, daten.email)
  redirect(`/bewertung-abmelden?t=${encodeURIComponent(token)}&${ok ? 'fertig=1' : 'fehler=1'}`)
}
