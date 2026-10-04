#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

module load scicomp-python-env/2025.2

SCRATCH_DIR="${SCRATCH_DIR:-/scratch/work/${USER}/jina-embedding-service}"
mkdir -p "$SCRATCH_DIR"

export PIP_CACHE_DIR="${PIP_CACHE_DIR:-$SCRATCH_DIR/.cache/pip}"
export HF_HOME="${HF_HOME:-$SCRATCH_DIR/.cache/huggingface}"
export HF_HUB_CACHE="${HF_HUB_CACHE:-$HF_HOME/hub}"
export TRANSFORMERS_CACHE="${TRANSFORMERS_CACHE:-$HF_HOME/transformers}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$SCRATCH_DIR/.cache}"

PYTHON_SITE="${PYTHON_SITE:-$SCRATCH_DIR/python-site}"
mkdir -p "$PYTHON_SITE"

if [ "${INSTALL_DEPS:-1}" = "1" ]; then
  python -m pip install --no-compile --target "$PYTHON_SITE" \
    "transformers>=5.1.0" \
    "peft==0.19.1"
fi

export PYTHONPATH="$PYTHON_SITE:${PYTHONPATH:-}"

export MODEL_ID="${MODEL_ID:-jinaai/jina-embeddings-v5-omni-small}"
export MODEL_NAME="${MODEL_NAME:-jina-embeddings-v5-omni-small}"
export EMBEDDING_DIMENSIONS="${EMBEDDING_DIMENSIONS:-1024}"

exec python -m uvicorn app:app --host 0.0.0.0 --port "${PORT:-7860}"
