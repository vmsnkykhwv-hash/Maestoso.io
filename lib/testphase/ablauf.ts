import { adminEmails } from '@/lib/anfragen/daten'
import { getServiceClient } from '@/lib/supabase/server'
import { organisationEndgueltigLoeschen } from './daten'
import { adminZusammenfassungSenden, datumLang, geloeschtSenden, gesperrtSenden, loeschungBaldSenden, testEndetBaldSenden } from './email'
import { ENTSCHEIDUNGSFRIST_TAGE, ERINNERUNG_VORLAUF_TAGE, plusTage } from './regeln'

const ANFRAGEN_AUFBEWAHRUNG_TAGE = 365

type Zeile = { id: string; name: string; test_bis: string | null; loeschung_am: string | null }

async function empfaenger(organisationId: string): Promise<string[]> {
  const { data } = await getServiceClient().from('benutzer').select('email').eq('organisation_id', organisationId).eq('aktiv', true)
  return (data ?? []).map((z) => z.email as string)
}

// Einmal täglich (vercel.json → /api/cron/testphase). Jeder Schritt ist
// wiederholbar: die Flags verhindern doppelte Mails, und fällt ein Lauf aus,
// holt der nächste alles nach. Reihenfolge: erst löschen, dann sperren,
// dann erinnern – ein Betrieb, der heute gesperrt wird, bekommt nicht
// zusätzlich noch "läuft bald ab".
export async function testphasenPruefen(jetzt = new Date()): Promise<string[]> {
  const supabase = getServiceClient()
  const admins = await adminEmails()
  const protokoll: string[] = []
  const spalten = 'id, name, test_bis, loeschung_am'

  const { data: zuLoeschen } = await supabase
    .from('organisationen')
    .select(spalten)
    .eq('vertrag_status', 'gesperrt')
    .lte('loeschung_am', jetzt.toISOString())
  for (const o of (zuLoeschen ?? []) as Zeile[]) {
    const an = await empfaenger(o.id)
    const ergebnis = await organisationEndgueltigLoeschen(o.id)
    if (ergebnis.fehler) {
      protokoll.push(`${o.name}: Löschen fehlgeschlagen – ${ergebnis.fehler}`)
      continue
    }
    await geloeschtSenden(an, admins, o.name)
    protokoll.push(`${o.name}: gelöscht`)
  }

  const { data: zuSperren } = await supabase
    .from('organisationen')
    .select(spalten)
    .eq('vertrag_status', 'test')
    .lte('test_bis', jetzt.toISOString())
  for (const o of (zuSperren ?? []) as Zeile[]) {
    const loeschungAm = plusTage(jetzt, ENTSCHEIDUNGSFRIST_TAGE).toISOString()
    const { error } = await supabase
      .from('organisationen')
      .update({ vertrag_status: 'gesperrt', loeschung_am: loeschungAm })
      .eq('id', o.id)
      .eq('vertrag_status', 'test')
    if (error) {
      protokoll.push(`${o.name}: Sperren fehlgeschlagen – ${error.message}`)
      continue
    }
    await gesperrtSenden(await empfaenger(o.id), admins, o.name, loeschungAm)
    protokoll.push(`${o.name}: Testphase beendet, gesperrt, Löschung am ${datumLang(loeschungAm)}`)
  }

  const vorlauf = plusTage(jetzt, ERINNERUNG_VORLAUF_TAGE).toISOString()

  const { data: testBald } = await supabase
    .from('organisationen')
    .select(spalten)
    .eq('vertrag_status', 'test')
    .eq('erinnerung_test_gesendet', false)
    .gt('test_bis', jetzt.toISOString())
    .lte('test_bis', vorlauf)
  for (const o of (testBald ?? []) as Zeile[]) {
    await testEndetBaldSenden(await empfaenger(o.id), admins, o.name, o.test_bis as string)
    await supabase.from('organisationen').update({ erinnerung_test_gesendet: true }).eq('id', o.id)
    protokoll.push(`${o.name}: Testphase endet am ${datumLang(o.test_bis as string)} – erinnert`)
  }

  const { data: loeschungBald } = await supabase
    .from('organisationen')
    .select(spalten)
    .eq('vertrag_status', 'gesperrt')
    .eq('erinnerung_loeschung_gesendet', false)
    .gt('loeschung_am', jetzt.toISOString())
    .lte('loeschung_am', vorlauf)
  for (const o of (loeschungBald ?? []) as Zeile[]) {
    await loeschungBaldSenden(await empfaenger(o.id), admins, o.name, o.loeschung_am as string)
    await supabase.from('organisationen').update({ erinnerung_loeschung_gesendet: true }).eq('id', o.id)
    protokoll.push(`${o.name}: Löschung am ${datumLang(o.loeschung_am as string)} – erinnert`)
  }

  // Die Datenschutzerklärung verspricht, Website-Anfragen nach spätestens
  // zwölf Monaten zu löschen.
  const { count } = await supabase
    .from('anfragen')
    .delete({ count: 'exact' })
    .lt('erstellt_at', plusTage(jetzt, -ANFRAGEN_AUFBEWAHRUNG_TAGE).toISOString())
  if (count) protokoll.push(`${count} Website-Anfrage(n) älter als 12 Monate gelöscht`)

  if (protokoll.length > 0) await adminZusammenfassungSenden(admins, protokoll)
  return protokoll
}
