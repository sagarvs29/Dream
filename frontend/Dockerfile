# Build and serve the Vite app in frontend/il using Node
FROM node:20-alpine AS build
WORKDIR /app

# Copy package manifests and install deps
COPY il/package*.json ./il/
RUN cd il && npm ci

# Copy source and build
COPY il/ ./il/
RUN cd il && npm run build

# Runtime stage: use a minimal Node image and serve static dist
FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm i -g serve
# Railway provides PORT at runtime; default to 3000 for local runs
ENV PORT=3000
# Expose is optional for Railway; the platform sets PORT
EXPOSE 3000
COPY --from=build /app/il/dist ./dist
# Generate runtime env.js with API_BASE_URL if provided, then start the static server
# Set API_BASE_URL in Railway (frontend service) to your backend public URL, e.g. https://<backend>.railway.app/api
ENV API_BASE_URL=
# Use shell form so $PORT and $API_BASE_URL are expanded, and bind to 0.0.0.0 inside the container
CMD ["sh", "-c", "echo \"window.__ENV__={API_BASE_URL:'${API_BASE_URL}'}\" > dist/env.js && serve -s dist -l tcp://0.0.0.0:${PORT}"]
