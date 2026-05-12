Prisma instructions

1. Ensure `DATABASE_URL` in `.env` points to your PostgreSQL instance.
2. Install deps (if not done):

```bash
cd backend
npm install
```

3. Generate Prisma client and run migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Start dev server:

```bash
npm run dev
```

If you need to reset during development:

```bash
npm run prisma:reset
npm run prisma:reset
```

5. (Optional) Run seed script to create an initial Owner user:

```bash
npm run prisma:seed
```

You can configure seed credentials via `.env` using `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD`.

6. Automated setup (Windows PowerShell)

An interactive PowerShell script is provided to create the DB user/database, write `.env`, install deps, run migrations and seed.

Run from the repository root (requires `psql` in PATH and Postgres superuser credentials):

```powershell
PowerShell -ExecutionPolicy Bypass -File .\backend\scripts\setup.ps1
```

The script will prompt for postgres superuser credentials, DB user/password, and optional seed admin credentials.
