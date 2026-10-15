import { ImageResponse } from 'next/og'

// iOS nimmt für "Zum Home-Bildschirm" kein SVG – deshalb ein PNG, gerendert
// aus denselben drei Taktstrichen wie app/icon.svg.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const STRICHE = [
  { x: 2, y: 3, w: 4, h: 18, o: 1 },
  { x: 8, y: 7, w: 4, h: 14, o: 0.4 },
  { x: 14, y: 1, w: 4, h: 20, o: 1 },
  { x: 20, y: 9, w: 2.4, h: 12, o: 0.4 },
]

export default function AppleIcon() {
  const faktor = 5
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#1b2340', position: 'relative' }}>
        {STRICHE.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 30 + s.x * faktor,
              top: 30 + s.y * faktor,
              width: s.w * faktor,
              height: s.h * faktor,
              borderRadius: (s.w * faktor) / 2,
              background: '#c9962b',
              opacity: s.o,
            }}
          />
        ))}
      </div>
    ),
    size
  )
}
