#!/bin/bash

# Clean up background processes on exit
trap "echo 'Shutting down services...'; kill 0" EXIT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Scrapling UI Backend (FastAPI on http://127.0.0.1:8000)..."
cd "$SCRIPT_DIR/backend"
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload &

# Poll for backend readiness
echo "⏳ Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8000/openapi.json > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  sleep 1
done

echo "⚡ Starting Scrapling UI Frontend (Vite on http://localhost:5173)..."
cd "$SCRIPT_DIR/frontend"
bun run dev &

# Keep script running to monitor logs
wait
