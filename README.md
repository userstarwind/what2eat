# what2eat

`what2eat` is a full-stack food management app with:

- `server`: FastAPI + PostgreSQL + Redis
- `web`: React + Vite
- `vLLM`: embedding service used for default food cache warmup and async food embedding generation

## Prerequisites

- Docker + Docker Compose
- Python 3.12+
- `uv`
- Node.js 20+
- `pnpm`
- `vllm`

## Ports

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- vLLM embeddings: `http://localhost:8001`
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

## 1. Start PostgreSQL And Redis

From the project root:

```bash
docker compose up -d
```

## 2. Start vLLM

Run vLLM first, because the backend will check and refresh default food embedding cache during startup.

```bash
vllm serve /home/starwind/projects/model_workspace/models/Qwen3-Embedding-0.6B \
  --served-model-name Qwen3-Embedding-0.6B \
  --port 8001 \
  --max-model-len 8192 \
  --trust-remote-code
```

The embeddings endpoint used by the backend is:

```text
http://127.0.0.1:8001/v1/embeddings
```

## 3. Start Backend

Open a new terminal:

```bash
cd server
uv sync
uv run uvicorn src.main:app --host 0.0.0.0 --port 8080 --reload
```

Backend runs at:

```text
http://localhost:8080
```

Notes:

- The backend loads environment variables from [server/.env](server/.env).
- On startup it will:
  - initialize PostgreSQL and Redis
  - verify or rebuild default food embedding cache
  - start the food embedding worker process

## 4. Start Frontend

Open another terminal:

```bash
cd web
pnpm install
pnpm dev
```

Frontend runs at:

```text
http://localhost:5173
```

## Environment Files

- Backend env: [server/.env](server/.env)
- Frontend env: [web/.env](web/.env)

Current backend API target in the frontend:

```text
VITE_API_BASE=http://localhost:8080
```

## Recommended Startup Order

1. `docker compose up -d`
2. start `vllm serve ... --port 8001`
3. start backend in `server/`
4. start frontend in `web/`
