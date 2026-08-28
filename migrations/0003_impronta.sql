-- Impronta del contenuto, per riconoscere lo stesso file caricato due volte:
-- capita con un doppio tocco, o ricaricando la pagina a meta' invio.
alter table media add column impronta text;

-- Solo sui caricamenti andati a buon fine: due tentativi falliti dello stesso
-- file devono poter riprovare.
create unique index media_impronta on media (impronta)
  where impronta is not null and stato = 'completo';
