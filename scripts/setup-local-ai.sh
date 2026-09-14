#!/usr/bin/env bash
set -euo pipefail

if (($# != 0)); then
  printf '%s\n' 'This setup pins one local model and accepts no arguments.' >&2
  exit 64
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
RUNTIME_DIR="$ROOT_DIR/.runtime/mlx"
VENV_DIR="$RUNTIME_DIR/venv"
HF_HOME_DIR="$RUNTIME_DIR/hf"
MODEL_ID='mlx-community/Qwen3-1.7B-4bit'
MLX_LM_VERSION='0.31.3'

if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'python3 is required to create the local AI runtime.' >&2
  exit 69
fi

mkdir -p "$HF_HOME_DIR"
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m pip install --upgrade "mlx-lm==$MLX_LM_VERSION"
INSTALLED_VERSION=$("$VENV_DIR/bin/python" - <<'PY'
import importlib.metadata
print(importlib.metadata.version('mlx-lm'))
PY
)
if [[ "$INSTALLED_VERSION" != "$MLX_LM_VERSION" ]]; then
  printf '%s\n' 'mlx-lm version verification failed.' >&2
  exit 70
fi

HF_HOME="$HF_HOME_DIR" HF_HUB_DISABLE_TELEMETRY=1 "$VENV_DIR/bin/python" - "$MODEL_ID" <<'PY'
from pathlib import Path
import sys
from huggingface_hub import snapshot_download
from huggingface_hub.errors import LocalEntryNotFoundError

model_id = sys.argv[1]
try:
    snapshot_download(repo_id=model_id, local_files_only=True)
except LocalEntryNotFoundError:
    snapshot_download(repo_id=model_id)
PY

printf '%s\n' 'Local AI runtime is ready for the pinned MLX model.'
