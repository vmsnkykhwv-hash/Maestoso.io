'use client'

import { useActionState, useState } from 'react'
import { login } from '@/app/actions'
import { cn } from '@/lib/utils'

const initialState = { fehler: undefined as string | undefined }

export default function LoginForm() {
  const [modus, setModus] = useState<'organisation' | 'plattform-admin'>('organisation')
  const [loginCode, setLoginCode] = useState('')
  const [pin, setPin] = useState('')

  const [state, formAction, pending] = useActionState(async () => {
    const formData = new FormData()
    formData.set('modus', modus)
    formData.set('loginCode', loginCode)
    formData.set('pin', pin)
    return login(formData)
  }, initialState)

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex gap-1 rounded-xl bg-card p-1">
        <button
          type="button"
          onClick={() => setModus('organisation')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-medium',
            modus === 'organisation' ? 'bg-accent text-accent-foreground' : 'text-muted'
          )}
        >
          Kunde
        </button>
        <button
          type="button"
          onClick={() => setModus('plattform-admin')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-medium',
            modus === 'plattform-admin' ? 'bg-accent text-accent-foreground' : 'text-muted'
          )}
        >
          Plattform-Admin
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        {modus === 'organisation' && (
          <label className="block text-sm font-medium text-foreground">
            Zugangscode
            <input
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal"
              autoComplete="username"
            />
          </label>
        )}

        <label className="block text-sm font-medium text-foreground">
          PIN
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal"
            autoComplete="current-password"
          />
        </label>

        {state?.fehler && <p className="text-sm font-medium text-danger">{state.fehler}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
        >
          {pending ? 'Prüfe…' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
