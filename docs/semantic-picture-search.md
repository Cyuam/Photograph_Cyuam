# Semantic Picture Search

The site can search pictures by comparing a text query embedding with stored image embeddings in Supabase.

## Current Storage

- Table: `picture_embeddings`
- Vector dimension: 1024 after running `docs/upgrade-picture-embeddings-1024.sql`
- RPC: `match_pictures_by_embedding`

The current table stores one embedding per picture. Do not mix embeddings from different model families in this table during a partial migration, because cosine similarity is only meaningful inside the same embedding space.

## Providers

Image backfill provider priority:

1. `IMAGE_EMBEDDING_API_URL`
2. `HF_IMAGE_EMBEDDING_API_URL`
3. `JINA_API_KEY`

Text query provider:

- Default: Hugging Face text embedding, using `HF_TOKEN`
- Custom endpoint: set `TEXT_EMBEDDING_API_URL`; if it fails and `JINA_API_KEY` exists, the API falls back to Jina
- Jina: set `SEMANTIC_EMBEDDING_PROVIDER=jina` and `JINA_API_KEY`

## Jina v5 Omni

Preferred operating order:

1. Use Triton for one-off bulk image backfills when the service is running.
2. Use Jina API as the fallback when Triton is not running.
3. Avoid deploying a always-on Hugging Face endpoint until the traffic justifies the cost.

Use these env vars for the website:

```bash
JINA_EMBEDDING_MODEL=jina-embeddings-v5-omni-small
JINA_EMBEDDING_DIMENSIONS=1024
IMAGE_EMBEDDING_API_URL=https://your-hf-service/embed-image
TEXT_EMBEDDING_API_URL=https://your-hf-service/embed-text
SEMANTIC_EMBEDDING_PROVIDER=endpoint
JINA_API_KEY=...
```

If the service is public and uses its own shared secret, also set:

```bash
IMAGE_EMBEDDING_API_KEY=...
TEXT_EMBEDDING_API_KEY=...
```

If Triton is not running, image backfill and text search can fall back to the Jina API with `JINA_API_KEY`.

## Triton Notes

The Triton service files are in `scripts/hf-jina-embedding-service`.

On Triton, keep large caches out of `/home`. The startup script uses:

```bash
SCRATCH_DIR=/scratch/work/lil14/jina-embedding-service
HF_HOME=$SCRATCH_DIR/.cache/huggingface
PYTHON_SITE=$SCRATCH_DIR/python-site
```

Useful commands:

```bash
ssh triton 'cd Projects/jina-embedding-service && sbatch --export=ALL,INSTALL_DEPS=0 triton-gpu-interactive.sbatch'
ssh triton 'squeue -u lil14'
ssh triton 'tail -f /scratch/work/lil14/jina-embedding-service/logs/jina-embed-<jobid>.out'
```

Triton deployment status as of 2026-06-15: dependencies and scratch cache setup work, but `jina-embeddings-v5-omni-small` did not reach a listening `/health` service within about two hours on `gpu-interactive`. Treat Triton local deployment as unresolved; use Jina API first for production backfill.

## Migration Flow

1. Run `docs/upgrade-picture-embeddings-1024.sql` in Supabase SQL Editor.
2. Configure either Triton service env vars or `JINA_API_KEY`.
3. Configure the local env vars above.
4. Run a small forced backfill to verify image embedding works:

```bash
npm run backfill:picture-embeddings -- --limit 3 --force
```

5. If results look good, run a full forced backfill:

```bash
npm run backfill:picture-embeddings -- --all --force
```

6. Set Vercel env vars:

```bash
JINA_EMBEDDING_MODEL=jina-embeddings-v5-omni-small
JINA_EMBEDDING_DIMENSIONS=1024
IMAGE_EMBEDDING_API_URL=https://your-hf-service/embed-image
TEXT_EMBEDDING_API_URL=https://your-hf-service/embed-text
SEMANTIC_EMBEDDING_PROVIDER=endpoint
```

7. Redeploy after the full backfill has completed.

The backfill skip check compares both `content_hash` and `model`, so changing models will trigger a new embedding even if the image content did not change.
