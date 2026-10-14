// Für Text, der in E-Mail-HTML eingebettet wird: Namen, Telefonnummern,
// Notizen und Positionsnamen stammen aus Formularen, die auch anonyme
// Gäste ausfüllen – ohne Eskapierung könnte ein manipulierter Name
// HTML/Links in die Mail einschleusen (die der Posteingang des Personals
// oder Kunden dann mitsamt Markup rendert).
export function escapeHtml(wert: string): string {
  return wert
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
