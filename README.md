# CampaignCodex

A digital companion for tabletop RPG campaigns: character sheets, live combat,
bestiaries, campaign chat, ravens (in-app mail) and a virtual tabletop.
Supports Shadowdark, Mörk Borg and Nimble RPG.

## Run your own instance

You need [Docker](https://docs.docker.com/get-docker/) (with Compose) or
Podman with `podman-compose`. Prebuilt images are published for `amd64` and
`arm64`, so a Raspberry Pi 4/5 or an ARM VPS works too.

**1. Get the two config files** (you don't need the rest of the source):

```bash
mkdir campaigncodex && cd campaigncodex
curl -fsSLO https://raw.githubusercontent.com/ED-551/CampaignCodex/main/compose.yaml
curl -fsSL  https://raw.githubusercontent.com/ED-551/CampaignCodex/main/.env.example -o .env
```

**2. Fill in `.env`.** Five values are required:

| Setting | What to put |
|---|---|
| `DB_PASSWORD` | output of `openssl rand -hex 32` |
| `JWT_SECRET` | output of `openssl rand -hex 64` |
| `CLIENT_URL` | the URL people will use, e.g. `https://codex.example.com`. To try it on your own machine, use `http://127.0.0.1:8080` |
| `ADMIN_USERNAME` | your admin login |
| `ADMIN_PASSWORD` | a strong password, which you change after first login |

**3. Start it:**

```bash
docker compose up -d
```

Open `http://127.0.0.1:8080` (or your `CLIENT_URL`) and log in with your
admin account. On first start the database is created and the admin account is
seeded automatically, which takes about 20 seconds.

### Day-to-day

| Task | Command |
|---|---|
| Update to the latest version | `docker compose pull && docker compose up -d` |
| View logs | `docker compose logs -f backend` |
| Stop | `docker compose down` (your data is kept) |
| Back up the database | `docker compose exec -T postgres pg_dump -U campaigncodex campaigncodex \| gzip > backup.sql.gz` |
| Restore a backup (onto a fresh install) | `docker compose up -d postgres`, then `gunzip -c backup.sql.gz \| docker compose exec -T postgres psql -U campaigncodex campaigncodex`, then `docker compose up -d` |

Data lives in two Docker volumes: `postgres_data` (the database) and
`uploads_data` (uploaded images). `docker compose down -v` **deletes both**.

Database migrations run automatically every time the backend starts, so
updating is just pulling the new images.

### Optional settings

All optional settings are documented in `.env.example`. The most common:

- **`VTT_ENABLED=true`** turns on the virtual tabletop.
- **`RESEND_API_KEY`** sends real emails (password resets) through
  [Resend](https://resend.com). Without it, emails are printed to the backend log.
- **`HTTP_PORT`** changes the host port (default `8080`).
- **Image uploads** are off by default. Turn them on in the Admin dashboard.

### Putting it on the internet (HTTPS)

The stack serves plain HTTP on `HTTP_PORT`. Put a TLS-terminating reverse
proxy in front of it, for example [Caddy](https://caddyserver.com), which gets
certificates automatically:

```
codex.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

When you add a proxy like this (or a Cloudflare Tunnel), set `TRUST_PROXY=2`
so rate limiting sees each visitor's real IP address instead of the proxy's.

## Development

```bash
# Backend (needs a local PostgreSQL 16; see backend/.env.example)
cd backend && npm install && npm run db:migrate && npm run dev

# Frontend (proxies /api and /socket.io to localhost:3001)
cd frontend && npm install && npm run dev
```

To build and run the container images from your checkout instead of pulling them:

```bash
cp .env.example .env   # fill it in
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

Images are published to GHCR by `.github/workflows/publish.yml` on every push
to `main` (`:latest`) and on every GitHub release (`:1.2.3`, `:1.2`).
