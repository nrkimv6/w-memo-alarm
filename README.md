# Memo Alarm

Memo Alarm is a personal memo, todo, bookmark, and reminder app built around one idea: notes should be able to become actions at the right time.

The app combines quick memo capture, URL-backed bookmarks, dated todos, recurring reminders, and push/local notification flows in a PWA and Android-capable codebase.

## What It Solves

Many personal note apps separate writing, reminders, links, and task follow-up into different workflows. Memo Alarm keeps those pieces in one record so a memo can also carry a due date, a reminder, a URL, tags, and progress state.

This makes the project useful for:

- Capturing a note and attaching the URL or context that explains it.
- Turning a memo into a todo with due dates, priorities, postpone, skip, and progress views.
- Receiving reminders through web/PWA and mobile notification paths.
- Opening or sharing saved context from the same place where the reminder appears.

## Core Features

- Memo dashboard with pinned, favorite, recent, and upcoming reminder sections.
- Quick memo entry, full memo editing, search, tags, folders, and sharing.
- Todo mode with today/week/all/completed filters, grouped due dates, priority labels, postpone and skip flows, undo, and stats.
- Reminder scheduling with repeated alarms, notification history, and reset tools.
- URL/bookmark support for memos and todos, including open/share helpers.
- PWA assets, service worker support, and Capacitor Android configuration.
- Supabase-backed auth/sync paths with local/offline-oriented stores and migration history.

## Architecture

The frontend is a SvelteKit 2 and Svelte 5 application. Most user-facing state lives in Svelte stores under `src/lib/stores`, with feature logic split into utility and service modules under `src/lib/utils` and `src/lib/services`.

Key areas:

- `src/routes/+page.svelte`: main memo dashboard and quick actions.
- `src/routes/todos/+page.svelte`: todo board, filters, postpone/skip flows, and stats.
- `src/routes/settings/notifications/+page.svelte`: notification settings.
- `src/lib/components/memo`: memo forms, cards, detail modal, search, share, and reminder UI.
- `src/lib/components/todo`: todo cards, forms, alert modal, postpone sheet, and stats.
- `src/lib/services/supabase.ts`: Supabase integration.
- `src/lib/fcm.ts` and `static/firebase-messaging-sw.js`: push notification path.
- `capacitor.config.ts`: Android package and native notification settings.
- `wrangler.toml`: Cloudflare Workers/Pages deployment configuration.

Data changes are tracked in SQL migration files under `data/migrations` and `migrations`.

## Tech Stack

- SvelteKit 2, Svelte 5, TypeScript, Vite
- Tailwind CSS 4
- Supabase JavaScript client
- Firebase Cloud Messaging
- Capacitor Android and local notifications
- Cloudflare adapter and Wrangler
- date-fns, QR code utilities, markdown rendering, html2canvas

## Getting Started

Install dependencies:

```powershell
npm install
```

Run the development server:

```powershell
npm run dev
```

Run type and Svelte checks:

```powershell
npm run check
```

Build for deployment:

```powershell
npm run build
```

## Environment

The app expects public Supabase and notification configuration to be supplied by the local or deployment environment. Do not commit real secrets or production values.

Typical local setup uses a gitignored `.dev.vars` or equivalent environment file for:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- Firebase/FCM public configuration used by the web push path

Cloudflare production variables should be configured in the Cloudflare dashboard. `wrangler.toml` intentionally avoids checked-in placeholder `[vars]` values so deploys do not overwrite dashboard settings.

## Mobile / PWA Notes

The project is structured as both a PWA and a Capacitor app. The Android app id is configured in `capacitor.config.ts`, and local notification settings are wired through Capacitor plugins. Web push support uses Firebase Messaging and the service worker assets in `static`.

## Project Status

Memo Alarm is an active personal productivity project. The repository contains ongoing planning and history documents under `docs/`, alongside implementation code for memo, todo, reminder, sync, and notification flows.
