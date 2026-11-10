-- Escola de música: pessoas, horários, matrículas, aulas, recados e mensalidades.
-- O schema private não entra na API. Funções security definer ficam lá.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) >= 2),
  email text not null unique,
  criado_em timestamptz not null default now()
);

create table public.papeis (
  user_id uuid not null references public.perfis (id) on delete cascade,
  papel text not null check (papel in ('administrador', 'professor', 'aluno')),
  primary key (user_id, papel)
);

create table public.contatos (
  perfil_id uuid primary key references public.perfis (id) on delete cascade,
  telefone text not null default '',
  instagram text not null default '',
  outra_rede text not null default '',
  nascimento date
);

create table public.observacoes_internas (
  aluno_id uuid primary key references public.perfis (id) on delete cascade,
  texto text not null default '',
  atualizado_em timestamptz not null default now()
);

create table public.instrumentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  valor_mensal_centavos integer not null check (valor_mensal_centavos > 0),
  ativo boolean not null default true
);

create table public.professor_instrumentos (
  professor_id uuid not null references public.perfis (id) on delete cascade,
  instrumento_id uuid not null references public.instrumentos (id) on delete restrict,
  primary key (professor_id, instrumento_id)
);

create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.perfis (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio_minuto smallint not null check (inicio_minuto between 0 and 1439),
  duracao_minutos smallint not null check (duracao_minutos between 15 and 240),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint horarios_cabe_no_dia check (inicio_minuto + duracao_minutos <= 1440),
  constraint horarios_sem_sobreposicao
    exclude using gist (
      professor_id with =,
      dia_semana with =,
      int4range(inicio_minuto, inicio_minuto + duracao_minutos, '[)') with &&
    ) where (ativo)
);

create table public.matriculas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis (id) on delete restrict,
  professor_id uuid not null references public.perfis (id) on delete restrict,
  instrumento_id uuid not null references public.instrumentos (id) on delete restrict,
  horario_id uuid not null references public.horarios (id) on delete restrict,
  valor_mensal_centavos integer not null check (valor_mensal_centavos > 0),
  situacao text not null default 'ativa' check (situacao in ('ativa', 'encerrada')),
  inicio_em date not null,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio_minuto smallint not null check (inicio_minuto between 0 and 1439),
  duracao_minutos smallint not null check (duracao_minutos between 15 and 240),
  criado_em timestamptz not null default now(),
  constraint matriculas_pessoas_distintas check (aluno_id <> professor_id),
  constraint matriculas_cabe_no_dia check (inicio_minuto + duracao_minutos <= 1440),
  constraint matriculas_aluno_sem_sobreposicao
    exclude using gist (
      aluno_id with =,
      dia_semana with =,
      int4range(inicio_minuto, inicio_minuto + duracao_minutos, '[)') with &&
    ) where (situacao = 'ativa'),
  constraint matriculas_professor_sem_sobreposicao
    exclude using gist (
      professor_id with =,
      dia_semana with =,
      int4range(inicio_minuto, inicio_minuto + duracao_minutos, '[)') with &&
    ) where (situacao = 'ativa')
);

create unique index matriculas_um_horario_ativo
  on public.matriculas (horario_id)
  where situacao = 'ativa';

create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete cascade,
  data_serie date not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  duracao_minutos smallint not null check (duracao_minutos between 15 and 240),
  situacao text not null default 'prevista'
    check (situacao in ('prevista', 'realizada', 'falta', 'cancelada', 'remarcada')),
  professor_id uuid not null references public.perfis (id) on delete restrict,
  aluno_id uuid not null references public.perfis (id) on delete restrict,
  instrumento_id uuid not null references public.instrumentos (id) on delete restrict,
  unique (matricula_id, data_serie),
  constraint aulas_fim_depois check (fim > inicio),
  constraint aulas_professor_sem_sobreposicao
    exclude using gist (
      professor_id with =,
      tstzrange(inicio, fim, '[)') with &&
    ) where (situacao <> 'cancelada'),
  constraint aulas_aluno_sem_sobreposicao
    exclude using gist (
      aluno_id with =,
      tstzrange(inicio, fim, '[)') with &&
    ) where (situacao <> 'cancelada')
);

