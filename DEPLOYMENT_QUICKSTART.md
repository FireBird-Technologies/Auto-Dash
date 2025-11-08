# Quick Start Deployment Guide

This is a quick reference for deploying Auto-Dash. For detailed instructions, see:
- `backend/DEPLOYMENT.md` - Backend deployment details
- `frontend/DEPLOYMENT.md` - Frontend deployment details

## Local Development Ports

- **Frontend:** `http://localhost:5173` (Vite dev server)
- **Backend:** `http://localhost:3001` (FastAPI/Uvicorn)
- **Cloud Run:** Uses port `8080` (automatically set by Cloud Run)

## Prerequisites Checklist

- [ ] Google Cloud account with billing enabled
- [ ] Vercel account
- [ ] Google Cloud SDK installed (`gcloud`)
- [ ] Vercel CLI installed (`npm i -g vercel`)
- [ ] Docker installed (for local testing)

## Backend Deployment (Google Cloud Run)

### 1. Authenticate & Setup

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
```

### 2. Deploy

```bash
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/autodash-backend
gcloud run deploy autodash-backend \
  --image gcr.io/YOUR_PROJECT_ID/autodash-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

### 3. Set Environment Variables

Go to Cloud Run Console → Your Service → Edit & Deploy → Variables & Secrets

**Required Variables:**
- `FRONTEND_URL` = `https://your-vercel-app.vercel.app` (set after frontend deploy)
- `GOOGLE_CLIENT_ID` = Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` = Your Google OAuth Client Secret
- `GOOGLE_REDIRECT_URI` = `https://your-cloud-run-url.run.app/api/auth/google/callback`
- `JWT_SECRET` = Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `SESSION_SECRET` = Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `DATABASE_URL` = `sqlite:///./autodash.db` (or Cloud SQL PostgreSQL URL)
- `DEFAULT_MODEL` = `openai/gpt-4o-mini` (or your preferred model)
- `OPENAI_API_KEY` = Your OpenAI API key (or `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- `SESSION_HTTPS_ONLY` = `1`
- `AUTO_MIGRATE` = `1`

**Optional:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### 4. Update OAuth Redirect URI

Google Cloud Console → APIs & Services → Credentials → Edit OAuth Client
Add: `https://your-cloud-run-url.run.app/api/auth/google/callback`

## Frontend Deployment (Vercel)

### 1. Deploy

```bash
cd frontend
vercel login
vercel --prod
```

### 2. Set Environment Variable

Vercel Dashboard → Your Project → Settings → Environment Variables

Add:
- `VITE_BACKEND_URL` = `https://your-cloud-run-url.run.app`

### 3. Update Backend CORS

Go back to Cloud Run and update `FRONTEND_URL` environment variable to your Vercel URL.

## Verify Deployment

1. **Backend Health Check:**
   ```bash
   curl https://your-cloud-run-url.run.app/api/health
   ```

2. **Frontend:**
   - Visit your Vercel URL
   - Test authentication
   - Check browser console for errors

## Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Verify `FRONTEND_URL` in Cloud Run matches Vercel URL exactly |
| OAuth not working | Check redirect URI in Google Console matches Cloud Run URL |
| Database errors | For Cloud SQL, ensure service account has Cloud SQL Client role |
| Build fails | Check logs in Cloud Run or Vercel dashboard |

## Next Steps

- Set up Cloud SQL PostgreSQL for production database
- Configure custom domain in Vercel
- Set up monitoring and alerts
- Configure CI/CD pipelines

For detailed information, see the full deployment guides in `backend/DEPLOYMENT.md` and `frontend/DEPLOYMENT.md`.

