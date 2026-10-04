#!/usr/bin/env bash
#SBATCH --job-name=jina-embed
#SBATCH --partition=gpu-debug
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=4
#SBATCH --mem=32G
#SBATCH --time=00:30:00
#SBATCH --output=/scratch/work/lil14/jina-embedding-service/logs/%x-%j.out

set -euo pipefail

mkdir -p logs

echo "node=$(hostname)"
echo "started_at=$(date -Is)"

bash start-triton.sh
