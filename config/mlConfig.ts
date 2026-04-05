/**
 * config/mlConfig.ts
 */
const LOCAL_IP  = "192.168.214.74";
const LOCAL_URL = `http://${LOCAL_IP}:8000`;
const RENDER_URL = "https://your-app-name.onrender.com"; // ← replace after deploying

export const ML_API_BASE_URL: string = __DEV__ ? LOCAL_URL : RENDER_URL;

export const ML_REQUEST_TIMEOUT_MS  = 35_000;
export const ML_HEALTH_TIMEOUT_MS   = 5_000;
export const ML_LOW_CONFIDENCE_THRESHOLD = 55;
export const CLOUDINARY_UPLOAD_ENABLED   = true;