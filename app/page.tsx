import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  Boxes,
  Check,
  Gift,
  Globe,
  History,
  KeyRound,
  LayoutGrid,
  MonitorSmartphone,
  PartyPopper,
  Server,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Star,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import Kopf from '@/components/marketing/Kopf'
import Fuss from '@/components/marketing/Fuss'
import KontaktFormular from '@/components/marketing/KontaktFormular'
import { RECHTSTEXTE_VOLLSTAENDIG } from '@/lib/rechtliches/plattform'
import {
  BEISPIEL_BESTELLUMSATZ,
  MINDESTLAUFZEIT_MONATE,
  PORTAL_PROVISION_PROZENT,
  PREISE_OEFFENTLICH,
  TESTPHASE_TAGE,
  euro,
  guenstigstesPaketMitBestellung,
  portalProvision,
} from '@/lib/preise'
import { ENTSCHEIDUNGSFRIST_TAGE } from '@/lib/testphase/regeln'

const domain = process.env.NEXT_PUBLIC_PLATTFORM_DOMAIN

export const metadata: Metadata = {
  ...(domain ? { metadataBase: new URL(`https://${domain}`) } : {}),
  title: 'Maestoso – Software für Gastronomie: Reservierung, Dienstplan, Zeiterfassung, Online-Bestellung',
  description:
    'Website, Reservierungen, Zeiterfassung, Dienstplan, Online-Bestellung, Gutscheine und Lager in einem System – unter deiner eigenen Domain, ohne Provision und ohne Aufpreis pro Mitarbeiter.',
  openGraph: {
    title: 'Maestoso – Gastronomie. Einfach. Digital.',
    description: 'Ein System für deinen ganzen Betrieb: Website, Reservierungen, Personal, Bestellungen und Lager.',
    images: [{ url: '/marke/vorschau.jpg', width: 1200, height: 630 }],
    locale: 'de_DE',
    type: 'website',
  },
  // Erst indexieren, wenn das Impressum echte Angaben hat.
  robots: RECHTSTEXTE_VOLLSTAENDIG ? { index: true, follow: true } : { index: false, follow: false },
}

// Website zuerst: Sie ist die Adresse, unter der Gäste reservieren,
// bestellen und Gutscheine kaufen – alles andere baut darauf auf.
const FUNKTIONEN: { icon: LucideIcon; name: string; text: string; grundlage?: boolean }[] = [
  {
    icon: Globe,
    name: 'Website',
    text: 'Speisekarte, Tagesmenü, Bilder und Öffnungszeiten unter deiner eigenen Domain. Reservieren, Bestellen und Gutscheine kaufen geht direkt auf der Seite.',
    grundlage: true,
  },
  {
    icon: LayoutGrid,
    name: 'Tischplan & Reservierungen',
    text: 'Gäste reservieren auch um 23 Uhr, wenn keiner mehr ans Telefon geht. Doppelbuchungen sind ausgeschlossen, selbst wenn zwei Gäste im selben Moment klicken.',
  },
  {
    icon: Clock,
    name: 'Zeiterfassung',
    text: 'Dein Team stempelt am Tresen-Tablet mit PIN. Minijob- und Stundengrenzen siehst du rechtzeitig, die Lohnabrechnung bekommt einen fertigen Export.',
  },
  {
    icon: CalendarDays,
    name: 'Dienstplan',
    text: 'Schichten planen, Verfügbarkeiten sehen, Tauschwünsche annehmen. Jede Person hat ihren Plan auf dem eigenen Handy statt in der WhatsApp-Gruppe.',
  },
  {
    icon: ShoppingBag,
    name: 'Online-Bestellung',
    text: 'Abholung und Lieferung über deine Website. Ist die Küche voll, pausierst du Bestellungen mit einem Klick. Provision fällt keine an.',
  },
  {
    icon: Star,
    name: 'Google-Bewertungsanfrage',
    text: 'Nach dem Besuch bekommen Gäste automatisch eine Mail mit der Bitte um eine Bewertung. So kommen mehr Bewertungen zusammen, ohne dass du jemanden ansprechen musst.',
  },
  {
    icon: Boxes,
    name: 'Lagerbestand',
    text: 'Die Bestandsprüfung kommt passend zum Liefertag jedes Lieferanten und landet bei der richtigen Schicht. Aus den Zahlen wird die Bestellliste.',
  },
  {
    icon: Gift,
    name: 'Gutschein-Verkauf',
    text: 'Gutscheine verkaufen sich online, auch nachts und am Ruhetag. Bezahlt wird auf Wunsch per PayPal, eingelöst per Code am Tresen.',
  },
  {
    icon: PartyPopper,
    name: 'Veranstaltungen',
    text: 'Anfragen für Geburtstage, Firmenfeiern und geschlossene Gesellschaften kommen gesammelt an. Mit der Zusage sind die Tische automatisch geblockt.',
  },
]

