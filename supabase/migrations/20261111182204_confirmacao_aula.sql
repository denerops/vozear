-- O link do WhatsApp é a credencial. Quem tem o token confirma ou cancela só aquela aula.
-- ver_confirmacao e responder_confirmacao são security definer de propósito: o visitante
-- não tem login, e o schema private não é acessível para anon.

alter table public.aulas
  add column confirmacao text not null default 'pendente'
    constraint aulas_confirmacao check (confirmacao in ('pendente', 'confirmada', 'cancelada')),
  add column confirmacao_token text;

create unique index aulas_confirmacao_token
  on public.aulas (confirmacao_token)
  where confirmacao_token is not null;

revoke select (confirmacao_token) on table public.aulas from public, anon, authenticated;

create or replace function private.ler_confirmacao(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas%rowtype;
  instrumento text;
  professor text;
  aluno text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into a from public.aulas where confirmacao_token = p_token;
  if not found then
    return null;
  end if;

  select nome into instrumento from public.instrumentos where id = a.instrumento_id;
  select nome into professor from public.perfis where id = a.professor_id;
  select nome into aluno from public.perfis where id = a.aluno_id;

  return jsonb_build_object(
    'instrumento', coalesce(instrumento, 'Aula'),
    'professor', coalesce(professor, 'Professor'),
    'aluno', coalesce(aluno, 'Aluno'),
    'inicio', a.inicio,
    'duracao_minutos', a.duracao_minutos,
    'situacao', a.situacao,
    'confirmacao', a.confirmacao,
    'aberta', a.situacao in ('prevista', 'remarcada') and a.inicio > now()
  );
end;
$$;

create or replace function private.responder_confirmacao(p_token text, p_resposta text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_resposta not in ('confirmar', 'cancelar') then
    raise exception 'link inválido';
  end if;

  select * into a from public.aulas where confirmacao_token = p_token for update;
  if not found then
    raise exception 'link inválido';
  end if;
  if a.situacao in ('realizada', 'falta') or a.inicio <= now() then
    raise exception 'esta aula não aceita mais confirmação';
  end if;

  if p_resposta = 'confirmar' then
    if a.situacao = 'cancelada' then
      raise exception 'esta aula foi cancelada';
    end if;
    update public.aulas set confirmacao = 'confirmada' where id = a.id;
  else
    update public.aulas
    set confirmacao = 'cancelada', situacao = 'cancelada'
    where id = a.id;
  end if;

  return private.ler_confirmacao(p_token);
end;
$$;

create or replace function private.tokens_confirmacao(p_aula_ids uuid[])
returns table (aula_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas%rowtype;
  novo text;
  gravado text;
begin
  if p_aula_ids is null or cardinality(p_aula_ids) > 200 then
    raise exception 'muitas aulas';
  end if;

  for a in
    select * from public.aulas where id = any (p_aula_ids)
  loop
    if not private.pode_mexer_na_aula(a) then
      continue;
    end if;

    gravado := a.confirmacao_token;
    if gravado is null then
      novo := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      update public.aulas
      set confirmacao_token = novo
      where id = a.id
        and confirmacao_token is null
      returning confirmacao_token into gravado;

      if gravado is null then
        select aulas.confirmacao_token into gravado from public.aulas as aulas where aulas.id = a.id;
      end if;
    end if;

    aula_id := a.id;
    token := gravado;
    return next;
  end loop;
end;
$$;

create or replace function public.ver_confirmacao(p_token text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.ler_confirmacao(p_token);
$$;

create or replace function public.responder_confirmacao(p_token text, p_resposta text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.responder_confirmacao(p_token, p_resposta);
$$;

create or replace function public.tokens_confirmacao(p_aula_ids uuid[])
returns table (aula_id uuid, token text)
language sql
security invoker
set search_path = ''
as $$
  select aula_id, token from private.tokens_confirmacao(p_aula_ids);
$$;

revoke all on function private.ler_confirmacao(text) from public, anon, authenticated;
revoke all on function private.responder_confirmacao(text, text) from public, anon, authenticated;
revoke all on function private.tokens_confirmacao(uuid[]) from public, anon, authenticated;
revoke all on function public.ver_confirmacao(text) from public, anon, authenticated;
revoke all on function public.responder_confirmacao(text, text) from public, anon, authenticated;
revoke all on function public.tokens_confirmacao(uuid[]) from public, anon, authenticated;

grant execute on function private.ler_confirmacao(text) to current_user;
grant execute on function private.responder_confirmacao(text, text) to current_user;
grant execute on function private.tokens_confirmacao(uuid[]) to current_user, authenticated;
grant execute on function public.ver_confirmacao(text) to anon, authenticated;
grant execute on function public.responder_confirmacao(text, text) to anon, authenticated;
grant execute on function public.tokens_confirmacao(uuid[]) to authenticated;
