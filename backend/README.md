# Backend (FastAPI)

Run locally:

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3001
```

Routes:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/chat/send`
- `POST /api/payment/create-checkout-session`
- `POST /api/payment/webhook`