// Vorher/nachher in Paaren: Wiedererkennen wirkt stärker als jede
// Funktionsliste.
const ERSETZT: { bisher: string; jetzt: string }[] = [
  { bisher: 'Reservierungsbuch und Telefon', jetzt: 'Online-Reservierungen landen direkt im Tischplan' },
  { bisher: 'Dienstplan in Excel oder der WhatsApp-Gruppe', jetzt: 'Jede Person sieht ihre Schichten auf dem Handy' },
  { bisher: 'Stundenzettel zum Abtippen', jetzt: 'Stempeln per PIN, Export für die Lohnabrechnung' },
  { bisher: 'Lieferportal mit Provision', jetzt: 'Bestellungen über deine eigene Website' },
  { bisher: 'Bestellliste auf Zuruf', jetzt: 'Bestandsprüfung am Liefertag, Liste entsteht daraus' },
  { bisher: 'Gutscheine aus Papier', jetzt: 'Online verkauft, per Code eingelöst' },
]

const PLAETZE: { icon: LucideIcon; titel: string; text: string }[] = [
  {
    icon: UserRound,
    titel: 'Du als Inhaberin oder Inhaber',
    text: 'Von überall: im Büro, zu Hause, unterwegs. Du meldest dich mit Passwort und einem Code aus der Authenticator-App an. Einstellungen, Auswertungen und Zugänge verwaltest nur du.',
  },
  {
    icon: MonitorSmartphone,
    titel: 'Das Tablet am Tresen',
    text: 'Einmal freigegeben, bleibt es angemeldet. Wer gerade arbeitet, tippt die eigene PIN ein. Hier laufen Reservierungen, Bestellungen, Gutscheine und Arbeitszeiten.',
  },
  {
    icon: Smartphone,
    titel: 'Das Handy deines Teams',
    text: 'Per QR-Code gekoppelt, ohne Passwort. Darauf: Dienstplan, Verfügbarkeit, Schichttausch und die eigenen Stunden. Mehr sieht dein Team dort nicht.',
  },
]

const SICHERHEIT: { icon: LucideIcon; titel: string; text: string }[] = [
  { icon: Server, titel: 'Daten in Deutschland', text: 'Datenbank und Anwendung laufen in Frankfurt am Main.' },
  { icon: KeyRound, titel: 'Zwei-Faktor-Anmeldung', text: 'Ohne Code aus der Authenticator-App kommt niemand in die Verwaltung.' },
  { icon: History, titel: 'Änderungsprotokoll', text: 'Jede Änderung mit Name, Gerät und Uhrzeit. Auch wir als Support tauchen darin auf.' },
  { icon: ShieldCheck, titel: 'Rechte je Person', text: 'Du legst fest, wer welches Werkzeug sieht. Ein entzogenes Gerät ist sofort abgemeldet.' },
]

