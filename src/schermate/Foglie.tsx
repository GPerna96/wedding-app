/**
 * Rametti di salvia agli angoli. Puramente decorativi: aria-hidden e
 * pointer-events-none, cosi' non intercettano tocchi ne' finiscono letti da
 * chi naviga con lo screen reader.
 *
 * La foglia di salvia e' oblunga, quasi vellutata, con la nervatura centrale
 * marcata: la forma qui sotto la asseconda invece di essere una foglia generica.
 */
function Rametto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".9">
        {/* stelo */}
        <path d="M18 182 C 52 150, 78 112, 96 62" />
        {/* rametti secondari */}
        <path d="M62 128 C 74 118, 88 112, 104 110" />
        <path d="M80 96 C 70 86, 58 78, 44 74" />
      </g>

      <g fill="currentColor" opacity=".22">
        {/* foglie: coppie contrapposte lungo lo stelo, come cresce la salvia */}
        <g transform="translate(104,110) rotate(28)">
          <path d="M0 0 C -10 -14, -9 -34, 0 -48 C 9 -34, 10 -14, 0 0 Z" />
        </g>
        <g transform="translate(44,74) rotate(-142)">
          <path d="M0 0 C -9 -12, -8 -30, 0 -43 C 8 -30, 9 -12, 0 0 Z" />
        </g>
        <g transform="translate(96,62) rotate(6)">
          <path d="M0 0 C -11 -16, -10 -38, 0 -54 C 10 -38, 11 -16, 0 0 Z" />
        </g>
        <g transform="translate(70,116) rotate(-58)">
          <path d="M0 0 C -8 -11, -7 -27, 0 -38 C 7 -27, 8 -11, 0 0 Z" />
        </g>
        <g transform="translate(40,152) rotate(-34)">
          <path d="M0 0 C -9 -13, -8 -31, 0 -44 C 8 -31, 9 -13, 0 0 Z" />
        </g>
      </g>

      {/* nervature: sono loro a far leggere le forme come salvia e non come gocce */}
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".38">
        <path d="M104 110 L 104 66" transform="rotate(28 104 110)" />
        <path d="M44 74 L 44 35" transform="rotate(-142 44 74)" />
        <path d="M96 62 L 96 12" transform="rotate(6 96 62)" />
        <path d="M70 116 L 70 82" transform="rotate(-58 70 116)" />
        <path d="M40 152 L 40 112" transform="rotate(-34 40 152)" />
      </g>
    </svg>
  )
}

export function Foglie() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-salvia opacity-75" aria-hidden="true">
      {/* in alto a destra, capovolto rispetto a quello in basso */}
      <Rametto className="absolute -top-10 -right-12 w-40 sm:w-52 rotate-180" />
      {/* in basso a sinistra */}
      <Rametto className="absolute -bottom-12 -left-12 w-40 sm:w-52" />
    </div>
  )
}
