#!/usr/bin/env bash
# Download HuggingFace weights for default uncensored image + Wan video models.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEIGHTS="${ROOT}/backend/mlx_models/weights"
VENV="${ROOT}/backend/.venv-mlx"

if [[ -f "${ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT}/.env" 2>/dev/null || true
fi

HF_HOME="${HF_HOME:-${HOME}/.cache/huggingface}"
export HF_HOME
mkdir -p "${WEIGHTS}" "${HF_HOME}"

PYTHON="${MLX_PYTHON:-}"
if [[ -z "${PYTHON}" && -x "${VENV}/bin/python" ]]; then
  PYTHON="${VENV}/bin/python"
fi
if [[ -z "${PYTHON}" ]]; then
  PYTHON="$(command -v python3.12 || command -v python3.11 || command -v python3)"
fi

echo "==> Downloading MLX model weights"
echo "    HF_HOME=${HF_HOME}"
echo "    WEIGHTS=${WEIGHTS}"
echo "    Python=${PYTHON}"

if ! command -v huggingface-cli >/dev/null 2>&1; then
  echo "Installing huggingface_hub CLI..."
  "${PYTHON}" -m pip install -q "huggingface_hub[cli]"
fi

# Uncensored Flux Dev Q4 — default image model (downloads on first mflux run too)
echo "==> Image: shauray/flux.1-dev-uncensored-q4"
huggingface-cli download shauray/flux.1-dev-uncensored-q4 --local-dir "${WEIGHTS}/flux-dev-uncensored-q4" || true

# Wan 2.2 I2V MLX weights
echo "==> Video I2V: prince-canuma/Wan2.2-I2V-A14B-MLX"
huggingface-cli download prince-canuma/Wan2.2-I2V-A14B-MLX --local-dir "${WEIGHTS}/wan22_i2v_mlx"

# Wan 2.2 T2V MLX weights (text-to-video pipeline)
echo "==> Video T2V: prince-canuma/Wan2.2-T2V-A14B-MLX"
huggingface-cli download prince-canuma/Wan2.2-T2V-A14B-MLX --local-dir "${WEIGHTS}/wan22_t2v_mlx"

# Lightning LoRA for 4-step generation (optional but recommended)
echo "==> Lightning LoRA: lightx2v/Wan2.2-Lightning"
huggingface-cli download lightx2v/Wan2.2-Lightning \
  --include "Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0/*" \
  --local-dir "${WEIGHTS}/lightning_lora" || true

cat <<EOF

Done. Model directories:
  ${WEIGHTS}/flux-dev-uncensored-q4
  ${WEIGHTS}/wan22_i2v_mlx
  ${WEIGHTS}/wan22_t2v_mlx
  ${WEIGHTS}/lightning_lora (optional)

Default uncensored image model: flux-dev-uncensored-q4
Default video model: wan22-i2v-lightning
EOF