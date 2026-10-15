import type { RechtlicheAngaben } from './types'

// Betreiber der Plattform Maestoso – Grundlage für /impressum und
// /datenschutz der Plattform selbst. Noch Platzhalter: vor dem Livegang
// hier die echten Daten eintragen (README → "Rechtliches"). Bewusst im Code
// statt in der Datenbank, weil sich diese Angaben praktisch nie ändern und
// ohne laufende Datenbank (z. B. bei einem Ausfall) erreichbar sein müssen.
export const PLATTFORM_BETREIBER: RechtlicheAngaben = {
  firma: '[Name bzw. Firma inkl. Rechtsform]',
  vertretenDurch: '[Vertretungsberechtigte Person, z. B. Geschäftsführer*in – bei Einzelunternehmen leer lassen]',
  strasse: '[Straße und Hausnummer]',
  plzOrt: '[PLZ Ort]',
  telefon: '[Telefonnummer]',
  email: '[E-Mail-Adresse]',
  registerEintrag: '[Registergericht und -nummer – leer lassen, falls nicht eingetragen]',
  ustId: '[USt-IdNr. nach § 27a UStG – leer lassen, falls keine vorhanden]',
  datenschutzKontakt: '',
}

// Datum, ab dem die Texte gelten – bei jeder inhaltlichen Änderung
// mitziehen, damit nachvollziehbar bleibt, welche Fassung wann galt.
export const STAND_RECHTSTEXTE = 'Oktober 2026'

// Technische Dienstleister der Plattform. Werden in beiden
// Datenschutzerklärungen (Plattform und je Betrieb) aufgeführt, deshalb
// nur hier gepflegt. Ein neuer Dienstleister im Code (z. B. ein
// Kassensystem-Adapter) muss auch hier ergänzt werden.
export type Dienstleister = {
  name: string
  anschrift: string
  zweck: string
  drittland: string | null
}

export const DIENSTLEISTER: Dienstleister[] = [
  {
    name: 'Vercel Inc.',
    anschrift: '440 N Barranca Ave #4133, Covina, CA 91723, USA (vor Livegang mit dem Vercel-DPA abgleichen)',
    zweck: 'Hosting und Auslieferung der Webseiten',
    drittland:
      'USA – Übermittlung auf Grundlage des EU-US Data Privacy Framework (Angemessenheitsbeschluss, Art. 45 DSGVO) bzw. Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO)',
  },
  {
    name: 'Supabase Inc.',
    anschrift: '[Anschrift laut Supabase-DPA eintragen]',
    zweck: 'Datenbank und Dateispeicher (Serverstandort: [Region eintragen, z. B. EU – Frankfurt])',
    drittland: 'Zugriff aus Drittländern im Rahmen von Wartung und Support möglich – abgesichert durch Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO)',
  },
  {
    name: 'Resend (Plus Five Five, Inc.)',
    anschrift: '[Anschrift laut Resend-DPA eintragen]',
    zweck: 'Versand von E-Mails (Bestätigungen, Benachrichtigungen, Bewertungsanfragen)',
    drittland:
      'USA – Übermittlung auf Grundlage des EU-US Data Privacy Framework (Art. 45 DSGVO) bzw. Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO)',
  },
]
