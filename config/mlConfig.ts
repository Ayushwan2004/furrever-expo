const HF_SPACE_HOST = "ayushw09-furrever-vision-api.hf.space";
export const ML_API_BASE_URL = `https://${HF_SPACE_HOST}`;

export const ML_REQUEST_TIMEOUT_MS = 35_000;
export const ML_HEALTH_TIMEOUT_MS = 5_000;

export const IMAGE_ML_SIZE_PX = 224;
export const IMAGE_ML_QUALITY = 0.92;
export const IMAGE_DISPLAY_MAX_PX = 1200;
export const IMAGE_DISPLAY_QUALITY = 0.92;

export const ML_LOW_CONFIDENCE_THRESHOLD = 55;
export const TRUST_SCORE_MIN = ML_LOW_CONFIDENCE_THRESHOLD;
export const BREED_EXCELLENT = 78;

export const AI_GENERATED_REJECT_THRESHOLD = 85;
export const ANIMAL_CONFIDENCE_THRESHOLD = 85;
export const BREED_CONFIDENCE_THRESHOLD = 85;

export const TRUST_WEIGHTS = {
  withBreed: {
    auth: 0.40,
    category: 0.35,
    breed: 0.25,
  },
  withoutBreed: {
    auth: 0.55,
    category: 0.45,
  },
} as const;
