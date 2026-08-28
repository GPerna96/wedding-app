/**
 * Archivio ZIP prodotto a flusso continuo.
 *
 * Gli originali di un matrimonio sono decine di GB: non stanno in memoria e
 * non si possono comprimere (foto e video sono gia' compressi, ci
 * guadagneremmo nulla spendendo tutta la CPU). Qui i file vengono solo
 * impacchettati uno dopo l'altro e spinti fuori man mano, cosi' il consumo
 * resta costante qualunque sia la mole.
 *
 * Formato: metodo "store", con descrittore in coda a ogni file perche' misura
 * e checksum si conoscono solo dopo averlo letto. Le estensioni ZIP64 entrano
 * in gioco da sole oltre i 4 GB, che e' il limite del formato originale.
 */

const tabellaCrc = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function aggiornaCrc(crc: number, blocco: Uint8Array) {
  let c = crc ^ 0xffffffff
  for (let i = 0; i < blocco.length; i++) c = tabellaCrc[(c ^ blocco[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const LIMITE32 = 0xffffffff

class Scrittore {
  private pezzi: Uint8Array[] = []
  u16(v: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.pezzi.push(b); return this }
  u32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.pezzi.push(b); return this }
  u64(v: number) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); this.pezzi.push(b); return this }
  dati(b: Uint8Array) { this.pezzi.push(b); return this }
  chiudi() {
    const tot = this.pezzi.reduce((n, p) => n + p.length, 0)
    const out = new Uint8Array(tot)
    let o = 0
    for (const p of this.pezzi) { out.set(p, o); o += p.length }
    return out
  }
}

/** Data e ora nel formato MS-DOS che lo ZIP si porta dietro dagli anni ottanta. */
function orarioDos(d: Date) {
  const ora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { ora, data }
}

export type Voce = { nome: string; chiave: string; quando: number }

export function creaZip(deposito: R2Bucket, voci: Voce[]): ReadableStream<Uint8Array> {
  const codifica = new TextEncoder()
  const indice: {
    nome: Uint8Array; crc: number; misura: number; offset: number; ora: number; data: number
  }[] = []
  let scritti = 0
  let i = 0

  return new ReadableStream<Uint8Array>({
    async pull(controllore) {
      // Finiti i file: si chiude con l'indice, che e' cio' che permette a un
      // programma di aprire l'archivio senza scorrerlo tutto.
      if (i >= voci.length) {
        const inizioIndice = scritti
        for (const v of indice) {
          const serveZip64 = v.misura > LIMITE32 || v.offset > LIMITE32
          const extra = serveZip64
            ? new Scrittore().u16(0x0001).u16(24).u64(v.misura).u64(v.misura).u64(v.offset).chiudi()
            : new Uint8Array(0)

          const s = new Scrittore()
            .u32(0x02014b50)
            .u16(45).u16(45).u16(0x0808).u16(0)
            .u16(v.ora).u16(v.data)
            .u32(v.crc)
            .u32(serveZip64 ? LIMITE32 : v.misura)
            .u32(serveZip64 ? LIMITE32 : v.misura)
            .u16(v.nome.length).u16(extra.length).u16(0).u16(0).u16(0)
            .u32(0)
            .u32(serveZip64 ? LIMITE32 : v.offset)
            .dati(v.nome).dati(extra)
            .chiudi()
          controllore.enqueue(s)
          scritti += s.length
        }
        const misuraIndice = scritti - inizioIndice

        // Coda in versione ZIP64 piu' quella classica: i programmi vecchi
        // leggono la seconda, i nuovi la prima, e nessuno resta fuori.
        const coda = new Scrittore()
          .u32(0x06064b50).u64(44).u16(45).u16(45).u32(0).u32(0)
          .u64(indice.length).u64(indice.length).u64(misuraIndice).u64(inizioIndice)
          .u32(0x07064b50).u32(0).u64(inizioIndice + misuraIndice).u32(1)
          .u32(0x06054b50).u16(0).u16(0)
          .u16(Math.min(indice.length, 0xffff)).u16(Math.min(indice.length, 0xffff))
          .u32(Math.min(misuraIndice, LIMITE32)).u32(Math.min(inizioIndice, LIMITE32)).u16(0)
          .chiudi()
        controllore.enqueue(coda)
        controllore.close()
        return
      }

      const voce = voci[i++]
      const oggetto = await deposito.get(voce.chiave)
      if (!oggetto) return   // sparito nel frattempo: si salta senza rompere l'archivio

      const nome = codifica.encode(voce.nome)
      const { ora, data } = orarioDos(new Date(voce.quando))
      const offset = scritti

      // Intestazione: misura e checksum arriveranno dopo, in coda al file.
      const testa = new Scrittore()
        .u32(0x04034b50).u16(45).u16(0x0808).u16(0)
        .u16(ora).u16(data)
        .u32(0).u32(0).u32(0)
        .u16(nome.length).u16(0)
        .dati(nome)
        .chiudi()
      controllore.enqueue(testa)
      scritti += testa.length

      let crc = 0
      let misura = 0
      const lettore = oggetto.body.getReader()
      for (;;) {
        const { done, value } = await lettore.read()
        if (done) break
        crc = aggiornaCrc(crc, value)
        misura += value.length
        scritti += value.length
        controllore.enqueue(value)
      }

      const grande = misura > LIMITE32
      const descrittore = new Scrittore().u32(0x08074b50).u32(crc)
      if (grande) descrittore.u64(misura).u64(misura)
      else descrittore.u32(misura).u32(misura)
      const coda = descrittore.chiudi()
      controllore.enqueue(coda)
      scritti += coda.length

      indice.push({ nome, crc, misura, offset, ora, data })
    },
  })
}
