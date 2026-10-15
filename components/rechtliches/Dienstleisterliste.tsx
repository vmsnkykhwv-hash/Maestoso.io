import { DIENSTLEISTER } from '@/lib/rechtliches/plattform'

export default function Dienstleisterliste() {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {DIENSTLEISTER.map((d) => (
        <li key={d.name}>
          <span className="font-medium text-foreground">{d.name}</span>, {d.anschrift} – {d.zweck}.
          {d.drittland && <> {d.drittland}.</>}
        </li>
      ))}
    </ul>
  )
}
