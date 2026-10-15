import { cookies } from 'next/headers'
import { THEME_COOKIE_NAME, parseTheme } from '@/lib/theme'
import ThemeProvider from './ThemeProvider'

// Liest die Wahl serverseitig aus dem Cookie statt erst im Browser aus
// localStorage – sonst würde jede Seite zuerst hell gerendert und dann
// sichtbar auf dunkel umspringen.
export default async function ThemeBereich({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = parseTheme(cookieStore.get(THEME_COOKIE_NAME)?.value)

  return <ThemeProvider anfangsTheme={theme}>{children}</ThemeProvider>
}
