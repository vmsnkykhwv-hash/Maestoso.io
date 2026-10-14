// Geteilte Bausteine für alle Auswertung-Tabs (Tischplan, Bestellung) – ein
// Ort statt zweier fast identischer Kopien, seit die Heatmap als dritter
// Baustein dazukam.

export function Kpi({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-display text-lg font-semibold text-foreground">{wert}</p>
    </div>
  )
}

// Balkendiagramm – für Wochentage (7 feste, immer gleich breite Spalten).
export function BalkenReihe({ eintraege, einheit }: { eintraege: { label: string; anzahl: number }[]; einheit: string }) {
  const max = Math.max(...eintraege.map((e) => e.anzahl), 1)
  return (
    <div className="flex gap-1.5">
      {eintraege.map((e) => {
        const hoeheProzent = max > 0 ? Math.max((e.anzahl / max) * 100, e.anzahl > 0 ? 6 : 0) : 0
        return (
          <div key={e.label} className="flex flex-1 flex-col items-center gap-1" title={`${e.label}: ${e.anzahl} ${einheit}`}>
            <span className="text-[11px] font-semibold text-foreground">{e.anzahl || ''}</span>
            <div className="flex h-24 w-full items-end rounded-md bg-card-dim">
              <div className="w-full rounded-md bg-accent transition-all" style={{ height: `${hoeheProzent}%` }} />
            </div>
            <span className="text-[11px] text-muted">{e.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Heatmap – für Uhrzeiten: Farbintensität statt Balkenhöhe liest sich für
// eine Tagesleiste natürlicher als Höhe (zwei benachbarte Stunden mit "1" und
// "2" Reservierungen sehen als Balken fast identisch hoch aus, als Zelle
// deutlich unterscheidbar) und macht Lücken im Tagesverlauf sichtbar, statt
// Stunden ohne Reservierung einfach wegzulassen.
export function StundenHeatmap({ eintraege, einheit }: { eintraege: { label: string; anzahl: number }[]; einheit: string }) {
  const max = Math.max(...eintraege.map((e) => e.anzahl), 1)
  return (
    <div className="flex gap-1 overflow-x-auto">
      {eintraege.map((e) => {
        const intensitaet = Math.round((e.anzahl / max) * 100)
        return (
          <div key={e.label} className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-1" title={`${e.label}: ${e.anzahl} ${einheit}`}>
            <span className="text-[11px] font-semibold text-foreground">{e.anzahl || ''}</span>
            <div
              className="h-10 w-full rounded-md border border-border/60"
              style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${intensitaet}%, var(--card-dim))` }}
            />
            <span className="text-[11px] text-muted">{e.label}</span>
          </div>
        )
      })}
    </div>
  )
}
