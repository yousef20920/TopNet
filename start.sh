#!/bin/bash

# TopNet - Start Script
# Runs both backend and frontend servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}Starting backend on http://localhost:3001${NC}"
cd "$BACKEND_DIR"
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo -e "${GREEN}Starting frontend on http://localhost:5173${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}✅ TopNet is running!${NC}"
echo -e "   Frontend: ${BLUE}http://localhost:5173${NC}"
echo -e "   Backend:  ${BLUE}http://localhost:3001${NC}"
echo -e "   API Docs: ${BLUE}http://localhost:3001/docs${NC}"
echo -e "\nPress Ctrl+C to stop both servers.\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
