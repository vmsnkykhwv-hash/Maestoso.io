// Statt einer leeren oder halbfertigen Seite – so sieht der Betrieb beim
// Testen sofort, dass noch etwas fehlt, und Gäste landen nicht im Nichts.
export default function AngabenFehlen({ name }: { name: string }) {
  return (
    <p className="rounded-xl border border-border bg-locked-bg px-4 py-3 text-locked">
      {name} hat die rechtlichen Angaben noch nicht vollständig hinterlegt.
    </p>
  )
}