create table public.recados (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.aulas (id) on delete cascade,
  autor_id uuid not null references public.perfis (id) on delete restrict,
  texto text not null check (char_length(texto) <= 4000),
  links jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  constraint recados_links_array check (jsonb_typeof(links) = 'array')
);

create table public.mensalidades (
  id uuid primary key default gen_random_uuid(),
  matricula_id uuid not null references public.matriculas (id) on delete restrict,
  aluno_id uuid not null references public.perfis (id) on delete restrict,
  instrumento_id uuid not null references public.instrumentos (id) on delete restrict,
  competencia date not null,
  valor_centavos integer not null check (valor_centavos > 0),
  vencimento date not null,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'paga')),
  paga_em timestamptz,
  pix_txid text not null,
  criado_em timestamptz not null default now(),
  unique (matricula_id, competencia),
  unique (pix_txid),
  constraint mensalidades_competencia check (extract(day from competencia) = 1),
  constraint mensalidades_txid check (pix_txid ~ '^[A-Za-z0-9*]{1,25}$')
);

create table public.configuracao_escola (
  id integer primary key default 1 check (id = 1),
  chave_pix text not null default '',
  nome_recebedor text not null default 'VOZEAR',
  cidade_recebedor text not null default 'SAO PAULO',
  vencimento_dia smallint not null default 10 check (vencimento_dia between 1 and 28),
  mensagem_whatsapp text not null,
  constraint configuracao_nome check (char_length(btrim(nome_recebedor)) between 1 and 25),
  constraint configuracao_cidade check (char_length(btrim(cidade_recebedor)) between 1 and 15)
);

create or replace function private.definir_fim_aula()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fim := new.inicio + make_interval(mins => new.duracao_minutos);
  return new;
end;
$$;

create trigger aulas_definir_fim
  before insert or update of inicio, duracao_minutos on public.aulas
  for each row
  execute function private.definir_fim_aula();

create index horarios_professor_idx on public.horarios (professor_id);
create index matriculas_aluno_idx on public.matriculas (aluno_id);
create index matriculas_professor_idx on public.matriculas (professor_id);
create index matriculas_instrumento_idx on public.matriculas (instrumento_id);
create index professor_instrumentos_instrumento_idx on public.professor_instrumentos (instrumento_id);
create index aulas_professor_inicio_idx on public.aulas (professor_id, inicio);
create index aulas_aluno_inicio_idx on public.aulas (aluno_id, inicio);
create index aulas_instrumento_idx on public.aulas (instrumento_id);
create index recados_aula_idx on public.recados (aula_id);
create index recados_autor_idx on public.recados (autor_id);
create index mensalidades_aluno_idx on public.mensalidades (aluno_id, competencia);
create index mensalidades_matricula_idx on public.mensalidades (matricula_id);
create index mensalidades_instrumento_idx on public.mensalidades (instrumento_id);

-- ---------------------------------------------------------------------------
-- Funções internas
-- ---------------------------------------------------------------------------

create or replace function private.tem_papel(alvo uuid, papel_alvo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.papeis
    where user_id = alvo
      and papel = papel_alvo
  );
$$;

create or replace function private.e_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.tem_papel(auth.uid(), 'administrador');
$$;

create or replace function private.leciona_para(aluno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matriculas
    where professor_id = auth.uid()
      and aluno_id = aluno
      and situacao = 'ativa'
  );
$$;

create or replace function private.estuda_com(professor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matriculas
    where aluno_id = auth.uid()
      and professor_id = professor
      and situacao = 'ativa'
  );
$$;

