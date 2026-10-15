import { Abschnitt } from './RechtsSeite'

// Rechte nach Art. 15–21 und 77 DSGVO – gleich für Plattform und Betrieb.
export default function Betroffenenrechte() {
  return (
    <>
      <Abschnitt titel="Deine Rechte">
        <p>Du hast gegenüber dem Verantwortlichen jederzeit das Recht auf</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Auskunft über die zu dir gespeicherten Daten (Art. 15 DSGVO),</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO),</li>
          <li>Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO).</li>
        </ul>
        <p>
          <span className="font-medium text-foreground">Widerspruchsrecht (Art. 21 DSGVO):</span> Soweit eine
          Verarbeitung auf berechtigten Interessen (Art. 6 Abs. 1 lit. f DSGVO) beruht, kannst du ihr aus Gründen,
          die sich aus deiner besonderen Situation ergeben, jederzeit widersprechen. Der Verwendung deiner Daten
          für Werbung – dazu zählen auch Bewertungsanfragen – kannst du jederzeit ohne Angabe von Gründen
          widersprechen.
        </p>
      </Abschnitt>
      <Abschnitt titel="Beschwerderecht">
        <p>
          Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere in dem
          Bundesland deines Wohnorts oder des Sitzes des Verantwortlichen (Art. 77 DSGVO).
        </p>
      </Abschnitt>
    </>
  )
}
