# Deployment Guide

This guide covers deploying Auto-Dash backend to Google Cloud Run and frontend to Vercel.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Vercel Account** (free tier works)
3. **Google Cloud SDK** installed: https://cloud.google.com/sdk/docs/install
4. **Docker** installed (for local testing)

## Backend Deployment (Google Cloud Run)

### Step 1: Set Up Google Cloud Project

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 2: Build and Deploy

#### Option A: Manual Deployment

```bash
cd backend

# Build the Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/autodash-backend

# Deploy to Cloud Run
gcloud run deploy autodash-backend \
  --image gcr.io/YOUR_PROJECT_ID/autodash-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "FRONTEND_URL=https://your-vercel-app.vercel.app"
```

#### Option B: Using Cloud Build (CI/CD)

```bash
# Trigger Cloud Build from the backend directory
gcloud builds submit --config cloudbuild.yaml
```

### Step 3: Set Environment Variables

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on your service: `autodash-backend`
3. Click "Edit & Deploy New Revision"
4. Go to "Variables & Secrets" tab
5. Add all environment variables from `env.template`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (should be: `https://your-service-url.run.app/api/auth/google/callback`)
   - `FRONTEND_URL` (your Vercel frontend URL)
   - `JWT_SECRET` (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
   - `SESSION_SECRET` (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
   - `DATABASE_URL` (see Database Setup below)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `DEFAULT_MODEL` (e.g., `openai/gpt-4o-mini`)
   - `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` based on your model)
   - `SESSION_HTTPS_ONLY=1`
   - `AUTO_MIGRATE=1`

### Step 4: Update OAuth Redirect URI

1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://your-cloud-run-url.run.app/api/auth/google/callback`
4. Save changes

### Step 5: Database Setup

#### Option A: Cloud SQL PostgreSQL (Recommended for Production)

1. Create a Cloud SQL PostgreSQL instance:
   ```bash
   gcloud sql instances create autodash-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1
   ```

2. Create a database:
   ```bash
   gcloud sql databases create autodash --instance=autodash-db
   ```

3. Create a user:
   ```bash
   gcloud sql users create autodash-user \
     --instance=autodash-db \
     --password=YOUR_SECURE_PASSWORD
   ```

4. Update `requirements.txt` to include:
   ```
   psycopg2-binary==2.9.9
   ```

5. Set `DATABASE_URL` in Cloud Run:
   ```
   postgresql://autodash-user:YOUR_PASSWORD@/autodash?host=/cloudsql/YOUR_PROJECT_ID:us-central1:autodash-db
   ```

6. Connect Cloud Run to Cloud SQL:
   ```bash
   gcloud run services update autodash-backend \
     --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:autodash-db \
     --region=us-central1
   ```

#### Option B: SQLite (Development Only)

SQLite will work but data will be lost when the container restarts. Not recommended for production.

Set `DATABASE_URL=sqlite:///./autodash.db` in Cloud Run environment variables.

## Frontend Deployment (Vercel)

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Deploy

```bash
cd frontend

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

### Step 3: Set Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings > Environment Variables
4. Add:
   - `VITE_BACKEND_URL` = `https://your-cloud-run-url.run.app`

### Step 4: Update Backend CORS

After deploying frontend, update the `FRONTEND_URL` environment variable in Cloud Run to match your Vercel URL.

## Testing Deployment

1. **Test Backend Health:**
   ```bash
   curl https://your-cloud-run-url.run.app/api/health
   ```

2. **Test Frontend:**
   - Visit your Vercel URL
   - Check browser console for any CORS errors
   - Test authentication flow

3. **Check Logs:**
   ```bash
   # Backend logs
   gcloud run services logs read autodash-backend --region us-central1
   
   # Or view in Cloud Console
   ```

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly in Cloud Run
- Check that the frontend URL matches exactly (including https://)
- Verify CORS origins in `app/main.py`

### Database Connection Issues
- For Cloud SQL: Ensure Cloud Run service account has Cloud SQL Client role
- Check that Cloud SQL instance is in the same region
- Verify connection string format

### OAuth Issues
- Verify redirect URI matches exactly in Google Console
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure `FRONTEND_URL` is set

### Environment Variables Not Loading
- Restart Cloud Run service after adding environment variables
- Check variable names match exactly (case-sensitive)
- Verify no extra spaces in values

## Cost Optimization

- **Cloud Run:** Pay only for requests (free tier: 2 million requests/month)
- **Cloud SQL:** Use `db-f1-micro` for development, scale up for production
- **Vercel:** Free tier includes 100GB bandwidth/month

## Security Checklist

- [ ] Use strong, randomly generated secrets for `JWT_SECRET` and `SESSION_SECRET`
- [ ] Set `SESSION_HTTPS_ONLY=1` in production
- [ ] Use Cloud SQL with private IP (recommended)
- [ ] Enable Cloud Run authentication if needed (currently set to allow unauthenticated)
- [ ] Rotate API keys regularly
- [ ] Use environment variables for all secrets (never commit to git)

