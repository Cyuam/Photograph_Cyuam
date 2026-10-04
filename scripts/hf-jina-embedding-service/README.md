---
title: Jina V5 Omni Embedding Service
emoji: 🔎
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# Jina v5 Omni Embedding Service

FastAPI service for `jinaai/jina-embeddings-v5-omni-small`.

## Endpoints

- `GET /health`
- `POST /embed-image`
- `POST /embed-text`

Image request:

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "text": "optional metadata"
}
```

Text request:

```json
{
  "text": "冬天校园感",
  "task": "query"
}
```

Both endpoints return:

```json
{
  "embedding": [0.1, 0.2],
  "model": "jina-embeddings-v5-omni-small",
  "provider": "hf-jina-v5-omni",
  "dimensions": 1024
}
```

## Environment

```bash
MODEL_ID=jinaai/jina-embeddings-v5-omni-small
MODEL_NAME=jina-embeddings-v5-omni-small
EMBEDDING_DIMENSIONS=1024
EMBEDDING_API_KEY=optional-shared-secret
```

Set `EMBEDDING_API_KEY` if the service is public and should reject unknown callers.
