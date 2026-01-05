#!/bin/bash

# Ensure portless proxy is running on an unprivileged port
echo "Stopping any existing proxy on port 1355..."
bun x portless proxy stop --port 1355 2>/dev/null || true

echo "Starting portless proxy on port 1355..."
bun x portless proxy start --port 1355 --https

cleanup() {
    echo -e "\nStopping frontend and backend servers"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT

echo "Starting backend: api.smart-form.localhost"
cd backend
bun x portless api.smart-form --force go run cmd/server/main.go &
BACKEND_PID=$!
cd ..

echo "Starting frontend: smart-form.localhost"
cd frontend
bun x portless smart-form --force bun run dev &
FRONTEND_PID=$!
cd ..

echo "Press ctrl+c to exit"

wait $BACKEND_PID $FRONTEND_PID
