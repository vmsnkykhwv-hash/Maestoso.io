'use server'

import { redirect } from 'next/navigation'
import { teamHref } from '@/lib/gaesteLinks'
import { abmelden } from '@/lib/konten/anmeldung'
import { getSitzung } from '@/lib/session'

// Zurück zur passenden Anmeldung: Inhaber unter der Adresse ihres Betriebs
// (/team), der Plattform-Admin unter /login.
export async function logout() {
  const sitzung = await getSitzung()
  await abmelden()
  if (sitzung?.typ === 'inhaber') redirect(await teamHref(sitzung.organisationId))
  redirect('/login')
}
