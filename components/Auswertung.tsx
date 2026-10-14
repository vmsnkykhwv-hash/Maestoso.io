// Geteilte Bausteine für alle Auswertung-Tabs (Tischplan, Bestellung) – ein
// Ort statt zweier fast identischer Kopien. Formspezifikation folgt der
// dataviz-Leitlinie: Balken <=24px dick, oben gerundet/unten eckig an einer
// gemeinsamen Grundlinie, Werte in Brotschrift (nie Serife – das ist für
// Überschriften reserviert), Sequentialfarbe (eine Farbfamilie, hell->dunkel)
// für Mengenangaben statt Kategorienfarben.

export function Kpi({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{wert}</p>
    </div>
  )
}

// Balkendiagramm – für Wochentage (7 feste, immer gleich breite Spalten).
// Balken wachsen von einer gemeinsamen Grundlinie (Haarlinie), bleiben
// schmal statt die ganze Spalte zu füllen, damit Luft um die Daten bleibt.
export function BalkenReihe({ eintraege, einheit }: { eintraege: { label: string; anzahl: number }[]; einheit: string }) {
  const max = Math.max(...eintraege.map((e) => e.anzahl), 1)
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5 border-b border-border">
        {eintraege.map((e) => {
          const hoeheProzent = e.anzahl > 0 ? Math.max((e.anzahl / max) * 100, 4) : 0
          return (
            <div
              key={e.label}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${e.label}: ${e.anzahl} ${einheit}`}
            >
              <span className="text-[11px] font-semibold text-foreground">{e.anzahl || ''}</span>
              <div className="w-5 max-w-full rounded-t bg-accent transition-all" style={{ height: `${hoeheProzent}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5 pt-1.5">
        {eintraege.map((e) => (
          <span key={e.label} className="flex-1 text-center text-[11px] text-muted">
            {e.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Heatmap – für Uhrzeiten: Farbintensität statt Balkenhöhe liest sich für
// eine Tagesleiste natürlicher als Höhe (zwei benachbarte Stunden mit "1" und
// "2" Reservierungen sehen als Balken fast identisch hoch aus, als Zelle
// deutlich unterscheidbar) und macht Lücken im Tagesverlauf sichtbar, statt
// Stunden ohne Reservierung einfach wegzulassen. Mit Skalenlegende, wie es
// eine Sequentialfarbe braucht (die Farbe allein sagt nicht, was "viel" ist).
export function StundenHeatmap({ eintraege, einheit }: { eintraege: { label: string; anzahl: number }[]; einheit: string }) {
  const max = Math.max(...eintraege.map((e) => e.anzahl), 1)
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto">
        {eintraege.map((e) => {
          const intensitaet = Math.round((e.anzahl / max) * 100)
          return (
            <div key={e.label} className="flex min-w-[2.75rem] flex-1 flex-col items-center gap-1" title={`${e.label}: ${e.anzahl} ${einheit}`}>
              <span className="text-[11px] font-semibold text-foreground">{e.anzahl || ''}</span>
              <div
                className="h-11 w-full rounded-md border border-border/60 transition-all"
                style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${intensitaet}%, var(--card-dim))` }}
              />
              <span className="text-[11px] text-muted">{e.label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[10px] text-muted">wenig</span>
        <div className="h-1.5 flex-1 rounded-full" style={{ background: 'linear-gradient(to right, var(--card-dim), var(--accent))' }} />
        <span className="text-[10px] text-muted">viel</span>
      </div>
    </div>
  )
}
