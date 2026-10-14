import { redirect } from 'next/navigation'
import { getSitzung } from '@/lib/session'

export default async function RootPage() {
  const sitzung = await getSitzung()

  if (!sitzung) redirect('/login')
  redirect(sitzung.typ === 'plattform-admin' ? '/plattform-admin' : '/dashboard')
}
