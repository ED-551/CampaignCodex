# CampaignCodex — Claude Code Guide

## Session Startup (do this every time)

```bash
# 1. Check if dev servers are already running
lsof -ti:5173 -ti:3001 2>/dev/null | wc -l

# 2. If output is 0 (nothing running), start them:
cd /Users/foxy/Documents/CampaignCodex/backend && npm run dev > /tmp/cc-backend.log 2>&1 &
cd /Users/foxy/Documents/CampaignCodex/frontend && npm run dev > /tmp/cc-frontend.log 2>&1 &

# 3. Verify they came up
sleep 3 && curl -s http://localhost:3001/api/health && echo " backend ok"
```

**If ports are occupied but servers feel wrong:** `kill $(lsof -ti:5173 -ti:3001)` then start again.

Logs: `tail -f /tmp/cc-backend.log` and `tail -f /tmp/cc-frontend.log`

---

## Project Layout

```
/Users/foxy/Documents/CampaignCodex/
├── frontend/          Vite + React 19 + Tailwind v3
│   └── src/
│       ├── components/layout/TopBar.jsx   ← global nav (single source of truth)
│       ├── components/layout/PageShell.jsx ← wrapper for deep pages (CampaignDetail etc)
│       ├── hooks/useScrollHide.js         ← auto-hide nav on scroll
│       ├── context/                       Auth, Socket, DM, Social, Tour
│       ├── pages/                         One file per route
│       └── utils/api.js                   fetch wrapper (attaches JWT, throws on error)
├── backend/           Node.js + Express 5 + Socket.io
│   └── src/
│       ├── index.js                       entry point, all middleware wired here
│       ├── routes/                        auth, campaigns, characters, combat, etc.
│       ├── socket.js                      Socket.io event handlers
│       └── db/
│           ├── schema.sql                 full schema (run once on fresh DB)
│           └── migrations/               001–004 applied; next is 005_vtt_scenes.sql
├── compose.yaml       self-host stack (pulls GHCR images); compose.build.yaml builds locally
├── .env.example       settings for compose.yaml
└── CLAUDE.md          ← you are here
```

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind v3 |
| Icons | lucide-react only |
| Fonts | Cinzel Decorative (logo/display), Inter (body) via Google Fonts |
| Backend | Node.js, Express 5, Socket.io |
| Database | PostgreSQL 16, port 5432 |
| Auth | JWT (24h), stored in localStorage as `cc_token` |
| Email | Resend API if `RESEND_API_KEY`, else SMTP (nodemailer) if `SMTP_HOST`, else stubs to console.log — see `backend/src/config/email.js` |

### Tailwind design tokens
```
codex-bg:        #0a0b0f   page background
codex-surface:   #12141a   cards, inputs
codex-card:      #1a1d26   nested cards
codex-border:    #2a2d3a   borders
codex-gold:      #c9a84c   accent / brand
codex-goldHover: #e0bb5f   hover state
codex-subtext:              muted text (defined in tailwind.config.js)
codex-muted:                very muted text
```

---

## Auth & Roles

- Email verification: `REQUIRE_EMAIL_VERIFICATION` = true | false | auto (default auto = required only when Resend or SMTP is configured). When off, signup returns `{ token, user }` and creates the user verified; login still blocks accounts with `email_verified = false`. Admins can verify a user from the Admin dashboard (`POST /api/admin/users/:id/verify`).
- `GET /api/server-info` (public) → `{ name, apiVersion, version, emailVerificationRequired, emailConfigured, features: { vtt } }`. Read by the frontend (`hooks/useServerInfo.js`) and planned iOS app — keep the shape stable (camelCase by design, add keys only).

- JWT decoded in `requireAuth` middleware; `token_version` re-checked in DB on every request
- `user.isAdmin` → re-queried from DB on each admin call (not trusted from JWT)
- Roles: `isAdmin`, `isModerator`, `supporterTier` (free/bronze/silver/gold/platinum/black)
- Admin route: `/admin` — `adminOnly` ProtectedRoute + `requireAdmin` middleware
- Moderator route: `/moderator` — `moderatorOnly` ProtectedRoute

