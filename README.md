# what2eat

`what2eat` is a full-stack food management app with:

- `server`: FastAPI + PostgreSQL + Redis
- `web`: React + Vite
- OpenAI-compatible model provider for embeddings, rerank, and optional chat reasons

## Prerequisites

- Docker + Docker Compose
- Python 3.12+
- `uv`
- Node.js 20+
- `pnpm`
- one OpenAI-compatible model provider, such as vLLM, SGLang, LM Studio, or a cloud API

## Ports

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Local model provider example: `http://localhost:8001`
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

## 1. Start PostgreSQL And Redis

From the project root:

```bash
docker compose up -d
```

## 2. Start A Model Provider

Run a model provider first if you want embedding-based recall or LLM-generated reasons. The backend speaks OpenAI-compatible HTTP APIs and is not tied to one provider.

Example vLLM embedding server:

```bash
vllm serve /home/starwind/projects/model_workspace/models/Qwen3-Embedding-0.6B \
  --served-model-name Qwen3-Embedding-0.6B \
  --port 8001 \
  --max-model-len 8192 \
  --trust-remote-code
```

Example backend model config:

```text
EMBEDDING_ENDPOINT=http://127.0.0.1:8001/v1/embeddings
EMBEDDING_MODEL=Qwen3-Embedding-0.6B
```

SGLang, LM Studio, and cloud providers can be used by pointing the endpoint variables at their OpenAI-compatible routes, for example:

```text
CHAT_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions
CHAT_MODEL=local-chat-model
RERANK_ENDPOINT=http://127.0.0.1:8002/rerank
RERANK_MODEL=local-reranker
MODEL_API_KEY=your-cloud-api-key
```

When `MODEL_API_KEY` is set, requests include `Authorization: Bearer <key>`. Use `MODEL_API_KEY_HEADER` and `MODEL_API_KEY_SCHEME` if a provider expects a different header format.

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
- Use the provider-neutral model variables such as `EMBEDDING_ENDPOINT`, `CHAT_ENDPOINT`, and `RERANK_ENDPOINT`.
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
2. start a model provider, such as `vllm serve ... --port 8001`
3. start backend in `server/`
4. start frontend in `web/`