const FRAGEN: { frage: string; antwort: string }[] = [
  {
    frage: 'Brauche ich Technikkenntnisse?',
    antwort: 'Nein. Wir richten alles ein, ziehen deine Domain um und weisen dich und dein Team ein. Danach läuft Maestoso im Browser, am Tablet, am Handy und am Computer. Installieren musst du nichts.',
  },
  {
    frage: 'Muss ich Speisekarte und Bilder selbst einpflegen?',
    antwort: 'Nein. Bei der Einrichtung übernehmen wir die Inhalte deiner bisherigen Website oder Karte. Ein neues Tagesmenü oder geänderte Öffnungszeiten trägst du danach selbst ein.',
  },
  {
    frage: 'Was passiert mit meiner bestehenden Website und Domain?',
    antwort: 'Deine Domain bleibt deine. Wir verbinden sie mit Maestoso oder ziehen sie um, deine Gäste sehen weiter nur deine Adresse. Hast du noch keine, legen wir eine für dich an.',
  },
  {
    frage: 'Fallen Provisionen pro Bestellung oder Reservierung an?',
    antwort: 'Nein. Du zahlst einen festen Monatspreis, egal wie viele Gäste reservieren oder bestellen und wie viele Leute in deinem Team sind.',
  },
  {
    frage: `Was passiert nach den ${TESTPHASE_TAGE} Tagen Test?`,
    antwort: `Der Test endet von selbst, kündigen musst du nichts. Machst du weiter, läuft alles ohne Unterbrechung weiter. Wenn nicht, heben wir deine Daten noch ${ENTSCHEIDUNGSFRIST_TAGE} Tage auf, falls du es dir anders überlegst, und löschen sie dann vollständig.`,
  },
  {
    frage: 'Wie lange läuft der Vertrag?',
    antwort: `${MINDESTLAUFZEIT_MONATE} Monate, danach monatlich zum Monatsende kündbar. Bei jährlicher Zahlung wird es günstiger.`,
  },
  {
    frage: 'Kann ich nur einzelne Module buchen?',
    antwort: 'Ja. Die Pakete sind aber fast immer günstiger, weil sie die Module bündeln, die im Alltag zusammengehören.',
  },
]

const ABLAUF = [
  { titel: 'Demo', text: '30 Minuten, online oder bei dir im Betrieb. Wir zeigen dir Maestoso an Abläufen aus deinem Alltag.' },
  { titel: `${TESTPHASE_TAGE} Tage testen`, text: 'Kostenlos, mit deinen eigenen Tischen, Gerichten und Leuten. Der Test endet von selbst, kündigen musst du nichts.' },
  { titel: 'Einrichtung', text: 'Entscheidest du dich für Maestoso, übernehmen wir Domain, Website-Inhalte und Grundeinstellungen und weisen dein Team ein.' },
  { titel: 'Loslegen', text: 'Gäste reservieren und bestellen bei dir, dein Team plant und stempelt im selben System.' },
]

function anteilText(preis: number, provision: number): string | null {
  if (preis * 3 < provision) return 'weniger als ein Drittel'
  if (preis * 2 < provision) return 'weniger als die Hälfte'
  return null
}