---

## Game Systems

Three supported systems, enforced at DB level (`CHECK` constraint):

| system key | Label | Combat notes |
|---|---|---|
| `shadowdark` | Shadowdark | Side-based initiative, d20 roll |
| `morkborg` | Mörk Borg | Same as Shadowdark, Omens pips |
| `nimble` | Nimble RPG | d20 roll = action count round 1; round 2+ = 3 actions |

Character sheets live in `frontend/src/components/character/sheets/` — one file per system, all lazy-loaded.

---

## Key Conventions

**API responses:** all keys are `snake_case`. One exception was fixed (see security audit). Never return camelCase from the backend.

**Back buttons:** always use `navigate(-1)`, never hardcode `/dashboard`. Already fixed across all pages.

**Nav:** `TopBar.jsx` is the single source of truth. Do NOT add nav to individual pages. CombatPage is the only exception (has specialized combat header).

**Socket.io:** one server, one namespace (currently). `/vtt` namespace will be added in Chunk 14.

**No hamburger on desktop.** TopBar shows all items inline on `sm` and up. Hamburger is mobile-only.

**New pages:** wrap with `<TopBar />` at top and `<div className="min-h-screen bg-codex-bg">` as the outer element. No header needed.

**Imports:** no barrel files. Import directly from the file.

---

## Features — Status

| Feature | Status |
|---|---|
| Shadowdark character sheet + wizard (7-step) | ✅ |
| Mörk Borg character sheet | ✅ |
| Nimble RPG character sheet | ✅ |
| Campaign management (CRUD, join codes, GM/player) | ✅ |
| Encounter Builder | ✅ |
| Combat Tracker (real-time, per-system initiative) | ✅ |
| Bestiary (3 systems, share system) | ✅ |
| Campaign Chat (persisted, spectator mode) | ✅ |
| Public Chatrooms (6 rooms, ephemeral) | ✅ |
| DM Widget (floating, real-time 1:1 DMs) | ✅ |
| Friends/Social system (friend requests, blocks) | ✅ |
| Raven Post (async internal mail) | ✅ |
| GM character sheet access | ✅ |
| User profiles (public + edit) | ✅ |
| Admin dashboard | ✅ |
| Moderator dashboard | ✅ |
| Easter egg `/eds-eats` (trigger: click "be" in Settings Danger Zone) | ✅ |
| Onboarding tour | ✅ |
| Security audit (5 phases, 0 CVEs) | ✅ v1.5 |
| Unified TopBar nav (Groups A+B) | ✅ |

---

## Roadmap — What's Next

### 2. Group C — DM Bubble Redesign
Current: persistent floating bubble (bottom-right).
Target:
- Remove the floating bubble
- Add 💬 icon to TopBar (right of Ravens, left of username)
- Desktop click → dropdown: DMs / Friends / Requests
- Any option → spawns a **draggable floating window** with minimize + close
- Draggable by clicking anywhere on the window header
- Minimizes to a small circle the user can reposition
- Mobile: proportional sizing, draggable so it never covers the send button
- See `frontend/src/components/dm/DMWidget.jsx` and `frontend/src/context/DMContext.jsx`

### 3. Group E — Character Sheet Fixes
- Mobile viewport: sheet must fill full width (currently shrinks to half)
- Cathedral/arch-shaped portrait area left of character name (upload or silhouette fallback)
- DnDBeyond edit model: stats locked on sheet, click "Edit" → redirects to character wizard
  - Research DnDBeyond's exact flow before implementing
  - Only HP and inventory/spells stay editable inline

### 4. Group F — Image Upload System
- Admin toggle in AdminDashboard to enable/disable uploads globally
- 1 GB quota per user
- Upload zones: profile picture, character portrait, VTT maps/tokens (GM only)
- Storage: local `/app/uploads` volume (already set up), optional S3/R2 via env var later
- Endpoint: `POST /api/upload` (already exists, just needs the admin gate)

### 5. Group G — VTT Integration (Chunk 14)
Standalone VTT is complete at `/Users/foxy/Documents/VTT/` (Chunks 1–13 done).
See Obsidian note: `CampaignCodex — VTT Build Plan.md`

