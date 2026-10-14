export type BewertungsanfrageZeile = {
  storniert: boolean
  geoeffnetAm: string | null
  geklicktAm: string | null
}

export type KlickrateAuswertung = {
  verschickt: number // ohne stornierte
  geoeffnet: number
  geklickt: number
  oeffnungsRate: number // geoeffnet / verschickt
  klickRate: number // geklickt / verschickt
  klickRateVonGeoeffnet: number // geklickt / geoeffnet
}

export function berechneKlickrate(anfragen: BewertungsanfrageZeile[]): KlickrateAuswertung {
  const verschickt = anfragen.filter((a) => !a.storniert)
  const geoeffnet = verschickt.filter((a) => a.geoeffnetAm !== null).length
  const geklickt = verschickt.filter((a) => a.geklicktAm !== null).length

  return {
    verschickt: verschickt.length,
    geoeffnet,
    geklickt,
    oeffnungsRate: verschickt.length > 0 ? geoeffnet / verschickt.length : 0,
    klickRate: verschickt.length > 0 ? geklickt / verschickt.length : 0,
    klickRateVonGeoeffnet: geoeffnet > 0 ? geklickt / geoeffnet : 0,
  }
}

export type GoogleSnapshot = {
  datum: string // YYYY-MM-DD
  anzahlBewertungen: number
  durchschnitt: number
}

export type GoogleTrendEintrag = GoogleSnapshot & {
  neueBewertungen: number | null // Differenz zum vorherigen Snapshot, null beim ersten Eintrag
  notenDelta: number | null
}

export type GoogleTrendAuswertung = {
  aktuell: GoogleSnapshot | null
  verlauf: GoogleTrendEintrag[] // älteste zuerst
}

export function berechneGoogleTrend(snapshots: GoogleSnapshot[]): GoogleTrendAuswertung {
  const sortiert = [...snapshots].sort((a, b) => a.datum.localeCompare(b.datum))

  const verlauf: GoogleTrendEintrag[] = sortiert.map((s, index) => {
    const vorheriger = index > 0 ? sortiert[index - 1] : null
    return {
      ...s,
      neueBewertungen: vorheriger ? s.anzahlBewertungen - vorheriger.anzahlBewertungen : null,
      notenDelta: vorheriger ? Math.round((s.durchschnitt - vorheriger.durchschnitt) * 10) / 10 : null,
    }
  })

  return {
    aktuell: sortiert.length > 0 ? sortiert[sortiert.length - 1] : null,
    verlauf,
  }
}
