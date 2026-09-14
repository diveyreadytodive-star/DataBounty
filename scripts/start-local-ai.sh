#!/usr/bin/env bash
set -euo pipefail

if (($# != 0)); then
  printf '%s\n' 'This server pins one localhost model and accepts no arguments.' >&2
  exit 64
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
RUNTIME_DIR="$ROOT_DIR/.runtime/mlx"
VENV_DIR="$RUNTIME_DIR/venv"
HF_HOME_DIR="$RUNTIME_DIR/hf"
MODEL_ID='mlx-community/Qwen3-1.7B-4bit'
MODEL_CACHE_DIR="$HF_HOME_DIR/hub/models--mlx-community--Qwen3-1.7B-4bit"
MLX_LM_VERSION='0.31.3'

if [[ ! -x "$VENV_DIR/bin/mlx_lm.server" || ! -d "$MODEL_CACHE_DIR" ]]; then
  printf '%s\n' 'Local AI setup is incomplete. Run npm run setup:local-ai first.' >&2
  exit 69
fi

INSTALLED_VERSION=$("$VENV_DIR/bin/python" - <<'PY'
import importlib.metadata
print(importlib.metadata.version('mlx-lm'))
PY
)
if [[ "$INSTALLED_VERSION" != "$MLX_LM_VERSION" ]]; then
  printf '%s\n' 'Pinned mlx-lm runtime is missing. Run npm run setup:local-ai first.' >&2
  exit 70
fi

exec env HF_HOME="$HF_HOME_DIR" HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 "$VENV_DIR/bin/mlx_lm.server" --model "$MODEL_ID" --host 127.0.0.1 --port 8092
