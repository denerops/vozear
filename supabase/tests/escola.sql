begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'admin.teste@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Ada Teste"}',
    now(), now(), 'confirm-admin', 'recovery-admin', 'change-admin', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'lina.teste@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Lina Teste"}',
    now(), now(), 'confirm-lina', 'recovery-lina', 'change-lina', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'noa.teste@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Noa Teste"}',
    now(), now(), 'confirm-noa', 'recovery-noa', 'change-noa', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated', 'mel.teste@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Mel Teste"}',
    now(), now(), 'confirm-mel', 'recovery-mel', 'change-mel', ''
  );

insert into public.papeis (user_id, papel) values
  ('11111111-1111-1111-1111-111111111111', 'administrador'),
  ('22222222-2222-2222-2222-222222222222', 'professor'),
  ('33333333-3333-3333-3333-333333333333', 'aluno'),
  ('44444444-4444-4444-4444-444444444444', 'aluno');

insert into public.contatos (perfil_id, telefone) values
  ('22222222-2222-2222-2222-222222222222', '11911111111'),
  ('33333333-3333-3333-3333-333333333333', '11922222222'),
  ('44444444-4444-4444-4444-444444444444', '11933333333');

insert into public.professor_instrumentos (professor_id, instrumento_id)
select '22222222-2222-2222-2222-222222222222', id
from public.instrumentos
where nome = 'Violão';

insert into public.horarios (id, professor_id, dia_semana, inicio_minuto, duracao_minutos)
values ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 2, 1140, 50);

insert into public.matriculas (
  id, aluno_id, professor_id, instrumento_id, horario_id, valor_mensal_centavos, inicio_em,
  dia_semana, inicio_minuto, duracao_minutos
)
select
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  id,
  '55555555-5555-5555-5555-555555555555',
  18000,
  '2026-11-10',
  0, 0, 30
from public.instrumentos
where nome = 'Violão';

insert into public.aulas (
  id, matricula_id, data_serie, inicio, duracao_minutos, professor_id, aluno_id, instrumento_id
)
select
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '2026-11-17',
  '2026-11-17 19:00:00-03',
  50,
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  id
from public.instrumentos
where nome = 'Violão';

insert into public.mensalidades (
  id, matricula_id, aluno_id, instrumento_id, competencia, valor_centavos, vencimento, pix_txid
)
select
  '88888888-8888-8888-8888-888888888888',
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  id,
  '2026-11-01',
  18000,
  '2026-11-10',
  'TESTENOVEMBRO00000000001'
from public.instrumentos
where nome = 'Violão';

insert into public.observacoes_internas (aluno_id, texto)
values ('33333333-3333-3333-3333-333333333333', 'observação só da administração');

select ok(
  not exists (
    select 1
    from pg_class as relacao
    join pg_namespace as esquema on esquema.oid = relacao.relnamespace
    where esquema.nspname = 'public'
      and relacao.relkind = 'r'
      and not relacao.relrowsecurity
  ),
  'todas as tabelas públicas têm RLS'
);

select throws_ok(
  $$ insert into public.horarios (professor_id, dia_semana, inicio_minuto, duracao_minutos)
     values ('22222222-2222-2222-2222-222222222222', 2, 1160, 50) $$,
  '23P01',
  'conflicting key value violates exclusion constraint "horarios_sem_sobreposicao"',
  'horário do mesmo professor não pode encostar'
);

set local role anon;
select throws_ok(
  $$ select id from public.perfis $$,
  '42501',
  'permission denied for table perfis',
  'visitante não lê perfis'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  exists (select 1 from public.perfis where id = '33333333-3333-3333-3333-333333333333'),
  'aluno lê o próprio perfil'
);
select ok(
  not exists (select 1 from public.perfis where id = '44444444-4444-4444-4444-444444444444'),
  'aluno não lê outro aluno'
);
select ok(
  exists (select 1 from public.perfis where id = '22222222-2222-2222-2222-222222222222'),
  'aluno lê o nome do próprio professor'
);
select is_empty(
  $$ select telefone from public.contatos where perfil_id = '22222222-2222-2222-2222-222222222222' $$,
  'aluno não lê o telefone do professor'
);
select is(
  (select count(*) from public.mensalidades)::integer,
  1,
  'aluno lê só a própria mensalidade'
);
select is_empty($$ select aluno_id from public.observacoes_internas $$, 'aluno não lê observação interna');
select throws_ok(
  $$ select public.baixar_mensalidade('88888888-8888-8888-8888-888888888888') $$,
  'P0001',
  'sem permissão',
  'aluno não dá baixa'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select telefone from public.contatos where perfil_id = '33333333-3333-3333-3333-333333333333'),
  '11922222222',
  'professor lê o telefone do próprio aluno'
);
select ok(
  not exists (select 1 from public.perfis where id = '44444444-4444-4444-4444-444444444444'),
  'professor não lê aluno que não é seu'
);
select is_empty($$ select id from public.mensalidades $$, 'professor não lê mensalidade');
select is_empty($$ select aluno_id from public.observacoes_internas $$, 'professor não lê observação interna');

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(public.gerar_aulas('66666666-6666-6666-6666-666666666666', '2027-01-06') > 0, 'gera as próximas aulas');
select is(public.gerar_aulas('66666666-6666-6666-6666-666666666666', '2027-01-06'), 0, 'não recria aula já gerada');
select lives_ok(
  $$ select public.cancelar_aula('77777777-7777-7777-7777-777777777777') $$,
  'cancela uma ocorrência'
);
select is(public.gerar_aulas('66666666-6666-6666-6666-666666666666', '2027-01-06'), 0, 'aula cancelada não volta');

select throws_ok(
  $$ select public.remarcar_aula(
       (select id from public.aulas where matricula_id = '66666666-6666-6666-6666-666666666666' and situacao = 'prevista' order by inicio limit 1 offset 1),
       (select inicio from public.aulas where matricula_id = '66666666-6666-6666-6666-666666666666' and situacao = 'prevista' order by inicio limit 1)
     ) $$,
  '23P01',
  'conflicting key value violates exclusion constraint "aulas_professor_sem_sobreposicao"',
  'remarcação não pode cair em cima de outra aula'
);

select * from finish();
rollback;
