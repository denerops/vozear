# Vozear

Gestão de uma escola de música pequena: horários individuais, recados da aula e mensalidade por instrumento.

O site é estático (GitHub Pages). Os dados ficam no Supabase. A chave secreta não vai para o site; a proteção é a política de linha do banco.

## Desenvolvimento

O app fala com o projeto Supabase `vozear` (`ziaaxqkiqkzqnxprgxrq`). Não use o stack local.

```bash
npm install
cp .env.example .env
```

Preencha `.env` com a URL do projeto e a chave pública (publishable). A chave secreta não entra no site.

```bash
npm run dev
```

O primeiro administrador nasce no painel do Supabase (Authentication → Add user) e depois recebe o papel:

```sql
update public.perfis
set nome = 'Nome da pessoa'
where email = 'admin@escola.com';

insert into public.papeis (user_id, papel)
select id, 'administrador'
from public.perfis
where email = 'admin@escola.com';
```

Se essa pessoa também leciona, inclua o papel `professor`. Os convites seguintes saem de dentro do app e usam a função `invite-user`.

No painel, em Authentication → Sign In / Providers, desligue "Allow new users to sign up". Em Authentication → URL Configuration, deixe o Site URL em `https://denerops.github.io/vozear` e inclua estas URLs de redirecionamento:

- `https://denerops.github.io/vozear/acesso`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5173/acesso`
- `http://localhost:5173`
- `http://localhost:5173/acesso`

## Publicação

O workflow `.github/workflows/pages.yml` publica o branch `main` no GitHub Pages. Crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública do projeto `vozear`. A base do site é `/vozear/`.

O schema e a função `invite-user` já estão nesse projeto. Para uma migração nova:

```bash
npx supabase link --project-ref ziaaxqkiqkzqnxprgxrq
npx supabase db push
npx supabase functions deploy invite-user
```
