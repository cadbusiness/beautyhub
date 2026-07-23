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

## Toujours pousser le code

Après **toute** livraison (feature, fix, refactor, migration), committer et `git push` **sans attendre** que l'utilisateur le demande. Si migration Supabase → `supabase db push --yes`. Ne jamais terminer une tâche avec du code local non poussé. Exception : l'utilisateur demande explicitement de ne pas committer/pousser.

## Shell UI — design system BeautyHub

Pages dans `src/app/(app)/` : réutiliser `ListPanel`, `ListToolbar`, `DataTable`, `FormDialog`.

- **Bord à bord** : listes, grilles, calendriers flush dans `ListPanel` — **jamais** de padding externe ni carte inset (`p-4` + `rounded-* border` / `Card`) autour du contenu.
- **Sous `SectionPanel`** (tabs marketing/caisse) : ne **pas** imbriquer `ListPanel` (double `-mx` → contenu qui touche les bords). Voir `products-manager.tsx`, `loyalty-manager.tsx`.
- Stats compactes (label xs + chiffre), pas de grosses tuiles KPI.
- Référence : `.cursor/rules/ui-list-pages.mdc` et `.cursor/rules/ui-shell-design.mdc`.
