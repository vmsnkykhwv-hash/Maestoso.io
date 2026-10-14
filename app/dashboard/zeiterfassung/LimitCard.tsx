import { formatStunden } from '@/lib/zeiterfassung/zeit'
import { cn } from '@/lib/utils'

export default function LimitCard({
  minutenVerwendet,
  stundenGrenze,
  periodeLabel,
}: {
  minutenVerwendet: number
  stundenGrenze: number
  periodeLabel: string
}) {
  if (stundenGrenze <= 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted">Keine Stundengrenze hinterlegt.</p>
      </div>
    )
  }

  const grenzeMinuten = stundenGrenze * 60
  const anteil = Math.min(1, minutenVerwendet / grenzeMinuten)
  const erreicht = minutenVerwendet >= grenzeMinuten
  const knapp = !erreicht && anteil >= 0.9

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{periodeLabel}</span>
        <span className={cn('font-semibold', erreicht ? 'text-danger' : knapp ? 'text-locked' : 'text-foreground')}>
          {formatStunden(minutenVerwendet)} / {stundenGrenze} Std.
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={cn('h-full rounded-full', erreicht ? 'bg-danger' : knapp ? 'bg-locked' : 'bg-accent')}
          style={{ width: `${anteil * 100}%` }}
        />
      </div>
      {erreicht && (
        <p className="mt-2 text-xs font-medium text-danger">Stundengrenze erreicht. Bitte bei der Leitung melden.</p>
      )}
    </div>
  )
}
