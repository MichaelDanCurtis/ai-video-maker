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

# Optional base / fast image bundles from catalog
download_hf_optional "dhairyashil/FLUX.1-dev-mflux-8bit" "${WEIGHTS}/flux-dev-q8"
download_hf_optional "filipstrand/Z-Image-Turbo-mflux-4bit" "${WEIGHTS}/z-image-turbo-q4"
download_hf_optional "filipstrand/Z-Image-Turbo-mflux-4bit" "${WEIGHTS}/z-image-turbo-q8"

download_lora() {
  local repo="$1"
  local file="$2"
  local dest="$3"
  echo "==> LoRA ${repo} (${file})"
  "${HF_CLI}" download "${repo}" \
    --include "${file}" \
    --local-dir "${dest}" || true
}

# Curated catalog LoRAs (see backend/mlx_models/image_catalog.json)
download_lora "Heartsync/Flux-NSFW-uncensored" "lora.safetensors" "${WEIGHTS}/loras/flux-nsfw-heartsync"
download_lora "smith297/nsfw_flux_lora_v1" "nsfw_flux_lora_v1.safetensors" "${WEIGHTS}/loras/flux-nsfw-smith297"
download_lora "Muapi/focus-on-sexual-innuendo-nsfw-lora-redcraft-il-pony-flux.1" \
  "focus-on-sexual-innuendo-nsfw-lora-redcraft-il-pony-flux.1.safetensors" \
  "${WEIGHTS}/loras/flux-nsfw-muapi-innuendo"
download_lora "davidjaymes/depr_flux-lora-fast-training_miasweet-v1_nsfw" \
  "flux-lora-fast-training_miasweet-v1_nsfw.safetensors" \
  "${WEIGHTS}/loras/flux-nsfw-miasweet"
download_lora "PetruZetta/enh_nsfw_flux_lora_v2" "lora.safetensors" "${WEIGHTS}/loras/flux-nsfw-petruzetta"
download_lora "kittysec/nsfw_flux_lora" "nsfw_flux_lora_v1.safetensors" "${WEIGHTS}/loras/flux-nsfw-kittysec"
download_lora "voxvici/flux-lora-nsfw" "Flux_Improved_Female_Nudity_v2.safetensors" "${WEIGHTS}/loras/flux-nsfw-voxvici"
download_lora "nadam54321/nsfw-flux-lora" "ben.safetensors" "${WEIGHTS}/loras/flux-nsfw-nadam"
download_lora "renderartist/Technically-Color-Z-Image-Turbo" \
  "Technically_Color_Z_Image_Turbo_v1_renderartist_2000.safetensors" \
  "${WEIGHTS}/loras/z-image-technically-color"

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

Image catalog:              15 curated models in backend/mlx_models/image_catalog.json
Image (default NSFW):       ${WEIGHTS}/flux-dev-q4 + ${WEIGHTS}/loras/flux-nsfw-heartsync
Image (all NSFW LoRAs):     ${WEIGHTS}/loras/flux-nsfw-*
Image (Krea aesthetic):     ${WEIGHTS}/flux-krea-uncensored-q4
Image (fast):               ${WEIGHTS}/flux-schnell-q4, z-image-turbo-*
Video (quick):              ${WEIGHTS}/ltx2-distilled
Video (Wan I2V MLX):        ${WEIGHTS}/wan22_i2v_mlx
Video (Wan T2V MLX):        ${WEIGHTS}/wan22_t2v_mlx
Lightning LoRA:             ${WEIGHTS}/lightning_lora

Default image model: flux-dev-nsfw-lora
Default video model: wan22-i2v-lightning (or ltx2-distilled if Wan not ready)
EOF

if [[ $WAN_OK -eq 0 ]]; then
  echo ""
  echo "Tip: re-run without SKIP_WAN to fetch Wan 2.2, or use model ltx2-distilled in the UI."
fi