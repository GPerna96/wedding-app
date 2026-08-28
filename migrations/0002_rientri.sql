-- Biglietti di rientro per l'app installata su iOS, che non vede i cookie di
-- Safari. Uno per installazione, valido una volta sola: dopo il primo avvio
-- il cookie vive nello spazio della PWA e il biglietto non serve piu'.
create table rientri (
  token     text primary key,
  ospite_id text not null references ospiti(id),
  creato_il integer not null,
  scade_il  integer not null
);

create index rientri_scadenza on rientri (scade_il);
