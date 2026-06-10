#!/usr/bin/env bash
# Download and prepare MLX model weights for local Apple Silicon inference.
#
# Image models: native mflux HuggingFace bundles (ready to use after download).
# Video (LTX-2): pre-converted prince-canuma weights (ready after download).
# Video (Wan 2.2): download Wan-AI PyTorch checkpoints, then convert to MLX.
#   Wan 14B is ~50GB+ download and conversion — set SKIP_WAN=1 to skip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEIGHTS="${ROOT}/backend/mlx_models/weights"
VENV="${ROOT}/backend/.venv-mlx"
SKIP_WAN="${SKIP_WAN:-0}"

if [[ -z "${MLX_PYTHON:-}" && -x "${VENV}/bin/python" ]]; then
  MLX_PYTHON="${VENV}/bin/python"
fi
PYTHON="${MLX_PYTHON:-python3}"

HF_HOME="${HF_HOME:-${HOME}/.cache/huggingface}"
export HF_HOME
mkdir -p "${WEIGHTS}" "${HF_HOME}"

HF_CLI="${VENV}/bin/hf"
if [[ ! -x "${HF_CLI}" ]]; then
  HF_CLI="$(command -v hf || true)"
fi
if [[ -z "${HF_CLI}" ]]; then
  echo "Installing huggingface_hub CLI (hf)..."
  "${PYTHON}" -m pip install -q "huggingface_hub[cli]"
  HF_CLI="${VENV}/bin/hf"
fi

echo "==> Downloading MLX model weights"
echo "    HF_HOME=${HF_HOME}"
echo "    WEIGHTS=${WEIGHTS}"
echo "    Python=${PYTHON}"

download_hf() {
  local repo="$1"
  local dest="$2"
  echo "==> ${repo}"
  "${HF_CLI}" download "${repo}" --local-dir "${dest}"
}

download_hf_optional() {
  local repo="$1"
  local dest="$2"
  if download_hf "${repo}" "${dest}"; then
    return 0
  fi
  echo "WARN: optional download failed: ${repo}"
  return 0
}

convert_wan_to_mlx() {
  local pytorch_dir="$1"
  local mlx_dir="$2"

  if [[ -f "${mlx_dir}/config.json" ]] && [[ -f "${mlx_dir}/t5_encoder.safetensors" ]]; then
    echo "    MLX weights already present: ${mlx_dir}"
    return 0
  fi

  echo "    Converting PyTorch -> MLX (4-bit quantized)..."
  "${PYTHON}" -m mlx_video.models.wan_2.convert \
    --checkpoint-dir "${pytorch_dir}" \
    --output-dir "${mlx_dir}" \
    --quantize --bits 4 --group-size 64
}

setup_wan_model() {
  local hf_repo="$1"
  local pytorch_name="$2"
  local mlx_name="$3"

  local pytorch_dir="${WEIGHTS}/${pytorch_name}"
  local mlx_dir="${WEIGHTS}/${mlx_name}"

  if [[ -f "${mlx_dir}/config.json" ]] && [[ -f "${mlx_dir}/t5_encoder.safetensors" ]]; then
    echo "==> Wan MLX ready: ${mlx_name}"
    return 0
  fi

  echo "==> Wan PyTorch download: ${hf_repo} (large — may take a while)"
  if ! download_hf "${hf_repo}" "${pytorch_dir}"; then
    echo "ERROR: failed to download ${hf_repo}"
    return 1
  fi

  convert_wan_to_mlx "${pytorch_dir}" "${mlx_dir}"
}

# --- Image models (mflux-native bundles) ---
download_hf_optional "filipstrand/FLUX.1-Krea-dev-mflux-4bit" "${WEIGHTS}/flux-krea-uncensored-q4"
download_hf_optional "dhairyashil/FLUX.1-schnell-mflux-4bit" "${WEIGHTS}/flux-schnell-q4"
download_hf_optional "dhairyashil/FLUX.1-dev-mflux-4bit" "${WEIGHTS}/flux-dev-q4"

# --- Quick video: LTX-2 distilled (pre-converted MLX on HuggingFace) ---
download_hf_optional "prince-canuma/LTX-2-distilled" "${WEIGHTS}/ltx2-distilled"

# --- Lightning LoRA for Wan 4-step generation ---
echo "==> lightx2v/Wan2.2-Lightning (optional)"
"${HF_CLI}" download lightx2v/Wan2.2-Lightning \
  --include "Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V2.0/*" \
  --local-dir "${WEIGHTS}/lightning_lora" || true

# --- Wan 2.2 (optional heavy download + conversion) ---
WAN_OK=1
if [[ "${SKIP_WAN}" == "1" ]]; then
  echo "==> Skipping Wan 2.2 (SKIP_WAN=1). Use LTX-2-distilled for video meanwhile."
  WAN_OK=0
else
  set +e
  setup_wan_model "Wan-AI/Wan2.2-I2V-A14B" "wan22_i2v_pytorch" "wan22_i2v_mlx"
  I2V_STATUS=$?
  setup_wan_model "Wan-AI/Wan2.2-T2V-A14B" "wan22_t2v_pytorch" "wan22_t2v_mlx"
  T2V_STATUS=$?
  set -e
  if [[ $I2V_STATUS -ne 0 || $T2V_STATUS -ne 0 ]]; then
    WAN_OK=0
    echo "WARN: Wan 2.2 setup incomplete. LTX-2-distilled is still available for video."
  fi
fi

cat <<EOF

Done.

Image (default uncensored): ${WEIGHTS}/flux-krea-uncensored-q4
Image (fast):               ${WEIGHTS}/flux-schnell-q4
Image (quality):            ${WEIGHTS}/flux-dev-q4
Video (quick):              ${WEIGHTS}/ltx2-distilled
Video (Wan I2V MLX):        ${WEIGHTS}/wan22_i2v_mlx
Video (Wan T2V MLX):        ${WEIGHTS}/wan22_t2v_mlx
Lightning LoRA:             ${WEIGHTS}/lightning_lora

Default image model: flux-krea-uncensored-q4
Default video model: wan22-i2v-lightning (or ltx2-distilled if Wan not ready)
EOF

if [[ $WAN_OK -eq 0 ]]; then
  echo ""
  echo "Tip: re-run without SKIP_WAN to fetch Wan 2.2, or use model ltx2-distilled in the UI."
fi