-- Horário de parede em America/Sao_Paulo. O Brasil não usa horário de verão desde 2019.
create or replace function private.instante_serie(data_serie date, minuto integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (data_serie + make_interval(mins => minuto)) at time zone 'America/Sao_Paulo';
$$;

create or replace function private.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
begin
  v_nome := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if char_length(v_nome) < 2 then
    v_nome := 'A convite';
  end if;

  insert into public.perfis (id, nome, email)
  values (new.id, v_nome, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row
  execute function private.criar_perfil();

create or replace function private.validar_links(links jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
begin
  if jsonb_array_length(links) > 8 then
    raise exception 'no máximo 8 links';
  end if;

  for item in select value from jsonb_array_elements(links)
  loop
    if coalesce(item ->> 'rotulo', '') = '' then
      raise exception 'o link precisa de um nome';
    end if;
    if char_length(item ->> 'rotulo') > 80 then
      raise exception 'o nome do link está longo demais';
    end if;
    if coalesce(item ->> 'url', '') !~ '^https://' then
      raise exception 'o link precisa começar com https://';
    end if;
    if char_length(item ->> 'url') > 500 then
      raise exception 'o link está longo demais';
    end if;
  end loop;
end;
$$;

create or replace function private.validar_recado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.validar_links(new.links);
  if char_length(btrim(new.texto)) = 0 and jsonb_array_length(new.links) = 0 then
    raise exception 'escreva um recado ou informe um link';
  end if;
  return new;
end;
$$;

create trigger recados_validar
  before insert or update on public.recados
  for each row
  execute function private.validar_recado();

create or replace function private.validar_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.horarios%rowtype;
begin
  if not private.tem_papel(new.aluno_id, 'aluno') then
    raise exception 'a matrícula precisa de um aluno';
  end if;
  if not private.tem_papel(new.professor_id, 'professor') then
    raise exception 'a matrícula precisa de um professor';
  end if;

  select * into h from public.horarios where id = new.horario_id;
  if not found or not h.ativo then
    raise exception 'horário indisponível';
  end if;
  if h.professor_id <> new.professor_id then
    raise exception 'o horário pertence a outro professor';
  end if;
  if not exists (
    select 1
    from public.professor_instrumentos
    where professor_id = new.professor_id
      and instrumento_id = new.instrumento_id
  ) then
    raise exception 'este professor não leciona este instrumento';
  end if;

  new.dia_semana := h.dia_semana;
  new.inicio_minuto := h.inicio_minuto;
  new.duracao_minutos := h.duracao_minutos;
  return new;
end;
$$;

create trigger matriculas_validar
  before insert on public.matriculas
  for each row
  execute function private.validar_matricula();

create or replace function private.ao_encerrar_matricula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao = 'encerrada' and old.situacao = 'ativa' then
    update public.aulas
    set situacao = 'cancelada'
    where matricula_id = new.id
      and situacao in ('prevista', 'remarcada')
      and inicio >= now();
  end if;
  return new;
end;
$$;

create trigger matriculas_encerrar
  before update of situacao on public.matriculas
  for each row
  execute function private.ao_encerrar_matricula();

create or replace function private.propagar_horario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.professor_id <> old.professor_id then
    raise exception 'o horário não muda de professor';
  end if;

  if not new.ativo and exists (
    select 1 from public.matriculas
    where horario_id = new.id and situacao = 'ativa'
  ) then
    raise exception 'encerre a matrícula antes de desativar o horário';
  end if;

  if new.dia_semana is distinct from old.dia_semana then
    update public.aulas as aula
    set situacao = 'cancelada'
    from public.matriculas as matricula
    where aula.matricula_id = matricula.id
      and matricula.horario_id = new.id
      and aula.situacao = 'prevista'
      and aula.inicio >= now();
  else
    update public.aulas as aula
    set
      inicio = private.instante_serie(aula.data_serie, new.inicio_minuto),
      duracao_minutos = new.duracao_minutos
    from public.matriculas as matricula
    where aula.matricula_id = matricula.id
      and matricula.horario_id = new.id
      and matricula.situacao = 'ativa'
      and aula.situacao = 'prevista'
      and aula.inicio = private.instante_serie(aula.data_serie, old.inicio_minuto)
      and aula.inicio >= now();
  end if;

  update public.matriculas
  set
    dia_semana = new.dia_semana,
    inicio_minuto = new.inicio_minuto,
    duracao_minutos = new.duracao_minutos
  where horario_id = new.id
    and situacao = 'ativa';

  return new;
end;
$$;

create trigger horarios_propagar
  before update on public.horarios
  for each row
  execute function private.propagar_horario();

create or replace function private.pode_mexer_na_aula(alvo public.aulas)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.e_administrador() or alvo.professor_id = auth.uid();
$$;

create or replace function private.gerar_aulas(p_matricula_id uuid, p_ate date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matriculas%rowtype;
  d date;
  hoje date;
  inseridas integer := 0;
begin
  if p_ate is null then
    raise exception 'informe a data final';
  end if;

  select * into m from public.matriculas where id = p_matricula_id;
  if not found then
    raise exception 'matrícula não encontrada';
  end if;
  if m.situacao <> 'ativa' then
    raise exception 'matrícula encerrada';
  end if;
  if not (private.e_administrador() or m.professor_id = auth.uid()) then
    raise exception 'sem permissão';
  end if;

  hoje := (now() at time zone 'America/Sao_Paulo')::date;
  if p_ate > hoje + 180 then
    raise exception 'gere no máximo seis meses à frente';
  end if;

  d := greatest(m.inicio_em, hoje);
  while extract(dow from d)::integer <> m.dia_semana loop
    d := d + 1;
  end loop;

  while d <= p_ate loop
    insert into public.aulas (
      matricula_id, data_serie, inicio, duracao_minutos, situacao,
      professor_id, aluno_id, instrumento_id
    ) values (
      m.id,
      d,
      private.instante_serie(d, m.inicio_minuto),
      m.duracao_minutos,
      'prevista',
      m.professor_id,
      m.aluno_id,
      m.instrumento_id
    )
    on conflict (matricula_id, data_serie) do nothing;

    if found then
      inseridas := inseridas + 1;
    end if;
    d := d + 7;
  end loop;

  return inseridas;
end;
$$;

create or replace function private.remarcar_aula(p_aula_id uuid, p_inicio timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas%rowtype;
  serie timestamptz;
begin
  select * into a from public.aulas where id = p_aula_id;
  if not found then
    raise exception 'aula não encontrada';
  end if;
  if not private.pode_mexer_na_aula(a) then
    raise exception 'sem permissão';
  end if;
  if a.situacao = 'cancelada' then
    raise exception 'aula cancelada não pode ser remarcada';
  end if;

  select private.instante_serie(a.data_serie, matricula.inicio_minuto)
    into serie
  from public.matriculas as matricula
  where matricula.id = a.matricula_id;

  update public.aulas
  set
    inicio = p_inicio,
    situacao = case when p_inicio = serie then 'prevista' else 'remarcada' end
  where id = p_aula_id;
end;
$$;

create or replace function private.cancelar_aula(p_aula_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas%rowtype;
begin
  select * into a from public.aulas where id = p_aula_id;
  if not found then
    raise exception 'aula não encontrada';
  end if;
  if not private.pode_mexer_na_aula(a) then
    raise exception 'sem permissão';
  end if;

  update public.aulas set situacao = 'cancelada' where id = p_aula_id;
end;
$$;

create or replace function private.registrar_aula(p_aula_id uuid, p_situacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.aulas%rowtype;
begin
  if p_situacao not in ('prevista', 'realizada', 'falta') then
    raise exception 'situação inválida';
  end if;

  select * into a from public.aulas where id = p_aula_id;
  if not found then
    raise exception 'aula não encontrada';
  end if;
  if not private.pode_mexer_na_aula(a) then
    raise exception 'sem permissão';
  end if;
  if a.situacao = 'cancelada' then
    raise exception 'aula cancelada';
  end if;
  if a.situacao = 'remarcada' and p_situacao = 'prevista' then
    raise exception 'aula remarcada não volta sozinha para a série';
  end if;

  update public.aulas set situacao = p_situacao where id = p_aula_id;
end;
$$;

create or replace function private.gerar_mensalidades(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matriculas%rowtype;
  v_mes date;
  v_dia integer;
  v_id uuid;
  inseridas integer := 0;
begin
  if not private.e_administrador() then
    raise exception 'sem permissão';
  end if;

  v_mes := date_trunc('month', p_competencia)::date;
  select vencimento_dia into v_dia from public.configuracao_escola where id = 1;

  for m in
    select * from public.matriculas where situacao = 'ativa'
  loop
    v_id := gen_random_uuid();
    insert into public.mensalidades (
      id, matricula_id, aluno_id, instrumento_id, competencia,
      valor_centavos, vencimento, situacao, pix_txid
    ) values (
      v_id,
      m.id,
      m.aluno_id,
      m.instrumento_id,
      v_mes,
      m.valor_mensal_centavos,
      make_date(extract(year from v_mes)::integer, extract(month from v_mes)::integer, v_dia),
      'aberta',
      upper(substr(replace(v_id::text, '-', ''), 1, 25))
    )
    on conflict (matricula_id, competencia) do nothing;

    if found then
      inseridas := inseridas + 1;
    end if;
  end loop;

  return inseridas;
end;
$$;

create or replace function private.baixar_mensalidade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  atualizadas integer;
begin
  if not private.e_administrador() then
    raise exception 'sem permissão';
  end if;

  update public.mensalidades
  set situacao = 'paga', paga_em = now()
  where id = p_id
    and situacao = 'aberta';

  get diagnostics atualizadas = row_count;
  if atualizadas = 0 then
    raise exception 'mensalidade não está em aberto';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- API: wrappers. A permissão mora nas funções private.
-- ---------------------------------------------------------------------------

create or replace function public.gerar_aulas(p_matricula_id uuid, p_ate date)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.gerar_aulas(p_matricula_id, p_ate);
$$;

create or replace function public.remarcar_aula(p_aula_id uuid, p_inicio timestamptz)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.remarcar_aula(p_aula_id, p_inicio);
end;
$$;

create or replace function public.cancelar_aula(p_aula_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.cancelar_aula(p_aula_id);
end;
$$;

create or replace function public.registrar_aula(p_aula_id uuid, p_situacao text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.registrar_aula(p_aula_id, p_situacao);
end;
$$;

create or replace function public.gerar_mensalidades(p_competencia date)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.gerar_mensalidades(p_competencia);
$$;

create or replace function public.baixar_mensalidade(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.baixar_mensalidade(p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.papeis enable row level security;
alter table public.contatos enable row level security;
alter table public.observacoes_internas enable row level security;
alter table public.instrumentos enable row level security;
alter table public.professor_instrumentos enable row level security;
alter table public.horarios enable row level security;
alter table public.matriculas enable row level security;
alter table public.aulas enable row level security;
alter table public.recados enable row level security;
alter table public.mensalidades enable row level security;
alter table public.configuracao_escola enable row level security;

create policy perfis_ler on public.perfis
  for select to authenticated
  using (
    id = auth.uid()
    or private.e_administrador()
    or private.leciona_para(id)
    or private.estuda_com(id)
  );

create policy perfis_atualizar on public.perfis
  for update to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

create policy papeis_ler on public.papeis
  for select to authenticated
  using (user_id = auth.uid() or private.e_administrador());

create policy contatos_ler on public.contatos
  for select to authenticated
  using (
    perfil_id = auth.uid()
    or private.e_administrador()
    or private.leciona_para(perfil_id)
  );

create policy contatos_escrever on public.contatos
  for all to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

create policy observacoes_admin on public.observacoes_internas
  for all to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

create policy instrumentos_ler on public.instrumentos
  for select to authenticated
  using (true);

create policy instrumentos_escrever on public.instrumentos
  for all to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

create policy professor_instrumentos_ler on public.professor_instrumentos
  for select to authenticated
  using (private.e_administrador() or professor_id = auth.uid());

create policy professor_instrumentos_escrever on public.professor_instrumentos
  for all to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

create policy horarios_ler on public.horarios
  for select to authenticated
  using (private.e_administrador() or professor_id = auth.uid());

create policy horarios_inserir on public.horarios
  for insert to authenticated
  with check (
    private.e_administrador()
    or (professor_id = auth.uid() and private.tem_papel(auth.uid(), 'professor'))
  );

create policy horarios_atualizar on public.horarios
  for update to authenticated
  using (private.e_administrador() or professor_id = auth.uid())
  with check (private.e_administrador() or professor_id = auth.uid());

create policy horarios_apagar on public.horarios
  for delete to authenticated
  using (
    (private.e_administrador() or professor_id = auth.uid())
    and not exists (
      select 1 from public.matriculas
      where matriculas.horario_id = horarios.id
    )
  );

create policy matriculas_ler on public.matriculas
  for select to authenticated
  using (
    private.e_administrador()
    or professor_id = auth.uid()
    or aluno_id = auth.uid()
  );

create policy matriculas_inserir on public.matriculas
  for insert to authenticated
  with check (private.e_administrador());

create policy matriculas_atualizar on public.matriculas
  for update to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

create policy aulas_ler on public.aulas
  for select to authenticated
  using (
    private.e_administrador()
    or professor_id = auth.uid()
    or aluno_id = auth.uid()
  );

create policy recados_ler on public.recados
  for select to authenticated
  using (
    exists (
      select 1 from public.aulas
      where aulas.id = recados.aula_id
    )
  );

create policy recados_inserir on public.recados
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (
      private.e_administrador()
      or exists (
        select 1 from public.aulas
        where aulas.id = aula_id
          and aulas.professor_id = auth.uid()
      )
    )
  );

create policy recados_atualizar on public.recados
  for update to authenticated
  using (private.e_administrador() or autor_id = auth.uid())
  with check (
    private.e_administrador()
    or (
      autor_id = auth.uid()
      and exists (
        select 1 from public.aulas
        where aulas.id = aula_id
          and aulas.professor_id = auth.uid()
      )
    )
  );

create policy recados_apagar on public.recados
  for delete to authenticated
  using (private.e_administrador() or autor_id = auth.uid());

create policy mensalidades_ler on public.mensalidades
  for select to authenticated
  using (private.e_administrador() or aluno_id = auth.uid());

create policy configuracao_ler on public.configuracao_escola
  for select to authenticated
  using (
    private.e_administrador()
    or private.tem_papel(auth.uid(), 'aluno')
  );

create policy configuracao_atualizar on public.configuracao_escola
  for update to authenticated
  using (private.e_administrador())
  with check (private.e_administrador());

revoke all on table public.perfis from anon, authenticated;
revoke all on table public.papeis from anon, authenticated;
revoke all on table public.contatos from anon, authenticated;
revoke all on table public.observacoes_internas from anon, authenticated;
revoke all on table public.instrumentos from anon, authenticated;
revoke all on table public.professor_instrumentos from anon, authenticated;
revoke all on table public.horarios from anon, authenticated;
revoke all on table public.matriculas from anon, authenticated;
revoke all on table public.aulas from anon, authenticated;
revoke all on table public.recados from anon, authenticated;
revoke all on table public.mensalidades from anon, authenticated;
revoke all on table public.configuracao_escola from anon, authenticated;

grant select, update on public.perfis to authenticated;
grant select on public.papeis to authenticated;
grant select, insert, update, delete on public.contatos to authenticated;
grant select, insert, update, delete on public.observacoes_internas to authenticated;
grant select, insert, update, delete on public.instrumentos to authenticated;
grant select, insert, update, delete on public.professor_instrumentos to authenticated;
grant select, insert, update, delete on public.horarios to authenticated;
grant select, insert, update (valor_mensal_centavos, situacao) on public.matriculas to authenticated;
grant select on public.aulas to authenticated;
grant select, insert, update, delete on public.recados to authenticated;
grant select on public.mensalidades to authenticated;
grant select, update on public.configuracao_escola to authenticated;

revoke all on function public.gerar_aulas(uuid, date) from public, anon;
revoke all on function public.remarcar_aula(uuid, timestamptz) from public, anon;
revoke all on function public.cancelar_aula(uuid) from public, anon;
revoke all on function public.registrar_aula(uuid, text) from public, anon;
revoke all on function public.gerar_mensalidades(date) from public, anon;
revoke all on function public.baixar_mensalidade(uuid) from public, anon;

grant execute on function public.gerar_aulas(uuid, date) to authenticated;
grant execute on function public.remarcar_aula(uuid, timestamptz) to authenticated;
grant execute on function public.cancelar_aula(uuid) to authenticated;
grant execute on function public.registrar_aula(uuid, text) to authenticated;
grant execute on function public.gerar_mensalidades(date) to authenticated;
grant execute on function public.baixar_mensalidade(uuid) to authenticated;

grant execute on all functions in schema private to authenticated;

insert into public.instrumentos (nome, valor_mensal_centavos) values
  ('Canto', 20000),
  ('Pandeiro', 20000),
  ('Percussão', 20000),
  ('Violão', 20000),
  ('Piano', 20000);

insert into public.configuracao_escola (
  id, chave_pix, nome_recebedor, cidade_recebedor, vencimento_dia, mensagem_whatsapp
) values (
  1,
  '',
  'VOZEAR',
  'SAO PAULO',
  10,
  E'Olá {nome}! A mensalidade de {instrumento}, no valor de {valor}, vence em {vencimento}.\n\nPix copia-e-cola:\n{pix}'
);
