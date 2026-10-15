export type RechtlicheAngaben = {
  // Name bzw. Firma inkl. Rechtsform, z. B. "Café Musterbetrieb GmbH"
  firma: string
  vertretenDurch: string
  strasse: string
  plzOrt: string
  telefon: string
  email: string
  // z. B. "Amtsgericht Musterstadt, HRB 12345" – leer bei Einzelunternehmen
  registerEintrag: string
  ustId: string
  // Optional: Datenschutzbeauftragte*r, falls benannt
  datenschutzKontakt: string
}

export const LEERE_RECHTLICHE_ANGABEN: RechtlicheAngaben = {
  firma: '',
  vertretenDurch: '',
  strasse: '',
  plzOrt: '',
  telefon: '',
  email: '',
  registerEintrag: '',
  ustId: '',
  datenschutzKontakt: '',
}

// Die Mindestangaben nach § 5 DDG – ohne sie wäre das Impressum
// unvollständig und damit abmahnfähig. Register/USt-IdNr. sind nur
// Pflicht, wenn vorhanden, und deshalb nicht Teil der Prüfung.
export function angabenVollstaendig(a: RechtlicheAngaben): boolean {
  return [a.firma, a.strasse, a.plzOrt, a.email].every((wert) => wert.trim() !== '')
}
