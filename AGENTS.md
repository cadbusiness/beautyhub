<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Server Actions — lectures vs mutations

- **Server Actions** (`"use server"`) = mutations only (create, update, delete).
- **Never** call a Server Action from `useEffect` to read data.
- **Initial data** → SSR in `page.tsx` via `src/lib/...`.
- **Client reads after interaction** → `GET` route under `src/app/api/...` + `fetch()`.
- **Lazy-mount** forms with `useActionState` only when dialogs are open.
- **Supabase** → no fragile PostgREST embeds; separate queries + join in JS.
- Shared logic lives in `src/lib/`; actions and API routes delegate there.
