#!/bin/bash

# Clean up background processes on exit
trap "echo 'Shutting down services...'; kill 0" EXIT

echo "🚀 Starting Scrapling UI Backend (FastAPI on http://127.0.0.1:8000)..."
cd backend
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload &

# Wait a brief moment for backend to initialize
sleep 1.5

echo "⚡ Starting Scrapling UI Frontend (Vite on http://localhost:5173)..."
cd ../frontend
bun run dev &

# Keep script running to monitor logs
wait
