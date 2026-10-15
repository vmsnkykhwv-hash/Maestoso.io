import Logo from '@/components/Logo'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7 text-accent" />
            <h1 className="font-display text-2xl font-semibold text-foreground">Maestoso</h1>
          </div>
          <p className="text-sm text-muted">Zugangscode + PIN oder Plattform-Admin-PIN eingeben</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
