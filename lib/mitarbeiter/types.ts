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
}
