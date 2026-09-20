# PropVault (VeriTrack Solutions)

Municipal Assessor Information System for the **Municipality of Rizal, Palawan** — web app, REST API, and desktop (Electron).

## Stack

| Layer | Technology |
|--------|------------|
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui, Recharts |
| **API** | Node.js, Express, JWT auth |
| **Database** | **PostgreSQL + PostGIS in Docker** — the app connects automatically; you never enter a database password |
| **Desktop** | Electron (wraps the same web UI + local API) |

Bootstrap 5 is loaded for extra responsive utilities; primary styling uses Tailwind.

## Features

- Role-based access: Admin, Provincial Assessor, Staff, Property Owner
- No public registration (admin-created accounts only)
- Property records: land, buildings, machinery
- Certification requests with approval workflow
- Notifications, audit trail, GIS map view, printable reports
- Settings: barangays, classifications, assessment levels, backup

## Quick start (Docker)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it. You do **not** install PostgreSQL on Windows, and you do **not** type a database password.

```powershell
docker compose up --build
```

Then open **http://localhost:8081**

| Service | How you use it |
|---------|----------------|
| Web | http://localhost:8081 |
| API | http://localhost:8081/api/health (proxied) or http://localhost:3001/api/health |
| Database | Inside Docker only. The API container connects by itself. |

Demo accounts are seeded on first start. Stop with `docker compose down`. Data stays in the Docker volume; add `-v` only if you want to wipe the database.

To change the web/API host ports, copy `.env.example` to `.env`. That file is optional.

## Local UI development (optional)

The database still runs in Docker. Do not install PostgreSQL on the PC.

```powershell
docker compose up --build
npm install
npm run dev
```

Vite: http://localhost:5173 (proxies `/api` to the Docker API on port 3001).

## Demo accounts

| Username | Password | Role |
|----------|----------|------|
| `sysadmin` | `Admin@2024` | Admin |
| `m.santos` | `Treasury@2024` | Treasury |
| `a.macaraeg` | `Staff@2024` | Staff Assessor |
| `c.tamayo` | `Staff@2024` | Staff Assessor |
| `it.support` | `IT@2024` | IT |

## API overview

Base URL: `/api` (proxied in dev)

- `POST /auth/login` — login with CAPTCHA
- `GET /properties/land|buildings|machinery` — property lists (filtered for owners)
- `GET|POST /certifications` — certification requests
- `GET /notifications` — in-app notifications
- `GET /dashboard/stats` — dashboard analytics
- `GET|POST /users` — user management (Admin)
- `GET /audit` — audit trail (Admin)
- `GET|POST /settings/*` — system settings

## Production / always-on

Keep Docker Desktop running. Containers restart on their own (`restart: unless-stopped`).

```powershell
docker compose up --build -d
```

Desktop app (optional, still uses the Docker API):

```powershell
npm run desktop
```

## Database backup

Postgres lives in Docker. Backup from the container (no host password):

```powershell
docker compose exec db pg_dump -U propvault -d propvault -F c -f /tmp/propvault.dump
docker compose cp db:/tmp/propvault.dump .\propvault_backup.dump
```

Restore:

```powershell
docker compose cp .\propvault_backup.dump db:/tmp/propvault.dump
docker compose exec db pg_restore -U propvault -d propvault -c /tmp/propvault.dump
```

To wipe and reseed: `docker compose down -v` then `docker compose up --build`.

## License

Municipality of Rizal, Palawan — internal LGU use.
