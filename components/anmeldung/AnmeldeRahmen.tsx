import Logo from '@/components/Logo'
import ThemeUmschalter from '@/components/ThemeUmschalter'
import RechtlicheFusszeile from '@/components/rechtliches/RechtlicheFusszeile'

export default function AnmeldeRahmen({
  titel,
  untertitel,
  children,
}: {
  titel: string
  untertitel?: string
  children: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <ThemeUmschalter className="absolute right-4 top-4" />
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7 text-accent" />
            <h1 className="font-display text-2xl font-semibold text-foreground">{titel}</h1>
          </div>
          {untertitel && <p className="text-sm text-muted">{untertitel}</p>}
        </div>
        {children}
        <RechtlicheFusszeile />
      </div>
    </main>
  )
}
