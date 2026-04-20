import * as ImageManipulator from "expo-image-manipulator";

import {
  ML_API_BASE_URL,
  ML_REQUEST_TIMEOUT_MS,
  ML_HEALTH_TIMEOUT_MS,
  AI_GENERATED_REJECT_THRESHOLD,
  ANIMAL_CONFIDENCE_THRESHOLD,
  BREED_CONFIDENCE_THRESHOLD,
  TRUST_WEIGHTS,
  IMAGE_ML_SIZE_PX,
  IMAGE_ML_QUALITY,
} from "@/config/mlConfig";

export type MLErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "SERVER_UNAVAILABLE"
  | "AI_GENERATED"
  | "LOW_CONFIDENCE"
  | "UNSUPPORTED_BREED"
  | "INVALID_IMAGE"
  | "BELOW_THRESHOLD"
  | "UNKNOWN";

export type AnimalType = "cat" | "dog" | "bird" | "rabbit" | "hamster" | "iguana" | "goldfish" | (string & {});

export interface MLRawServerResponse {
  status: "success";
  animal: AnimalType;
  animal_confidence: number;
  animal_all_scores: Record<string, number>;
  auth_label: "real" | "ai" | null;
  auth_confidence: number | null;
  auth_raw_sigmoid: number | null;
  breed: string | null;
  breed_confidence: number | null;
  breed_all_scores: Record<string, number> | null;
}

export interface MLInvalidResponse {
  status: "rejected";
  reason: "invalid_image";
  message: string;
}

export type MLServerResponse = MLRawServerResponse | MLInvalidResponse;

export interface MLScores {
  categoryConfidence: number;
  breedConfidence: number | null;
  authConfidence: number;
  trustScore: number;
}

export type MLSource = "primary";

export interface PetMLFields {
  category: string;
  breed: string;
  authenticity: "real" | "ai" | null;
  scores: MLScores;
  source: MLSource;
  raw: MLRawServerResponse;
}

export class MLError extends Error {
  public readonly code: MLErrorCode;
  public readonly confidence: number | undefined;

