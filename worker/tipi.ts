export type Env = {
  DB: D1Database
  MEDIA: R2Bucket
  ASSETS: Fetcher
  SPOSI: string
  TOKEN_EVENTO: string
  SEGRETO_COOKIE: string
  SEGRETO_ADMIN: string
}

export type Variabili = {
  ospite: { id: string; nome: string }
}
