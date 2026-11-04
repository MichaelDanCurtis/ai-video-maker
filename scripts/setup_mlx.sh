#!/usr/bin/env bash
# Bootstrap Python 3.12 venv with mflux + mlx-video for local Apple Silicon inference.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${ROOT}/backend/.venv-mlx"
PYTHON="${PYTHON:-$(command -v python3.12 || command -v python3.11 || command -v python3)}"

echo "==> AI Video Maker MLX setup"
echo "    Project: ${ROOT}"
echo "    Python:  ${PYTHON}"

if ! "${PYTHON}" -c 'import sys; assert sys.version_info >= (3, 11)' 2>/dev/null; then
  echo "ERROR: MLX requires Python 3.11+. Install with: brew install python@3.12"
  exit 1
fi

"${PYTHON}" -m venv "${VENV}"
# shellcheck disable=SC1091
source "${VENV}/bin/activate"

pip install --upgrade pip wheel

# Core API deps (lightweight — full backend venv may stay on 3.9)
pip install fastapi uvicorn pydantic pydantic-settings python-multipart httpx python-dotenv

# MLX inference stack
pip install mflux
pip install "git+https://github.com/Blaizzy/mlx-video.git"
pip install torch

# Optional: faster HF downloads
pip install hf_transfer || true

mkdir -p "${ROOT}/data/outputs" "${ROOT}/data/jobs" "${ROOT}/data/uploads"
mkdir -p "${ROOT}/backend/mlx_models/weights"

cat <<EOF

MLX venv ready at: ${VENV}

Add to your .env:
  MLX_PYTHON=${VENV}/bin/python
  INFERENCE_BACKEND=mlx
  MLX_ENABLED=true
  DEFAULT_IMAGE_MODEL=flux-dev-nsfw-lora
  DEFAULT_VIDEO_MODEL=wan22-i2v-lightning

Download model weights:
  ./scripts/download_models.sh

Start backend:
  cd backend && source .venv/bin/activate
  MLX_PYTHON=${VENV}/bin/python uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
EOF