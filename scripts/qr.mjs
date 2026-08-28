/**
 * Genera il QR d'accesso nelle varianti che servono alla stampa.
 *
 *   node scripts/qr.mjs "https://.../?k=TOKEN"
 *
 * I moduli escono come un unico path riempito invece dei tratti prodotti dalla
 * libreria: in un programma di grafica diventano una forma sola, da ricolorare
 * e ridimensionare senza spessori da correggere.
 */
import QR from 'qrcode'
import { mkdirSync, writeFileSync } from 'node:fs'

const url = process.argv[2]
if (!url) {
  console.error('Manca l\'indirizzo. Esempio:\n  node scripts/qr.mjs "https://esempio/?k=TOKEN"')
  process.exit(1)
}

// Correzione d'errore alta: il codice regge una stampa piccola e un cartoncino
// che durante la serata si sporca.
const qr = QR.create(url, { errorCorrectionLevel: 'H' })
const n = qr.modules.size
const dati = qr.modules.data
const MARGINE = 4          // il bordo chiaro serve ai telefoni per agganciare il codice
const lato = n + MARGINE * 2

let d = ''
for (let y = 0; y < n; y++)
  for (let x = 0; x < n; x++)
    if (dati[y * n + x]) d += `M${x + MARGINE} ${y + MARGINE}h1v1h-1z`

mkdirSync('qr', { recursive: true })

const varianti = [
  { file: 'qr/qr-nero.svg', sfondo: '#FFFFFF', modulo: '#000000' },
  { file: 'qr/qr-salvia.svg', sfondo: '#F7F5F0', modulo: '#2E3A2C' },
  { file: 'qr/qr-trasparente.svg', sfondo: null, modulo: '#2E3A2C' },
]

for (const v of varianti) {
  writeFileSync(v.file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lato} ${lato}" width="1000" height="1000" shape-rendering="crispEdges">
  <title>Accesso all'app delle foto</title>
  ${v.sfondo ? `<rect width="${lato}" height="${lato}" fill="${v.sfondo}"/>` : ''}
  <path fill="${v.modulo}" d="${d}"/>
</svg>
`)
  console.log('  scritto', v.file)
}

await QR.toFile('qr/accesso.png', url, { width: 1200, margin: MARGINE, errorCorrectionLevel: 'H' })
console.log('  scritto qr/accesso.png')
console.log(`  ${n}x${n} moduli, leggibile fino a circa 1,3 cm stampato a 300 dpi`)
