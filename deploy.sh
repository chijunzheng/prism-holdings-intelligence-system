#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="bigquery-etl-488322"
REGION="us-central1"
SERVICE_NAME="prism"
REPO_NAME="prism"
GIT_SHA=$(git rev-parse --short HEAD)
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${GIT_SHA}"

echo "==> Verifying GCP authentication..."
gcloud auth print-access-token > /dev/null 2>&1 || { echo "ERROR: Not authenticated. Run 'gcloud auth login'"; exit 1; }

echo "==> Ensuring Artifact Registry repo exists..."
gcloud artifacts repositories describe "${REPO_NAME}" \
  --project "${PROJECT_ID}" \
  --location "${REGION}" > /dev/null 2>&1 || \
gcloud artifacts repositories create "${REPO_NAME}" \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}"

# Use Cloud Build (no local Docker required)
echo "==> Building Docker image with Cloud Build (${GIT_SHA})..."
gcloud builds submit . \
  --tag "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --timeout=600

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "FIREBASE_PROJECT_ID=${PROJECT_ID},DISABLE_BACKGROUND_JOBS=1" \
  --set-secrets "GOOGLE_API_KEY=GOOGLE_API_KEY:latest"

echo "==> Deployment complete!"
gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format "value(status.url)"
