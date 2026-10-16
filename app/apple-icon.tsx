import { ImageResponse } from 'next/og'
import { MARKE_GOLD, MARKE_PFAD, MARKE_VIEWBOX } from '@/lib/markeZeichen'

// iOS nimmt für "Zum Home-Bildschirm" kein SVG – deshalb ein PNG, gerendert
// aus demselben Vektor-"M" wie app/icon.svg.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARKE_VIEWBOX}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${MARKE_GOLD[0]}"/><stop offset=".5" stop-color="${MARKE_GOLD[1]}"/><stop offset="1" stop-color="${MARKE_GOLD[2]}"/></linearGradient></defs><path fill="url(#g)" d="${MARKE_PFAD}"/></svg>`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414' }}>
        <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`} width={128} height={105} alt="" />
      </div>
    ),
    size
  )
}