Steps:
1. Move VTT source into `frontend/src/pages/vtt/`
2. Add `/vtt` Socket.io namespace → `backend/src/socket-vtt.js`
3. Run migration `005_vtt_scenes.sql` (schema in the VTT Build Plan note)
4. Add `/vtt/:campaignId` route to `App.jsx`
5. "Launch VTT" buttons on Campaign page and Encounter page
6. Replace standalone room-code auth with JWT
7. Wire encounter builder → VTT token pre-population
8. Wire character portraits → player tokens
9. Sync VTT initiative tracker with `combat_sessions`
10. Add 💬 DM icon + 🗺 VTT icon to TopBar (VTT gated by `VTT_ENABLED=true` in `.env`)

Final TopBar order: `CampaignCodex | Chatrooms | Ravens | VTT | 💬 DMs | username ▾`

### 6. Phase 0 — Containerization Hardening ✅
Self-hosting guide is in `README.md`. What's in place:

- `backend/scripts/migrate.js` — applies `schema.sql` on an empty DB, then pending migrations, tracked in `schema_migrations`
- Backend entrypoint (`scripts/docker-entrypoint.sh`): migrate → seed admin (if `ADMIN_*` set) → `node src/index.js`
- Backend image runs as `node`, has a healthcheck on `/api/health`; compose waits on it
- `frontend/nginx.conf`: `/socket.io/` upgrade block, 12 MB body limit, `^~ /uploads/`
- VTT flag is read at runtime from `/config.js` (written by the frontend container from `VTT_ENABLED`), so one image serves every instance
- `TRUST_PROXY` env var = number of proxies in front of the API (default 1)
- Root `.env.example` with generation commands; no `container_name:` in compose
- GHCR images built for amd64 + arm64 (`.github/workflows/publish.yml`)

- `GET /api/health` → `{ ok: true, status: 'ok', version, timestamp }` (version from `backend/package.json`)

---

## Database

- Schema: `backend/src/db/schema.sql` (init only — doesn't re-run if DB exists)
- Migrations applied: 001 (drop security questions), 002 (moderator/black tier/ban), 003 (banned_until), 004 (perf indexes)
- Next migration: `005_vtt_scenes.sql` (part of Chunk 14)
- `sheet_data` and `stat_data` stored as JSONB — flexible per game system
- `combatants` JSONB array: 22 allowlisted keys, documented in schema.sql comments

---

## Security Notes (from v1.5 audit)

- `isAdmin` in JWT is stale for 24h — admin role is always re-verified from DB
- CORS: `CLIENT_URL` env var is required in production; missing value is a fatal startup error
- CSP: set via `helmet()` on backend
- JWT stored in localStorage (known tradeoff, CSP mitigates XSS risk)
- Socket.io events rate-limited; GM-only events validated server-side
- All SQL queries parameterized — no injection surface

---

## Sisyphus Agent

Custom agent: `~/.claude/agents/sisyphus.md`
Skill files: `~/.claude/skills/sisyphus-*.md` — 30+ files covering every major feature.

**Before any complex task:** check if a relevant skill file exists. If it does, follow it directly.

Key skills to know:
- `sisyphus-fullstack-ttrpg-app.md` — full project runbook
- `sisyphus-campaigncodex-profile-friends-system.md` — social system + profiles
- `sisyphus-vtt-chunk11-initiative-tracker.md` through `chunk13` — VTT standalone
- `sisyphus-raycasting-visibility.md` — VTT lighting engine
- `sisyphus-websocket-socketio-react.md` — socket patterns

---

## Obsidian Vault

`/Users/foxy/Documents/ObsidianData/`

Key notes:
- `CampaignCodex — VTT Build Plan.md` — all 14 chunks, full specs
- `CampaignCodex — Containerization & VTT Roadmap.md` — docker + VTT integration plan
- `CampaignCodex - Chat & Messaging Feature Plan.md` — all chat features (all complete)
- `CampaignCodex - Code Quality & Security Review Plan.md` — audit findings + fixes
- `CampaignCodex - Deployment & Migration Runbook.md` — production deploy steps
