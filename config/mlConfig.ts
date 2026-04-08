/**
 * config/mlConfig.ts
 */
const LOCAL_IP  = "192.168.214.74";
const LOCAL_URL = `http://${LOCAL_IP}:8000`;
const HF_URL    = "https://ayushw09-furrever-vision-api.hf.space";

export const ML_API_BASE_URL: string = HF_URL; // force HF for now

export const ML_REQUEST_TIMEOUT_MS       = 35_000;
export const ML_HEALTH_TIMEOUT_MS        = 5_000;
export const ML_LOW_CONFIDENCE_THRESHOLD = 55;
export const CLOUDINARY_UPLOAD_ENABLED   = true;