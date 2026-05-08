#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Sman Server Dev Mode       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"

# ── 1. 环境检查 ──────────────────────────────────────────

if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}pnpm not found. Install: npm install -g pnpm${NC}"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing server dependencies...${NC}"
  pnpm install
fi

if [ ! -d "web/node_modules" ]; then
  echo -e "${YELLOW}Installing web dependencies...${NC}"
  cd web && pnpm install && cd ..
fi

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}No .env found, copying from .env.example...${NC}"
  cp .env.example .env
fi

# ── 2. Kill existing processes ──────────────────────────────

kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}Killing existing process on :$port (PID $pid)...${NC}"
    kill $pid 2>/dev/null
    sleep 0.5
  fi
}

kill_port 5882
kill_port 4000

# ── 3. 启动服务 ──────────────────────────────────────────

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  jobs -p | xargs kill 2>/dev/null
  wait 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

echo -e "${CYAN}[1/2] Starting API server...${NC}"
pnpm dev &
sleep 1
echo -e "${GREEN}API server on :5882${NC}"

echo -e "${CYAN}[2/2] Starting admin UI dev server...${NC}"
cd web && pnpm dev &
cd ..
sleep 1
echo -e "${GREEN}Admin UI on :4000${NC}"

echo ""
echo -e "${GREEN}Ready!${NC}"
echo -e "  API:       ${CYAN}http://127.0.0.1:5882${NC}"
echo -e "  Admin UI:  ${CYAN}http://127.0.0.1:4000${NC}"
echo ""

wait
