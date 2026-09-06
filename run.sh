#!/usr/bin/env bash
# Build the app and serve it locally at http://localhost:4173
# (there is no backend — this is just a static file server).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo ">> installing deps"
  npm install
fi

echo ">> building"
npm run build

echo ">> serving dist/ (Ctrl-C to stop)"
exec npm run preview
