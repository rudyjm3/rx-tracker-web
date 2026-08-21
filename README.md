# rx-tracker-web

Next.js app for the web version of the medication tracking project.
`rudyjm3/rx-tracker` is the reference repo built with PHP/MySQL, JS, and CSS.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth) via `@supabase/ssr`
- TanStack Query for data fetching/caching

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase project's URL and anon key
(Project Settings → API in the Supabase dashboard):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Run the schema SQL for this project against your Supabase project before
signing up/in — auth and every data page depend on it.

```bash
npm run dev
```

Without `.env.local` configured, the app still builds and the auth pages
render, but sign-in/sign-up calls will fail until real Supabase credentials
are set.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
