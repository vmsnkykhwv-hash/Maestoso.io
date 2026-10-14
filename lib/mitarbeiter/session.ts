import { cookies } from 'next/headers'
import { MITARBEITER_COOKIE_NAME, verifyMitarbeiterToken, type MitarbeiterSitzung } from './auth'

// Nur in Server Components/Actions verwendbar (next/headers).
export async function getMitarbeiterSitzung(): Promise<MitarbeiterSitzung | null> {
  const cookieStore = await cookies()
  return verifyMitarbeiterToken(cookieStore.get(MITARBEITER_COOKIE_NAME)?.value)
}

// Von beiden Modulen (Zeiterfassung, Dienstplan) genutzt, um eine Server
// Action abzubrechen, wenn kein Mitarbeiter angemeldet ist.
export async function mitarbeiterSitzungOderFehler(): Promise<MitarbeiterSitzung> {
  const sitzung = await getMitarbeiterSitzung()
  if (!sitzung) throw new Error('Nicht als Mitarbeiter angemeldet')
  return sitzung
}
