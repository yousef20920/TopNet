#!/bin/bash

# TopNet - Start Script
# Runs both backend and frontend servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
DEFAULT_BACKEND_PORT=3001
DEFAULT_FRONTEND_PORT=5173

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_PID=""
FRONTEND_PID=""
BACKEND_STARTED_BY_SCRIPT=false
FRONTEND_STARTED_BY_SCRIPT=false
BACKEND_PORT=""
FRONTEND_PORT=""

is_port_listening() {
    local port="$1"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

find_available_port() {
    local port="$1"
    while is_port_listening "$port"; do
        port=$((port + 1))
    done
    echo "$port"
}

backend_healthy() {
    curl -fsS "http://localhost:${BACKEND_PORT}/docs" >/dev/null 2>&1
}

frontend_healthy() {
    curl -fsS "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1
}

echo -e "${BLUE}🌐 Starting TopNet...${NC}"

# Check if backend venv exists, create if not
if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${BLUE}Creating Python virtual environment...${NC}"
    cd "$BACKEND_DIR"
    python3 -m venv .venv
    .venv/bin/pip install -e .
fi

# Check if frontend node_modules exists, install if not
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR"
    npm install
fi

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down...${NC}"
    if [ "$BACKEND_STARTED_BY_SCRIPT" = true ] && [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ "$FRONTEND_STARTED_BY_SCRIPT" = true ] && [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Pick available ports
BACKEND_PORT="$(find_available_port "$DEFAULT_BACKEND_PORT")"
FRONTEND_PORT="$(find_available_port "$DEFAULT_FRONTEND_PORT")"

if [ "$BACKEND_PORT" != "$DEFAULT_BACKEND_PORT" ]; then
    echo -e "${BLUE}Backend port ${DEFAULT_BACKEND_PORT} is in use, using ${BACKEND_PORT}.${NC}"
fi

if [ "$FRONTEND_PORT" != "$DEFAULT_FRONTEND_PORT" ]; then
    echo -e "${BLUE}Frontend port ${DEFAULT_FRONTEND_PORT} is in use, using ${FRONTEND_PORT}.${NC}"
fi

# Start backend
echo -e "${GREEN}Starting backend on http://localhost:${BACKEND_PORT}${NC}"
cd "$BACKEND_DIR"
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!
BACKEND_STARTED_BY_SCRIPT=true

BACKEND_READY=false
for _ in {1..20}; do
    if backend_healthy; then
        BACKEND_READY=true
        break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        break
    fi
    sleep 1
done

if [ "$BACKEND_READY" != true ]; then
    echo -e "${RED}Backend failed to start on port ${BACKEND_PORT}.${NC}"
    exit 1
fi

# Start frontend
echo -e "${GREEN}Starting frontend on http://localhost:${FRONTEND_PORT}${NC}"
cd "$FRONTEND_DIR"
VITE_API_BASE_URL="http://localhost:${BACKEND_PORT}" npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!
FRONTEND_STARTED_BY_SCRIPT=true

FRONTEND_READY=false
for _ in {1..20}; do
    if frontend_healthy; then
        FRONTEND_READY=true
        break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        break
    fi
    sleep 1
done

if [ "$FRONTEND_READY" != true ]; then
    echo -e "${RED}Frontend failed to start on port ${FRONTEND_PORT}.${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ TopNet is running!${NC}"
echo -e "   Frontend: ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "   Backend:  ${BLUE}http://localhost:${BACKEND_PORT}${NC}"
echo -e "   API Docs: ${BLUE}http://localhost:${BACKEND_PORT}/docs${NC}"
echo -e "\nPress Ctrl+C to stop both servers.\n"

wait "$BACKEND_PID" "$FRONTEND_PID"
