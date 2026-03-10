# HITAM Water Intelligence Hub

A React-based dashboard for monitoring IoT water sensors, running ML predictions, and reviewing prediction analytics.

## Features

- **Navbar** with logo, title, notifications, and hamburger menu
- **Sidebar** with navigation between Home, Prediction Lab, and Node Creation pages
- **Home Page** featuring:
   - Real-time water level, temperature, and ML prediction summary cards
   - Interactive charts for water level, temperature, prediction distribution, confidence, and activity timeline
- **Node Creation Page** with form to create new sensor nodes
- **Prediction Page** to run `/api/v1/predict`, inspect model info, and view prediction history

## Installation

1. Make sure you have Node.js installed
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the development server:
   ```bash
   cp .env.example .env.local
   npm start
   ```

2. Open [http://localhost:3000](http://localhost:3000) to view in browser

## API Integration

The frontend integrates with the backend API through `REACT_APP_API_BASE_URL`.

Key endpoints used:

- `GET /sensor-data`
- `GET /tank-parameters`
- `POST /tank-parameters`
- `GET /api/v1/model-info`
- `POST /api/v1/predict`
- `GET /api/v1/predictions-history`

Make sure your backend server is running on the specified endpoint for full functionality.

## Production Deployment

### Environment Variable

Create a production environment file from [`frontend/.env.production.example`](.env.production.example):

```env
REACT_APP_API_BASE_URL=https://your-backend-service.onrender.com
```

### Deploy to Vercel

- The repository includes [`frontend/vercel.json`](vercel.json) so client-side routes work after deploy.
- Set `REACT_APP_API_BASE_URL` in the Vercel project settings.
- Build command: `npm run build`

### Deploy to Netlify

- The repository includes [`frontend/public/_redirects`](public/_redirects) for SPA routing.
- Set `REACT_APP_API_BASE_URL` in Netlify environment variables.
- Build command: `npm run build`
- Publish directory: `build`

## Project Structure

```
src/
├── components/
│   ├── Navbar.js          # Top navigation bar
│   └── Sidebar.js         # Side navigation menu
├── pages/
│   ├── Home.js           # Dashboard with sensor and prediction charts
│   ├── Prediction.js     # Prediction form and model information page
│   └── NodeCreation.js   # Sensor node creation form
├── App.js                # Main application component
├── App.css               # Global styles
└── index.js              # Application entry point
```

## Dependencies

- React 18.2.0
- React Router DOM 6.3.0
- Recharts 2.5.0 (for graphs)
- Axios 1.4.0 (for API calls)