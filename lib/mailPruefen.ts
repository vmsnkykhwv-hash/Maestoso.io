// Das Resend-SDK (v4) wirft bei abgelehnten Mails nicht, sondern liefert
// { data: null, error }. Ohne diese Prüfung galt jede abgelehnte Mail
// (falsche Absenderdomain, ungültige Adresse, Limit erreicht) still als
// gesendet – die vorhandenen try/catch-Blöcke greifen erst, wenn hier
// geworfen wird.
export function mailPruefen<T extends { error: { message: string; name?: string } | null }>(antwort: T): T {
  if (antwort.error) throw new Error(`Resend: ${antwort.error.name ? `${antwort.error.name} – ` : ''}${antwort.error.message}`)
  return antwort
}
