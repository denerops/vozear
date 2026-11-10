-- Contas só para o Supabase local. Senha de todas: vozear-local-1

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'authenticated', 'authenticated', 'ada@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Ada Admin"}',
    now(), now(), 'seed-confirm-ada', 'seed-recovery-ada', 'seed-change-ada', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'authenticated', 'authenticated', 'lina@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Lina Professor"}',
    now(), now(), 'seed-confirm-lina', 'seed-recovery-lina', 'seed-change-lina', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    'authenticated', 'authenticated', 'noa@vozear.local',
    extensions.crypt('vozear-local-1', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Noa Aluno"}',
    now(), now(), 'seed-confirm-noa', 'seed-recovery-noa', 'seed-change-noa', ''
  );

insert into auth.identities (user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1","email":"ada@vozear.local"}', 'email', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', now(), now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2","email":"lina@vozear.local"}', 'email', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', now(), now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3","email":"noa@vozear.local"}', 'email', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', now(), now(), now());

insert into public.papeis (user_id, papel) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'administrador'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'professor'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'professor'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'aluno');

insert into public.contatos (perfil_id, telefone, instagram) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11900000001', ''),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11900000002', 'lina.voz'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '11900000003', 'noa.voz');

insert into public.professor_instrumentos (professor_id, instrumento_id)
select professor.id, instrumento.id
from public.perfis as professor
join public.instrumentos as instrumento on instrumento.nome in ('Violão', 'Canto')
where professor.email = 'lina@vozear.local';

insert into public.professor_instrumentos (professor_id, instrumento_id)
select professor.id, instrumento.id
from public.perfis as professor
join public.instrumentos as instrumento on instrumento.nome = 'Piano'
where professor.email = 'ada@vozear.local';

insert into public.horarios (id, professor_id, dia_semana, inicio_minuto, duracao_minutos)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  2, 1140, 50
);

insert into public.matriculas (
  id, aluno_id, professor_id, instrumento_id, horario_id, valor_mensal_centavos, inicio_em,
  dia_semana, inicio_minuto, duracao_minutos
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  instrumento.id,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  18000,
  '2026-11-10',
  0, 0, 30
from public.instrumentos as instrumento
where instrumento.nome = 'Violão';

insert into public.aulas (
  matricula_id, data_serie, inicio, duracao_minutos, professor_id, aluno_id, instrumento_id
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  dia::date,
  (dia::date + time '19:00') at time zone 'America/Sao_Paulo',
  50,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  instrumento.id
from generate_series('2026-11-10'::date, '2027-01-05'::date, interval '7 days') as dia
cross join public.instrumentos as instrumento
where instrumento.nome = 'Violão';

insert into public.mensalidades (
  matricula_id, aluno_id, instrumento_id, competencia, valor_centavos, vencimento, pix_txid
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  instrumento.id,
  '2026-11-01',
  18000,
  '2026-11-10',
  'SEEDNOVEMBRO00000000001'
from public.instrumentos as instrumento
where instrumento.nome = 'Violão';

insert into public.observacoes_internas (aluno_id, texto)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Gosta de começar a aula com um aquecimento curto.');

update public.configuracao_escola
set chave_pix = 'vozear@escola.com'
where id = 1;
