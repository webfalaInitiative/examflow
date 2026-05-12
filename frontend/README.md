# Exam Flow — Frontend

Quick start:

1. Copy `.env.local.example` to `.env.local` and adjust `NEXT_PUBLIC_API_URL` if needed.
2. Install dependencies:

```bash
cd frontend
npm install
```

3. Start dev server:

```bash
npm run dev
```

Pages:
- `/login` — Login
- `/register` — Register
- `/` — Dashboard (placeholder)

Background image:
- Place a full-screen background image at `frontend/public/images/auth-bg.jpg` to have it used on the login/register pages. The CSS will fall back to a decorative gradient if the image is not present.
