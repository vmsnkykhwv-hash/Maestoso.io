export type WebsiteInhalt = {
  heroTitel: string
  heroUntertitel: string
  ueberUns: string
  tagesmenuText: string
  tagesmenuAktiv: boolean
  kontaktTelefon: string
  kontaktEmail: string
  kontaktAdresse: string
  instagramUrl: string | null
}

export type BildRolle = 'hero' | 'galerie'

export type WebsiteBild = {
  id: string
  rolle: BildRolle
  url: string
  sortierung: number
}

export type MenuKategorie = {
  id: string
  name: string
  sortierung: number
}

export type MenuEintrag = {
  id: string
  kategorieId: string
  name: string
  beschreibung: string | null
  preis: number
  aktiv: boolean
  sortierung: number
}
