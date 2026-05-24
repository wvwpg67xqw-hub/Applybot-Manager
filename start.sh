#!/bin/bash
set -e

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building frontend..."
BASE_PATH=/dashboard pnpm --filter @workspace/apply-site run build

echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

echo "==> Starting server..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
