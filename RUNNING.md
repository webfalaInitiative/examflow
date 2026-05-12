# Run Exam-Flow (Windows)

## One-time setup

1. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Ensure PostgreSQL is running and matches `backend/.env`.
3. Initialize DB:
   - `cd backend`
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - `npm run prisma:seed`

## Daily start

From repo root:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\start-exam-flow.ps1
```

Then open `http://localhost:3000`.

## Stop services

From repo root:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\stop-exam-flow.ps1
```

## If login fails

- Confirm backend is running on `http://localhost:5000`.
- Re-run in `backend`:
  - `npm run prisma:migrate`
  - `npm run prisma:seed`
