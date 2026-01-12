#!/usr/bin/env bash
set -euo pipefail

# Move into the Vite app directory
cd "$(dirname "$0")/il"

# Ensure PORT is set (Railway provides it; default for local fallback)
export PORT="${PORT:-3000}"

# Install deps and build
npm ci
npm run build

# Start the preview server bound to $PORT
npm run preview
