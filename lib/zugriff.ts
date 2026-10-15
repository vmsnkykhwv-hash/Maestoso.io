import { redirect } from 'next/navigation'
import { HANDY_MODULE } from '@/lib/mitarbeiter/types'
import type { ModulSchluessel } from '@/lib/module'
import { getBetriebsSitzung, type BetriebsSitzung } from '@/lib/session'

// Rechte im Dashboard eines Betriebs, an einer Stelle statt in jedem Modul:
// - Verwaltungskonto (Inhaber*in): alles, von jedem Gerät.
// - Tresen-Gerät: nur mit angemeldeter Mitarbeiter-PIN, nur die für diese
//   Person freigeschalteten Module, nur Tagesgeschäft (keine Einstellungen,
//   Auswertungen oder Personalverwaltung).
// - Gekoppeltes Handy: nur Dienstplan und eigene Zeiten (und auch die nur,
//   wenn freigeschaltet), nur lesen bzw. eigene Verfügbarkeit/Tausch.

export type Inhaber = Extract<BetriebsSitzung, { art: 'inhaber' }>

export function istVerwaltung(sitzung: BetriebsSitzung | null): sitzung is Inhaber {
  return sitzung?.art === 'inhaber'
}

export function darfModul(sitzung: BetriebsSitzung, modul: ModulSchluessel): boolean {
  if (sitzung.art === 'inhaber') return true
  if (sitzung.art === 'tresen') return !!sitzung.mitarbeiter && sitzung.mitarbeiter.module.includes(modul)
  return HANDY_MODULE.includes(modul) && sitzung.mitarbeiter.module.includes(modul)
}

type Optionen = {
  // nur Verwaltungskonto (Einstellungen, Auswertungen, Personal)
  verwaltung?: boolean
  // nicht vom Handy aus (z. B. Zeiten erfassen, Tagesgeschäft) – nur am
  // Tresen-Gerät oder mit Verwaltungskonto
  ohneHandy?: boolean
}

function erlaubt(sitzung: BetriebsSitzung | null, modul: ModulSchluessel | null, optionen: Optionen): sitzung is BetriebsSitzung {
  if (!sitzung) return false
  if (optionen.verwaltung && sitzung.art !== 'inhaber') return false
  if (optionen.ohneHandy && sitzung.art === 'handy') return false
  return modul ? darfModul(sitzung, modul) : true
}

// Für Seiten: ohne Berechtigung zurück zur Übersicht (bzw. zur Anmeldung).
export async function seiteFuer(modul: ModulSchluessel | null, optionen: Optionen = {}): Promise<BetriebsSitzung> {
  const sitzung = await getBetriebsSitzung()
  if (!sitzung) redirect('/team')
  if (!erlaubt(sitzung, modul, optionen)) redirect('/dashboard')
  return sitzung
}

// Für Server Actions: die sind eigenständig aufrufbar (siehe
// app/plattform-admin/actions.ts) – ausgeblendete Knöpfe allein schützen
// nichts, deshalb prüft jede Aktion selbst.
export async function aktionFuer(modul: ModulSchluessel | null, optionen: Optionen = {}): Promise<BetriebsSitzung> {
  const sitzung = await getBetriebsSitzung()
  if (!erlaubt(sitzung, modul, optionen)) throw new Error('Keine Berechtigung')
  return sitzung
}

export async function verwaltungFuer(modul: ModulSchluessel | null): Promise<Inhaber> {
  return (await aktionFuer(modul, { verwaltung: true })) as Inhaber
}
