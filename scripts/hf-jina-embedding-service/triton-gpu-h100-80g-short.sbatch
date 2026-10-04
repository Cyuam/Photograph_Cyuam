#!/usr/bin/env bash
#SBATCH --job-name=jina-embed
#SBATCH --partition=gpu-h100-80g-short
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=8
#SBATCH --mem=96G
#SBATCH --time=04:00:00
#SBATCH --output=/scratch/work/lil14/jina-embedding-service/logs/%x-%j.out

set -euo pipefail

mkdir -p /scratch/work/lil14/jina-embedding-service/logs

echo "node=$(hostname)"
echo "started_at=$(date -Is)"

bash start-triton.sh
