# PropVault (VeriTrack Solutions)

Municipal Assessor Information System for the **Municipality of Rizal, Palawan** — web app, REST API, and desktop (Electron).

## Stack

| Layer | Technology |
|--------|------------|
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui, Recharts |
| **API** | Node.js, Express, JWT auth |
| **Database** | **PostgreSQL** (local) — scalable, supports many users and concurrent access |
| **Desktop** | Electron (wraps the same web UI + local API) |

Bootstrap 5 is loaded for extra responsive utilities; primary styling uses Tailwind.

## Features

- Role-based access: Admin, Provincial Assessor, Staff, Property Owner
- No public registration (admin-created accounts only)
- Property records: land, buildings, machinery
- Certification requests with approval workflow
- Notifications, audit trail, GIS map view, printable reports
- Settings: barangays, classifications, assessment levels, backup

## PostgreSQL setup (local PC — Windows)

### 1. Install PostgreSQL

Download and install from [postgresql.org](https://www.postgresql.org/download/windows/) (PostgreSQL 16+ recommended).

During install, note the **postgres** superuser password.

### 2. Create PropVault database

```powershell
cd server
npm install
npm run db:setup
```

If your postgres password is not `postgres`, set it first:

```powershell
$env:PG_ADMIN_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres"
npm run db:setup
```

This creates:
- Database: `propvault`
- User: `propvault` / password: `propvault`

### 3. Configure connection

Copy `server/.env.example` to `server/.env` (or edit the existing file):

```
DATABASE_URL=postgresql://propvault:propvault@localhost:5432/propvault
PORT=3001
JWT_SECRET=propvault-dev-secret-change-in-production
```

### 4. Seed demo data

```powershell
npm run seed
```

## Quick start

### Install all dependencies

```bash
npm install
```

### Run API + web

```bash
npm run dev:all
```

- Web: http://localhost:5173  
- API: http://localhost:3001/api/health  

### Desktop app

```bash
npm run desktop
```

## Demo accounts

| Username | Password | Role |
|----------|----------|------|
| `sysadmin` | `Admin@2024` | Admin |
| `p.villanueva` | `Assessor@2024` | Provincial Assessor |
| `a.macaraeg` | `Staff@2024` | Staff |
| `mc.santos.own` | `Owner@2024` | Property Owner |

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

## Production build

```bash
npm run build
cd server && npm start
# Serve dist/ with any static host; set VITE_API_URL to your API origin
```

## Database backup

Use PostgreSQL tools:

```powershell
pg_dump -U propvault -d propvault -F c -f propvault_backup.dump
```

Restore:

```powershell
pg_restore -U propvault -d propvault -c propvault_backup.dump
```

To reset demo data: drop and recreate the database, then run `npm run db:setup` and `npm run seed`.

## License

Municipality of Rizal, Palawan — internal LGU use.
