import type { ModulSchluessel } from '@/lib/module'

// Die Mitarbeiter-Identität (PIN-Login innerhalb einer Organisation) ist seit
// dem Dienstplan-Modul nicht mehr zeiterfassungsspezifisch – beide Module
// planen/erfassen für dieselben Mitarbeiter derselben Organisation, daher
// hier statt dupliziert in beiden Modulen.

export type MitarbeiterTyp = 'vollzeit' | 'teilzeit' | 'minijob'
export type MitarbeiterRolle = 'mitarbeiter' | 'leitung'

export const MITARBEITER_TYP_LABEL: Record<MitarbeiterTyp, string> = {
  vollzeit: 'Vollzeit',
  teilzeit: 'Teilzeit',
  minijob: 'Minijob',
}

export type Mitarbeiter = {
  id: string
  name: string
  rolle: MitarbeiterRolle
  mitarbeiterTyp: MitarbeiterTyp
  stundenGrenze: number
  aktiv: boolean
  // Freischaltung je Tool durch die Inhaberin – welche Module diese Person
  // am Tresen bzw. auf dem gekoppelten Handy sieht.
  module: ModulSchluessel[]
}

// Was Mitarbeitende überhaupt bekommen können. Website und
// Bewertungsanfragen sind reine Verwaltung (Verwaltungskonto).
export const MITARBEITER_MODULE: ModulSchluessel[] = [
  'tischplan',
  'bestellung',
  'gutschein',
  'veranstaltung',
  'zeiterfassung',
  'dienstplan',
  'lager',
]

// Auf dem eigenen Handy nur das, was die Person selbst betrifft – das
// Tagesgeschäft läuft ausschließlich am Tresen-Gerät.
export const HANDY_MODULE: ModulSchluessel[] = ['dienstplan', 'zeiterfassung']
