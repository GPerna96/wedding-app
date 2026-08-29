-- Il muro mostrava la foto appena nasceva la riga, quando l'anteprima non era
-- ancora arrivata nel deposito: il telefono trovava un 404 e disegnava
-- l'immagine rotta. Ora si aspetta che ci sia davvero.
alter table media add column anteprima_pronta integer not null default 0;

-- Quelle gia' complete l'anteprima ce l'hanno di sicuro.
update media set anteprima_pronta = 1 where stato = 'completo';

drop index if exists media_feed;
create index media_feed on media (nascosto, anteprima_pronta, creato_il desc);
