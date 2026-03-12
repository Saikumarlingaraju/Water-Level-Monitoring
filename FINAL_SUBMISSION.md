# Final Submission Checklist

## Deliverables Status

| # | Deliverable | Status | Evidence / What To Attach |
|---|-------------|--------|----------------------------|
| 1 | Database connection screenshot | Ready to attach | Screenshot of terminal showing `Connected!` from backend connection test |
| 2 | Working prediction API screenshot | Ready to attach | Screenshot of `/api/v1/predict` working from Swagger or terminal |
| 3 | ML training log with 4+ experiments | Ready to attach | Screenshot of `training_log.md` showing 4 experiments |
| 4 | Training curves screenshot | Ready to attach | Screenshot of `best_model_training_curves.png` |
| 5 | Improved model accuracy (higher than baseline) | Ready to attach | Show baseline 86.36% and best model 93.87% from `training_log.md` and `best_model_metadata.json` |
| 6 | Dashboard with college branding screenshot | Ready to attach | Screenshot of deployed dashboard showing logo, colors, and full college name |
| 7 | Prediction page screenshot | Pending capture | Screenshot of Prediction page on deployed frontend |
| 8 | Custom charts screenshot (2 new charts) | Pending capture | Screenshot showing Prediction Distribution and Activity Timeline or Confidence Trend |
| 9 | Deployed backend URL | Done | `https://water-level-monitoring-backend.onrender.com` |
| 10 | Deployed frontend URL | Done | `https://waterlevelmonitoring-six.vercel.app/` |
| 11 | Working deployed app screenshot | Ready to attach | Use deployed dashboard screenshot |
| 12 | Updated GitHub repository link | Done | `https://github.com/Saikumarlingaraju/Water-Level-Monitoring` |

## Deployed URLs

- Backend: `https://water-level-monitoring-backend.onrender.com`
- Frontend: `https://waterlevelmonitoring-six.vercel.app/`
- GitHub Repository: `https://github.com/Saikumarlingaraju/Water-Level-Monitoring`

## Brief Explanation

### ML Improvements Made And Accuracy Achieved

The machine learning pipeline was improved by running multiple experiments across LSTM, CNN, and GRU architectures. A tuned LSTM model with three recurrent layers, dropout, and improved training settings achieved the best performance. The final best model reached **93.87% accuracy** with **0.8386 macro-F1**, improving over the baseline LSTM accuracy of **86.36%**.

### API Endpoints Added

The backend was extended with the following APIs:

- `POST /api/v1/predict` to run ML-based water activity predictions
- `GET /api/v1/model-info` to expose deployed model metadata
- `GET /api/v1/predictions-history` to return stored prediction records

The backend also stores prediction results in PostgreSQL and loads the trained TensorFlow model from `backend/saved_models/`.

### Frontend Features Added

The frontend was updated with college branding, including the HITAM logo, green theme, and full college name in the navbar. A new Prediction page was created to display model information, accept sensor inputs, run predictions, and visualize confidence/history. The Home dashboard was enhanced with custom charts such as Prediction Distribution, Activity Timeline, and Confidence Trend.

## Challenges Faced And How They Were Solved

- **Database connectivity in codespaces:** The backend initially defaulted to localhost because environment variables were missing. This was solved by configuring the backend `.env` file with Aiven PostgreSQL credentials and verifying the connection with `get_connection()`.
- **Prediction API verification:** TensorFlow emitted CPU/CUDA warnings in the dev environment, but the API still worked correctly. The endpoints were validated using local and deployed `curl`/Swagger checks.
- **Vercel auto-deploy confusion:** The frontend deployment was initially stuck on an old commit. This was resolved by confirming the correct repo/root directory settings and redeploying the updated frontend until the latest branding changes appeared.

## Remaining Items To Capture

1. Prediction page screenshot from the deployed frontend
2. Custom charts screenshot showing at least two custom charts
3. Optional live deployed prediction screenshot for stronger Task 5 proof

## Suggested Screenshot List

1. Terminal screenshot showing database `Connected!`
2. Swagger or terminal screenshot of `/api/v1/predict`
3. Swagger or terminal screenshot of `/api/v1/model-info`
4. `training_log.md` screenshot
5. `best_model_training_curves.png` screenshot
6. Deployed dashboard screenshot with branding
7. Deployed Prediction page screenshot
8. Deployed custom charts screenshot
9. Render service page screenshot showing backend URL
10. Vercel deployment/page screenshot showing frontend URL
