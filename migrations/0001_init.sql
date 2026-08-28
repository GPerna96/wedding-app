-- Ospiti: nessuna password, solo un nome e un id firmato nel cookie.
create table ospiti (
  id        text primary key,
  nome      text not null,
  creato_il integer not null
);

-- Media: una riga per foto/video. L'originale non viene mai ricompresso.
create table media (
  id               text not null primary key,
  ospite_id        text not null references ospiti(id),
  tipo             text not null,                     -- 'foto' | 'video'
  chiave_originale text not null,
  chiave_anteprima text not null,
  upload_id        text,                              -- multipart R2 in corso
  larghezza        integer,
  altezza          integer,
  durata_ms        integer,
  byte             integer not null default 0,
  nome_file        text,
  stato            text not null default 'in_corso',  -- 'in_corso' | 'completo'
  nascosto         integer not null default 0,
  creato_il        integer not null
);

-- Il muro legge sempre con questo ordine: indice fatto su misura.
create index media_feed on media (nascosto, creato_il desc);

create table messaggi (
  id        text primary key,
  ospite_id text not null references ospiti(id),
  testo     text not null,
  nascosto  integer not null default 0,
  creato_il integer not null
);

create index messaggi_feed on messaggi (nascosto, creato_il desc);