export default function Startseite() {
  const provision = portalProvision()
  const paket = guenstigstesPaketMitBestellung()
  const anteil = anteilText(paket.preis, provision.von)

  return (
    <div className="bg-m-creme font-sans text-m-tinte">
      <Kopf />

      <main>
        {/* Einstieg: das Markenbild, darunter die Zusage in Textform */}
        <section className="bg-m-nacht text-white">
          {/* Randlos über die ganze Breite; auf sehr breiten Bildschirmen
              oben/unten beschnitten statt übergroß, das Logo bleibt mittig. */}
          <div className="relative aspect-[1983/793] max-h-[min(70vh,680px)] w-full overflow-hidden">
            <Image
              src="/marke/banner.jpg"
              alt="Maestoso – Gastronomie. Einfach. Digital."
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-m-nacht" aria-hidden="true" />
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
            <h1 className="max-w-3xl font-marke text-3xl font-semibold leading-tight text-balance sm:text-5xl">
              Ein System für deinen Betrieb. <span className="text-m-gold">Ohne Provision an Portale.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/75">
              Website, Reservierungen, Online-Bestellung, Dienstplan, Zeiterfassung und Lager laufen in Maestoso zusammen. Gäste buchen und bestellen direkt bei dir, dein Team plant und stempelt am selben Ort. Du zahlst einen festen Monatspreis.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#kontakt" className="rounded-full bg-m-gold px-6 py-3 font-semibold text-m-nacht transition hover:bg-m-gold-hell">
                Demo anfragen
              </Link>
              <Link href="#rechnung" className="rounded-full border border-white/25 px-6 py-3 font-semibold text-white transition hover:border-white/60">
                Was du sparst
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/60">
              <li>0 % Provision auf Bestellungen</li>
              <li>Kein Preis pro Mitarbeiter</li>
              <li>Einrichtung machen wir</li>
              <li>{TESTPHASE_TAGE} Tage kostenlos, endet von selbst</li>
            </ul>
          </div>
        </section>

        {/* Das stärkste Argument direkt nach dem Einstieg: eine Rechnung,
            die jeder Betrieb mit Lieferservice sofort nachvollzieht. */}
        <section id="rechnung" className="scroll-mt-20 border-t border-white/10 bg-m-nacht px-4 pb-20 pt-4 text-white sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold">Rechenbeispiel</p>
              <h2 className="mt-2 font-marke text-3xl font-semibold text-balance sm:text-4xl">Was dich ein Lieferportal jeden Monat kostet</h2>
              <p className="mt-4 text-white/75">
                Bei {euro(BEISPIEL_BESTELLUMSATZ)} Bestellumsatz im Monat gehen {euro(provision.von)} bis {euro(provision.bis)} als Provision an das Portal. Mit jeder weiteren Bestellung wird es mehr.
              </p>
              <p className="mt-4 text-white/75">
                Dazu kommt: Auf dem Portal steht die Konkurrenz direkt neben dir, und die Kontaktdaten deiner Gäste hat das Portal. Bestellen sie auf deiner Website, bleiben sie deine Gäste.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-m-nacht-2 p-6">
              <p className="text-sm text-white/60">{euro(BEISPIEL_BESTELLUMSATZ)} Bestellumsatz im Monat</p>
              <dl className="mt-5 space-y-4">
                <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-4">
                  <dt className="text-white/75">Lieferportal mit {PORTAL_PROVISION_PROZENT.von}–{PORTAL_PROVISION_PROZENT.bis} % Provision</dt>
                  <dd className="whitespace-nowrap font-marke text-2xl font-semibold tabular-nums">
                    {euro(provision.von)}–{euro(provision.bis)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-white/75">Maestoso</dt>
                  <dd className="whitespace-nowrap font-marke text-2xl font-semibold tabular-nums text-m-gold">0 € Provision</dd>
                </div>
              </dl>
              {anteil && (
                <p className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">
                  Das Paket mit Online-Bestellung kostet im Monat {anteil} der niedrigsten Provision, und der Preis bleibt gleich, egal wie viel bestellt wird.
                </p>
              )}
              <p className="mt-5 text-xs text-white/45">Provisionssätze großer Lieferportale laut deren öffentlichen Angaben.</p>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Weniger Werkzeuge</p>
            <h2 className="mt-2 max-w-2xl font-marke text-3xl font-semibold text-balance sm:text-4xl">Was Maestoso bei dir ersetzt</h2>
            <div className="mt-10 overflow-hidden rounded-2xl border border-m-linie bg-white">
              <div className="hidden grid-cols-2 border-b border-m-linie bg-m-papier text-sm font-semibold sm:grid">
                <p className="px-5 py-3 text-m-leise">Bisher</p>
                <p className="px-5 py-3 text-m-gold-dunkel">Mit Maestoso</p>
              </div>
              <ul className="divide-y divide-m-linie">
                {ERSETZT.map((e) => (
                  <li key={e.bisher} className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-0 sm:p-0">
                    <p className="text-m-leise line-through decoration-m-leise/40 sm:px-5 sm:py-4">{e.bisher}</p>
                    <p className="flex items-start gap-2 font-medium sm:px-5 sm:py-4">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-m-gold-dunkel" aria-hidden="true" />
                      {e.jetzt}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="funktionen" className="scroll-mt-20 bg-m-papier px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Funktionen</p>
            <h2 className="mt-2 max-w-2xl font-marke text-3xl font-semibold text-balance sm:text-4xl">Neun Werkzeuge, ein Login</h2>
            <p className="mt-4 max-w-2xl text-m-leise">
              Du buchst nur, was du brauchst, und alles greift ineinander: Eine Reservierung von der Website steht sofort im Tischplan am Tresen, eine zugesagte Feier blockt ihre Tische selbst.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FUNKTIONEN.map((f) => (
                <article key={f.name} className={`rounded-2xl border p-6 ${f.grundlage ? 'border-m-gold bg-white' : 'border-m-linie bg-white/70'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <f.icon className="h-6 w-6 text-m-gold-dunkel" aria-hidden="true" />
                    {f.grundlage && <span className="rounded-full bg-m-papier px-2.5 py-0.5 text-xs font-semibold text-m-gold-dunkel">Grundlage für alles</span>}
                  </div>
                  <h3 className="mt-4 font-marke text-lg font-semibold">{f.name}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-m-leise">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="ablauf" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">So arbeitest du</p>
            <h2 className="mt-2 max-w-2xl font-marke text-3xl font-semibold text-balance sm:text-4xl">Drei Zugänge, jeder mit den passenden Rechten</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PLAETZE.map((p) => (
                <article key={p.titel} className="rounded-2xl border border-m-linie bg-white p-6">
                  <p.icon className="h-7 w-7 text-m-gold-dunkel" aria-hidden="true" />
                  <h3 className="mt-4 font-marke text-lg font-semibold">{p.titel}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-m-leise">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-m-papier px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Der Weg zu Maestoso</p>
            <h2 className="mt-2 max-w-2xl font-marke text-3xl font-semibold text-balance sm:text-4xl">Du testest, wir richten ein</h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ABLAUF.map((a, i) => (
                <li key={a.titel} className="rounded-2xl bg-white p-6">
                  <span className="font-marke text-3xl font-semibold text-m-gold">{i + 1}</span>
                  <h3 className="mt-2 font-marke text-lg font-semibold">{a.titel}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-m-leise">{a.text}</p>
                </li>
              ))}
            </ol>
            {PREISE_OEFFENTLICH && (
              <p className="mt-8 text-m-leise">
                Alle Preise und Pakete findest du auf der{' '}
                <Link href="/preise" className="font-semibold text-m-tinte underline">Preisseite</Link>.
              </p>
            )}
          </div>
        </section>

        <section id="sicherheit" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Sicherheit & Datenschutz</p>
            <h2 className="mt-2 max-w-2xl font-marke text-3xl font-semibold text-balance sm:text-4xl">Gebaut für Personal- und Gästedaten</h2>
            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {SICHERHEIT.map((s) => (
                <div key={s.titel}>
                  <s.icon className="h-6 w-6 text-m-gold-dunkel" aria-hidden="true" />
                  <h3 className="mt-3 font-marke text-lg font-semibold">{s.titel}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-m-leise">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fragen" className="scroll-mt-20 bg-m-papier px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Fragen</p>
            <h2 className="mt-2 font-marke text-3xl font-semibold sm:text-4xl">Was Betriebe uns vorher fragen</h2>
            <div className="mt-8 divide-y divide-m-linie border-y border-m-linie">
              {FRAGEN.map((f) => (
                <details key={f.frage} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-marke text-lg font-medium">
                    {f.frage}
                    <span className="text-2xl leading-none text-m-gold-dunkel transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-m-leise">{f.antwort}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="kontakt" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="font-marke text-sm font-medium uppercase tracking-[0.16em] text-m-gold-dunkel">Kontakt</p>
              <h2 className="mt-2 font-marke text-3xl font-semibold text-balance sm:text-4xl">30 Minuten Demo, an deinem Betrieb</h2>
              <p className="mt-4 text-m-leise">
                Schreib uns, wann es dir passt. Wir zeigen dir Maestoso mit Beispielen aus deinem Alltag: deine Tische, deine Schichten, deine Karte. Die Demo ist kostenlos und verpflichtet zu nichts.
              </p>
              <p className="mt-4 text-m-leise">Nur eine Frage? Wähle oben im Formular „Frage“.</p>
            </div>
            <KontaktFormular />
          </div>
        </section>
      </main>

      <Fuss />
    </div>
  )
}