  constructor(message: string, code: MLErrorCode, confidence?: number) {
    super(message);
    this.name = "MLError";
    this.code = code;
    this.confidence = confidence;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const OTHERS_ANIMALS = new Set(["rabbit", "hamster", "iguana", "goldfish"]);

export function computeTrustScore(
  animalConf: number,
  authConf: number,
  breedConf: number | null
): number {
  let raw: number;

  if (breedConf !== null) {
    const w = TRUST_WEIGHTS.withBreed;
    raw = authConf * w.auth + animalConf * w.category + breedConf * w.breed;
  } else {
    const w = TRUST_WEIGHTS.withoutBreed;
    raw = authConf * w.auth + animalConf * w.category;
  }

  return Math.min(100, Math.round(raw * 10) / 10);
}

function mapCategory(animal: string): string {
  switch (animal?.toLowerCase()) {
    case "dog":
      return "Dogs";
    case "cat":
      return "Cats";
    case "bird":
      return "Birds";
    case "rabbit":
    case "hamster":
    case "iguana":
    case "goldfish":
      return "Others";
    default:
      return "Others";
  }
}

function getOthersBreedName(animal: string): string {
  switch (animal?.toLowerCase()) {
    case "rabbit":
      return "Rabbit";
    case "hamster":
      return "Hamster";
    case "iguana":
      return "Iguana";
    case "goldfish":
      return "Goldfish";
    default:
      return "Unknown";
  }
}

function humaniseBreed(raw: string | null): string {
  if (!raw || raw === "Unknown") return "Unknown";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function computeAverageConfidence(
  animalConf: number,
  authConf: number,
  breedConf: number | null
): number {
  if (breedConf !== null) {
    return (animalConf + authConf + breedConf) / 3;
  }
  return (animalConf + authConf) / 2;
}

function applyRejectionGates(server: MLRawServerResponse): void {
  const animal = server.animal?.toLowerCase() ?? "";
  const animalConf = server.animal_confidence;
  const breedConf = server.breed_confidence;
  const rawSigmoid = server.auth_raw_sigmoid;

  const isOthersAnimal = OTHERS_ANIMALS.has(animal);
  const hasAuth = rawSigmoid !== null && !isOthersAnimal;
  const hasBreed = breedConf !== null && !isOthersAnimal;

  if (hasAuth) {
    const sigmoidRejectCutoff = 1 - AI_GENERATED_REJECT_THRESHOLD / 100;
    if (rawSigmoid! < sigmoidRejectCutoff) {
      const aiPct = Math.round((1 - rawSigmoid!) * 100 * 10) / 10;
      throw new MLError(
        `This image appears to be AI-generated (${aiPct}% confidence). Only real pet photos are accepted.`,
        "AI_GENERATED",
        aiPct
      );
    }
  }

  if (animalConf < ANIMAL_CONFIDENCE_THRESHOLD) {
    throw new MLError(
      `We couldn't confidently detect a pet in this photo (${animalConf.toFixed(1)}% confidence). Please upload a well-lit photo with your pet as the clear main subject.`,
      "LOW_CONFIDENCE",
      animalConf
    );
  }

  if (hasBreed && breedConf! < BREED_CONFIDENCE_THRESHOLD) {
    throw new MLError(
      "We couldn't identify this breed with enough confidence. Try uploading a clearer photo, or check back as we expand our breed library.",
      "UNSUPPORTED_BREED",
      breedConf!
    );
  }

  const authConfForAverage = isOthersAnimal ? 100 : (server.auth_confidence ?? 100);
  const breedConfForAverage = isOthersAnimal ? null : breedConf;
  const avgConfidence = computeAverageConfidence(animalConf, authConfForAverage, breedConfForAverage);

  if (avgConfidence < 85) {
    throw new MLError(
      `Photo verification score is too low (${avgConfidence.toFixed(1)}%). Please upload a clearer, well-lit photo of your pet.`,
      "BELOW_THRESHOLD",
      avgConfidence
    );
  }
}

function buildPetMLFields(server: MLRawServerResponse): PetMLFields {
  const animal = server.animal?.toLowerCase() ?? "";
  const animalConf = server.animal_confidence ?? 0;
  const isOthersAnimal = OTHERS_ANIMALS.has(animal);

  const authConf = isOthersAnimal ? 100 : (server.auth_confidence ?? 100);
  const breedConf = isOthersAnimal ? null : (server.breed_confidence ?? null);
  const trustScore = computeTrustScore(animalConf, authConf, breedConf);

  const scores: MLScores = {
    categoryConfidence: Math.round(animalConf * 10) / 10,
    breedConfidence: breedConf !== null ? Math.round(breedConf * 10) / 10 : null,
    authConfidence: Math.round(authConf * 10) / 10,
    trustScore,
  };

  const breedDisplay = isOthersAnimal
    ? getOthersBreedName(animal)
    : humaniseBreed(server.breed);

  return {
    category: mapCategory(animal),
    breed: breedDisplay,
    authenticity: server.auth_label ?? null,
    scores,
    source: "primary",
    raw: server,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);

  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new MLError(
        `ML server did not respond within ${(ms / 1000).toFixed(0)}s. Please try again.`,
        "TIMEOUT"
      );
    }
    throw new MLError(
      "Cannot reach the ML server. Check your internet connection.",
      "NETWORK"
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface MLHealthResult {
  ok: boolean;
  reason?: string;
}

export async function checkMLHealth(): Promise<MLHealthResult> {
  try {
    const res = await fetchWithTimeout(
      `${ML_API_BASE_URL}/health`,
      { method: "GET" },
      ML_HEALTH_TIMEOUT_MS
    );

    if (!res.ok) {
      return { ok: false, reason: `Server returned HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.ready === false) {
      return {
        ok: false,
        reason: "Models are still loading — please wait a moment and retry.",
      };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? "Server unreachable" };
  }
}

export interface PreparedImage {
  uri: string;
  name: string;
  type: "image/jpeg";
}

export async function prepareImageForML(imageUri: string): Promise<PreparedImage> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: IMAGE_ML_SIZE_PX, height: IMAGE_ML_SIZE_PX } }],
    { compress: IMAGE_ML_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: result.uri,
    name: `pet_${Date.now()}.jpg`,
    type: "image/jpeg",
  };
}

export async function classifyPetImage(imageUri: string): Promise<PetMLFields> {
  const health = await checkMLHealth();
  if (!health.ok) {
    throw new MLError(health.reason ?? "ML server unavailable", "SERVER_UNAVAILABLE");
  }

  const prepared = await prepareImageForML(imageUri);

  const form = new FormData();
  form.append("file", {
    uri: prepared.uri,
    name: prepared.name,
    type: prepared.type,
  } as any);

  const res = await fetchWithTimeout(
    `${ML_API_BASE_URL}/predict`,
    { method: "POST", body: form },
    ML_REQUEST_TIMEOUT_MS
  );

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.message ?? detail;
    } catch {}
    throw new MLError(detail, "SERVER_UNAVAILABLE");
  }

  const server: MLServerResponse = await res.json();

  if (server.status === "rejected") {
    throw new MLError(server.message, "INVALID_IMAGE", 0);
  }

  applyRejectionGates(server);

  return buildPetMLFields(server);
}
