-- O grant de select na tabela inteira ignora o revoke de uma coluna.
-- A leitura autenticada passa a listar as colunas, sem o token do link.

revoke select on table public.aulas from public, anon, authenticated;

grant select (
  id,
  matricula_id,
  data_serie,
  inicio,
  fim,
  duracao_minutos,
  situacao,
  confirmacao,
  professor_id,
  aluno_id,
  instrumento_id
) on table public.aulas to authenticated;
