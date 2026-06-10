#!/usr/bin/env bash
# Download HuggingFace weights for default uncensored image + Wan video models.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEIGHTS="${ROOT}/backend/mlx_models/weights"
VENV="${ROOT}/backend/.venv-mlx"

# Avoid sourcing .env — paths with spaces break unquoted shell assignment.
if [[ -z "${MLX_PYTHON:-}" && -x "${VENV}/bin/python" ]]; then
  MLX_PYTHON="${VENV}/bin/python"
fi

HF_HOME="${HF_HOME:-${HOME}/.cache/huggingface}"
export HF_HOME
mkdir -p "${WEIGHTS}" "${HF_HOME}"

PYTHON="${MLX_PYTHON:-}"
if [[ -z "${PYTHON}" ]]; then
  PYTHON="$(command -v python3.12 || command -v python3.11 || command -v python3)"
fi

HF_CLI="${VENV}/bin/huggingface-cli"
if [[ ! -x "${HF_CLI}" ]]; then
  HF_CLI="$(command -v huggingface-cli || true)"
fi
if [[ -z "${HF_CLI}" ]]; then
  echo "Installing huggingface_hub CLI..."
  "${PYTHON}" -m pip install -q "huggingface_hub[cli]"
  HF_CLI="${VENV}/bin/huggingface-cli"
fi

echo "==> Downloading MLX model weights"
echo "    HF_HOME=${HF_HOME}"
echo "    WEIGHTS=${WEIGHTS}"
echo "    Python=${PYTHON}"

# Uncensored Flux Dev Q4 — default image model (downloads on first mflux run too)
echo "==> Image: shauray/flux.1-dev-uncensored-q4"
"${HF_CLI}" download shauray/flux.1-dev-uncensored-q4 --local-dir "${WEIGHTS}/flux-dev-uncensored-q4" || true

# Wan 2.2 I2V MLX weights
echo "==> Video I2V: prince-canuma/Wan2.2-I2V-A14B-MLX"
"${HF_CLI}" download prince-canuma/Wan2.2-I2V-A14B-MLX --local-dir "${WEIGHTS}/wan22_i2v_mlx"

# Wan 2.2 T2V MLX weights (text-to-video pipeline)
echo "==> Video T2V: prince-canuma/Wan2.2-T2V-A14B-MLX"
"${HF_CLI}" download prince-canuma/Wan2.2-T2V-A14B-MLX --local-dir "${WEIGHTS}/wan22_t2v_mlx"

# Lightning LoRA for 4-step generation (optional but recommended)
echo "==> Lightning LoRA: lightx2v/Wan2.2-Lightning"
"${HF_CLI}" download lightx2v/Wan2.2-Lightning \
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