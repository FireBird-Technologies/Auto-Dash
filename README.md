# AutoDash

Minimal visualization-only version of Auto-Analyst. React SPA with CSV/Excel upload, sleek chat input, D3 charts, and an Express backend exposing dummy auth, chat, and payment routes.

## Develop

Prereqs: Node 18+

Install deps (run at repo root):

```bash
npm install --workspaces
```

Run frontend:

```bash
npm run dev:front
```

Run backend (Python, FastAPI):

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3001
```

Or from repo root if uvicorn is on PATH:

```bash
npm run dev:back
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`.

## Frontend

- Landing page with Google OAuth integration
- Upload `.csv`, `.xls`, `.xlsx` to populate visualizations
- Natural language input for insights
- D3-powered interactive charts
- OAuth callback handling with token storage

Set `VITE_BACKEND_URL` env var (default: `http://localhost:3001`)

## Backend (Dummy)

Now includes real auth/billing/database:

- Google OAuth:
  - `GET /api/auth/google/login`
  - `GET /api/auth/google/callback`
- Token auth:
  - `POST /api/auth/login` issues JWT (demo username/password placeholder)
  - `GET /api/auth/me` protected via Bearer token
- Chat (protected): `POST /api/chat/send`
- Stripe: `POST /api/payment/create-checkout-session`, `POST /api/payment/webhook`
- DB: SQLite by default (set `DATABASE_URL` to Postgres later)

Env vars:

```bash
DATABASE_URL=sqlite:///./autodash.db
JWT_SECRET=change-me
JWT_TTL_MIN=120
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```


