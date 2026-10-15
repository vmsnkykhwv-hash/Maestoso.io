// Bewusst ohne next/headers, damit auch Client-Komponenten (ThemeProvider)
// Cookie-Name und Typ von hier beziehen können.
export const THEME_COOKIE_NAME = 'maestoso-theme'

export type Theme = 'light' | 'dark'

// Alles außer einem ausdrücklichen "dark" zählt als heller Standard – auch
// ein fehlender oder manipulierter Cookie.
export function parseTheme(wert: string | undefined): Theme {
  return wert === 'dark' ? 'dark' : 'light'
}
