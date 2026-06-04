# Memo Alarm

Memo Alarm is a SvelteKit and Capacitor app for turning quick notes, bookmarks, and recurring tasks into reminders that survive daily context switching. It combines a lightweight memo dashboard with local notification scheduling, Supabase sync, offline cache recovery, and share-friendly memo tools.

## What it solves

Most reminder apps separate the thing you need to remember from the context that made it important. Memo Alarm keeps both together: a memo can include text, checklist-style todos, tags, a URL, repeat rules, and one or more reminders. When the reminder fires, the user sees the original context instead of a bare alarm label.

## Features

- Memo dashboard with pinned, favorite, recent, today, and upcoming reminder sections
- Memo CRUD with tags, folders, search, URL/bookmark support, markdown rendering, and image export utilities
- Todo-oriented flows with due dates, recurring schedules, postpone/skip handling, and progress helpers
- Multiple reminder support with local notifications, service-worker coordination, snooze, and notification history
- Supabase-backed auth and sync with localStorage cache-first loading and offline fallback
- Share route and QR/share helpers for moving memo content between devices or contexts
- Mobile shell support through Capacitor Android and web deployment through Cloudflare Workers

## Architecture

The app is built around Svelte 5 stores and small route-level surfaces:

- `src/routes/+page.svelte` composes the dashboard and memo workflows.
- `src/lib/stores/memos.svelte.ts` owns memo state, cache-first loading, Supabase sync, realtime subscription, and recurrence recovery.
- `src/lib/stores/notifications.svelte.ts` coordinates browser/service-worker notification delivery, snooze state, and notification history.
- `src/lib/services/supabase.ts`, `memoMapper.ts`, and `syncQueue.ts` isolate backend mapping and sync behavior.
- `src/service-worker.ts` handles scheduled reminder messages outside the foreground page.
- `capacitor.config.ts` configures the Android wrapper and local notification icon behavior.
- `wrangler.toml` targets Cloudflare Workers for the web build.

## Tech stack

- SvelteKit 2, Svelte 5, TypeScript, Vite
- Tailwind CSS 4 and lucide-svelte
- Supabase Auth, database sync, and realtime updates
- Firebase/FCM and browser/service-worker notification paths
- Capacitor Android and Local Notifications
- Cloudflare Workers deployment through `@sveltejs/adapter-cloudflare`

## Local development

```powershell
npm install
npm run dev
```

The app expects Supabase and notification-related public configuration through local environment files or deployment variables. Do not commit real credentials. `wrangler.toml` intentionally avoids `[vars]` placeholders so dashboard-managed production values are not overwritten by deploys.

## Checks

```powershell
npm run check
npm run build
```

## Security notes

- Real runtime secrets belong in ignored local files or deployment dashboards.
- Public Supabase anon keys are treated as client configuration, but examples should use placeholders unless a real demo backend is intentionally exposed.
- Notification and sync code is written to preserve local cache behavior when network or auth state changes.

## Status

This repository is a portfolio/publication candidate. The README is intended to make the product goal, app architecture, and implementation depth understandable from the first page.