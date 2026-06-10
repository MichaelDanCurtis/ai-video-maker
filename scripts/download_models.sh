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

HF_CLI="${VENV}/bin/hf"
if [[ ! -x "${HF_CLI}" ]]; then
  HF_CLI="$(command -v hf || true)"
fi
if [[ -z "${HF_CLI}" ]]; then
  echo "Installing huggingface_hub CLI (hf)..."
  "${MLX_PYTHON:-python3}" -m pip install -q "huggingface_hub[cli]"
  HF_CLI="${VENV}/bin/hf"
fi

echo "==> Downloading MLX model weights"
echo "    HF_HOME=${HF_HOME}"
echo "    WEIGHTS=${WEIGHTS}"

# Default uncensored image: Krea Dev mflux 4-bit (native mflux bundle)
echo "==> Image (uncensored default): filipstrand/FLUX.1-Krea-dev-mflux-4bit"
"${HF_CLI}" download filipstrand/FLUX.1-Krea-dev-mflux-4bit \
  --local-dir "${WEIGHTS}/flux-krea-uncensored-q4" || true

# Fast Flux Schnell
echo "==> Image (fast): dhairyashil/FLUX.1-schnell-mflux-4bit"
"${HF_CLI}" download dhairyashil/FLUX.1-schnell-mflux-4bit \
  --local-dir "${WEIGHTS}/flux-schnell-q4" || true

# Full Flux Dev
echo "==> Image (quality): dhairyashil/FLUX.1-dev-mflux-4bit"
"${HF_CLI}" download dhairyashil/FLUX.1-dev-mflux-4bit \
  --local-dir "${WEIGHTS}/flux-dev-q4" || true

# Wan 2.2 I2V MLX weights
echo "==> Video I2V: prince-canuma/Wan2.2-I2V-A14B-MLX"
"${HF_CLI}" download prince-canuma/Wan2.2-I2V-A14B-MLX \
  --local-dir "${WEIGHTS}/wan22_i2v_mlx"

# Wan 2.2 T2V MLX weights (text-to-video pipeline)
echo "==> Video T2V: prince-canuma/Wan2.2-T2V-A14B-MLX"
"${HF_CLI}" download prince-canuma/Wan2.2-T2V-A14B-MLX \
  --local-dir "${WEIGHTS}/wan22_t2v_mlx"

# Lightning LoRA for 4-step video generation (optional but recommended)
echo "==> Lightning LoRA: lightx2v/Wan2.2-Lightning"
"${HF_CLI}" download lightx2v/Wan2.2-Lightning \
  --include "Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0/*" \
  --local-dir "${WEIGHTS}/lightning_lora" || true

cat <<EOF

Done. Model directories:
  ${WEIGHTS}/flux-krea-uncensored-q4   (default uncensored image)
  ${WEIGHTS}/flux-schnell-q4
  ${WEIGHTS}/flux-dev-q4
  ${WEIGHTS}/wan22_i2v_mlx
  ${WEIGHTS}/wan22_t2v_mlx
  ${WEIGHTS}/lightning_lora (optional)

Default uncensored image model: flux-krea-uncensored-q4
Default video model: wan22-i2v-lightning
EOF