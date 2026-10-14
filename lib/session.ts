import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySessionToken, type Sitzung } from '@/lib/auth'

// Nur in Server Components/Actions verwendbar (next/headers) – proxy.ts
// liest den Cookie direkt über NextRequest, nicht über diese Datei.
export async function getSitzung(): Promise<Sitzung | null> {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)
}
