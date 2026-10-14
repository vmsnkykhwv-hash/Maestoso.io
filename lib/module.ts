// Zentrale Liste der Plattform-Module. Neues Tool ergänzen = hier eine
// Zeile hinzufügen (und den Enum-Wert modul_schluessel in der Datenbank
// erweitern) – Dashboard, Sidebar und Plattform-Admin lesen diese Liste,
// keine Stelle muss doppelt gepflegt werden.

import { Clock, LayoutGrid, CalendarDays, Globe, Boxes, ShoppingBag, Star, Gift, PartyPopper, type LucideIcon } from 'lucide-react'

export type ModulSchluessel =
  | 'zeiterfassung'
  | 'tischplan'
  | 'dienstplan'
  | 'website'
  | 'lager'
  | 'bestellung'
  | 'bewertung'
  | 'gutschein'
  | 'veranstaltung'

export type Modul = {
  schluessel: ModulSchluessel
  name: string
  kurzname: string // für Sidebar/Navigation, wo der volle Name zu lang ist
  beschreibung: string
  href: string
  icon: LucideIcon
}

export const MODULE: Modul[] = [
  {
    schluessel: 'zeiterfassung',
    name: 'Zeiterfassung',
    kurzname: 'Zeiterfassung',
    beschreibung: 'Arbeitszeiten der Mitarbeiter erfassen und auswerten.',
    href: '/dashboard/zeiterfassung',
    icon: Clock,
  },
  {
    schluessel: 'tischplan',
    name: 'Tischplan & Reservierungen',
    kurzname: 'Tischplan',
    beschreibung: 'Tische verwalten und Reservierungen annehmen.',
    href: '/dashboard/tischplan',
    icon: LayoutGrid,
  },
  {
    schluessel: 'dienstplan',
    name: 'Dienstplan & Schichtplanung',
    kurzname: 'Dienstplan',
    beschreibung: 'Schichten planen, Verfügbarkeiten und Tausch-Anfragen verwalten.',
    href: '/dashboard/dienstplan',
    icon: CalendarDays,
  },
  {
    schluessel: 'website',
    name: 'Website',
    kurzname: 'Website',
    beschreibung: 'Öffentliche Website mit Speisekarte, Tagesmenü und Reservierung pflegen.',
    href: '/dashboard/website',
    icon: Globe,
  },
  {
    schluessel: 'lager',
    name: 'Lagerbestand & Wareneinkauf',
    kurzname: 'Lagerbestand',
    beschreibung: 'Bestandsprüfungen passend zum Bestellzyklus jedes Lieferanten, automatisch zugewiesen.',
    href: '/dashboard/lager',
    icon: Boxes,
  },
  {
    schluessel: 'bestellung',
    name: 'Online-Bestellung',
    kurzname: 'Bestellung',
    beschreibung: 'Abholung und Lieferung einzeln steuerbar, mit Schutz vor Überlastung der Küche.',
    href: '/dashboard/bestellung',
    icon: ShoppingBag,
  },
  {
    schluessel: 'bewertung',
    name: 'Google-Bewertungsanfrage',
    kurzname: 'Bewertung',
    beschreibung: 'Bittet erschienene Gäste automatisch um eine Google-Rezension.',
    href: '/dashboard/bewertung',
    icon: Star,
  },
  {
    schluessel: 'gutschein',
    name: 'Gutschein-Verkauf',
    kurzname: 'Gutschein',
    beschreibung: 'Online-Gutscheine verkaufen, optional per PayPal, und beim Besuch per Code einlösen.',
    href: '/dashboard/gutschein',
    icon: Gift,
  },
  {
    schluessel: 'veranstaltung',
    name: 'Veranstaltungsplanung',
    kurzname: 'Veranstaltungen',
    beschreibung: 'Geschlossene Gesellschaften und Raumvermietungen anfragen, bestätigen und verwalten.',
    href: '/dashboard/veranstaltung',
    icon: PartyPopper,
  },
]
