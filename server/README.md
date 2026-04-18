# Server

## Start Infrastructure

From the project root:

```bash
docker compose up -d
```

## Start vLLM

```bash
vllm serve /home/starwind/projects/model_workspace/models/Qwen3-Embedding-0.6B \
  --served-model-name Qwen3-Embedding-0.6B \
  --port 8001 \
  --max-model-len 8192 \
  --trust-remote-code
```

## Start API

```bash
cd server
uv sync
uv run uvicorn src.main:app --host 0.0.0.0 --port 8080 --reload
```

## Notes

- API reads config from [server/.env](./.env).
- Startup will validate and refresh default food embedding cache.
- Startup will also launch the embedding worker process.
