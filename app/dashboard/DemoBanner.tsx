import { Lock } from 'lucide-react'

export default function DemoBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-locked bg-locked-bg px-6 py-2.5 text-sm text-locked">
      <Lock className="h-4 w-4 flex-none" />
      Demo-Modus – dieses Modul ist für eure Organisation noch nicht freigeschaltet.
    </div>
  )
}
