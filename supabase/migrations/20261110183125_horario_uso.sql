-- Um horário semanal está disponível para aula ou bloqueado.
-- Os dois ocupam a grade, então o bloqueio impede outro horário no mesmo intervalo.

alter table public.horarios
  add column uso text not null default 'disponivel'
  constraint horarios_uso check (uso in ('disponivel', 'bloqueado'));

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
  if h.uso <> 'disponivel' then
    raise exception 'horário bloqueado';
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

create or replace function private.propagar_horario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.uso = 'bloqueado' and exists (
    select 1 from public.matriculas
    where horario_id = new.id and situacao = 'ativa'
  ) then
    raise exception 'encerre a matrícula antes de bloquear o horário';
  end if;

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
