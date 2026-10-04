#!/usr/bin/env bash
#SBATCH --job-name=jina-embed
#SBATCH --partition=gpu-v100-32g
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=4
#SBATCH --mem=48G
#SBATCH --time=08:00:00
#SBATCH --output=/scratch/work/lil14/jina-embedding-service/logs/%x-%j.out

set -euo pipefail

mkdir -p /scratch/work/lil14/jina-embedding-service/logs

echo "node=$(hostname)"
echo "started_at=$(date -Is)"

bash start-triton.sh
