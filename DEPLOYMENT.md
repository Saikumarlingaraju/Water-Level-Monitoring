# Deployment Guide

This project is prepared for:

- Backend on Render
- Frontend on Vercel or Netlify
- Database on Aiven PostgreSQL

## 1. Push Code To GitHub

Before deploying, push the current code to the repository:

```bash
cd /workspaces/Water-Level-Monitoring
git add .
git commit -m "Complete CRA Program tasks 1-5 prep"
git push origin main
```

## 2. Deploy Backend On Render

Create a new Web Service in Render and connect this repository.

Use these settings:

| Setting | Value |
|---------|-------|
| Python Version | `3.11.11` |
| Environment | Python |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

You can also use the included `backend/render.yaml` if you want Render Blueprint setup.

### Backend Environment Variables

Add these variables in Render:

```env
DB_HOST=pg-1bbbc79d-waterlevelmonitor24.f.aivencloud.com
DB_PORT=10420
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD=YOUR_AIVEN_PASSWORD
DB_SSLMODE=require
MODEL_VERSION=2.0
MODEL_ACCURACY=0.9387
MODEL_CLASSES=filling,flush,geyser,no_activity,washing_machine
TEST_MODE=true
ENABLE_SENSOR_COLLECTOR=true
SENSOR_POLL_SECONDS=20
CORS_ALLOW_ORIGINS=https://YOUR-FRONTEND-DOMAIN.vercel.app
```

After the backend deploy finishes, verify these URLs:

- `/health`
- `/docs`
- `/api/v1/model-info`

## 3. Deploy Frontend On Vercel

Create a new Vercel project connected to this repository.

Use these settings:

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Create React App |
| Build Command | `npm run build` |
| Output Directory | `build` |

Set this environment variable in Vercel:

```env
REACT_APP_API_BASE_URL=https://YOUR-BACKEND.onrender.com
```

The file `frontend/vercel.json` is already included so React routes resolve correctly.

## 4. Deploy Frontend On Netlify Instead Of Vercel

If you prefer Netlify, use:

| Setting | Value |
|---------|-------|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `build` |

Set:

```env
REACT_APP_API_BASE_URL=https://YOUR-BACKEND.onrender.com
```

The files `frontend/public/_redirects` and `frontend/netlify.toml` are included for SPA routing.

## 5. Final Wiring

Once your frontend URL is ready:

1. Copy the frontend URL.
2. Update the Render backend variable `CORS_ALLOW_ORIGINS` to that URL.
3. Redeploy the backend if needed.
4. Re-test prediction flow from the deployed frontend.

## 6. What To Screenshot After Deploy

- Render backend service URL and healthy status
- Vercel or Netlify frontend URL
- Deployed dashboard home page
- Deployed prediction page
- Working prediction response from deployed app
