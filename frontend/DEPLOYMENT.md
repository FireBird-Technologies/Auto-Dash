# Frontend Deployment Guide (Vercel)

This guide covers deploying the Auto-Dash frontend to Vercel.

## Prerequisites

1. **Vercel Account** (sign up at https://vercel.com)
2. **Node.js** installed (for local testing)
3. **Backend deployed** to Google Cloud Run (you'll need the URL)

## Quick Deployment

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

### Option 2: Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository (GitHub, GitLab, or Bitbucket)
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click "Deploy"

## Environment Variables

After deployment, set the following environment variable:

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings > Environment Variables**
3. Add:
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** `https://your-cloud-run-url.run.app`
   - **Environment:** Production, Preview, Development (select all)

4. Redeploy after adding environment variables:
   ```bash
   vercel --prod
   ```

## Configuration

The `vercel.json` file is already configured with:
- Build command: `npm run build`
- Output directory: `dist`
- SPA routing (all routes redirect to `index.html`)

## Custom Domain (Optional)

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings > Domains**
3. Add your custom domain
4. Follow DNS configuration instructions

## Testing

After deployment:

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Check browser console for errors
3. Test authentication flow
4. Verify API calls are going to the correct backend URL

## Troubleshooting

### Build Failures
- Check that all dependencies are in `package.json`
- Verify Node.js version (Vercel uses Node 18.x by default)
- Check build logs in Vercel Dashboard

### API Connection Issues
- Verify `VITE_BACKEND_URL` is set correctly
- Check that backend CORS allows your Vercel domain
- Test backend URL directly: `curl https://your-backend-url.run.app/api/health`

### Routing Issues
- Ensure `vercel.json` has the rewrite rule for SPA routing
- Check that all routes redirect to `index.html`

## Continuous Deployment

Vercel automatically deploys when you push to your connected Git repository:
- **Production:** Deploys from `main` or `master` branch
- **Preview:** Creates preview deployments for pull requests

## Performance Optimization

Vercel automatically:
- Optimizes images
- Enables CDN caching
- Compresses assets
- Provides analytics (on paid plans)

## Cost

Vercel free tier includes:
- Unlimited personal projects
- 100GB bandwidth/month
- 100 serverless function invocations/day
- Automatic HTTPS

For production with high traffic, consider upgrading to Pro plan ($20/month).

