/**
 * services/mlService.ts  v5
 */

import * as ImageManipulator from "expo-image-manipulator";
import { ML_API_BASE_URL, ML_REQUEST_TIMEOUT_MS } from "@/config/mlConfig";

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_REJECT_THRESHOLD    = 85;  // reject if AI confidence ≥ 85%
const BREED_REJECT_THRESHOLD = 85;  // reject if breed confidence < 85%

// ─── Server response types ────────────────────────────────────────────────────

export type AnimalType = "cat" | "dog" | "bird" | "rabbit" | string;

export interface MLSuccessResponse {
  status:            "success";
  method:            string;
  animal:            AnimalType;
  confidence:        number;
  breed:             string;
  breed_confidence:  number | null;
  trust_score:       number;
  authenticity:      { label: "real" | "ai"; confidence: number } | null;
  image_url:         string | null;
  summary:           string;
}

export interface MLRejectedResponse {
  status:     "rejected";
  reason:     "ai_generated" | "low_confidence" | "invalid_image";
  confidence: number;
  message:    string;
}

export type MLRawResponse = MLSuccessResponse | MLRejectedResponse;

// ─── UI-facing types ──────────────────────────────────────────────────────────

export interface MLScores {
  categoryConfidence: number;
  breedConfidence:    number | null;
  authConfidence:     number;
  trustScore:         number;
}

export interface PetMLFields {
  category:     string;
  breed:        string;
  authenticity: "real" | "ai" | null;
  imageUrl:     string | null;
  scores:       MLScores;
  raw:          MLSuccessResponse;
}

// ─── Trust score ──────────────────────────────────────────────────────────────

export const TRUST_FLOOR = 85;

export function computeTrustScore(
  categoryConf: number,
  authConf:     number,
  breedConf:    number | null,
): number {
  let raw: number;
  if (breedConf !== null) {
    raw = authConf * 0.40 + categoryConf * 0.35 + breedConf * 0.25;
  } else {
    raw = authConf * 0.55 + categoryConf * 0.45;
  }
  if (raw < TRUST_FLOOR) {
    raw = TRUST_FLOOR + (raw / TRUST_FLOOR) * (100 - TRUST_FLOOR) * 0.35;
  }
  return Math.min(100, Math.round(raw * 10) / 10);
}

// ─── MLError ──────────────────────────────────────────────────────────────────

export class MLError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NETWORK"
      | "TIMEOUT"
      | "SERVER_UNAVAILABLE"
      | "AI_GENERATED"
      | "LOW_CONFIDENCE"
      | "LOW_BREED_CONFIDENCE"
      | "INVALID_IMAGE"
      | "UNKNOWN",
    public readonly confidence?: number,
  ) {
    super(message);
    this.name = "MLError";
  }
}

// ─── Client-side rejection logic ──────────────────────────────────────────────

/**
 * Two-stage rejection:
 *  1. If AI confidence ≥ 85% → reject as AI generated
 *  2. If breed confidence < 85% (for dogs/cats) → reject as low breed confidence
 */
function applyClientRejectionRules(raw: MLSuccessResponse): void {
  const authConf  = raw.authenticity?.confidence ?? 0;
  const authLabel = raw.authenticity?.label ?? "real";
  const breedConf = raw.breed_confidence;
  const animal    = raw.animal?.toLowerCase();

  // Rule 1: AI generated check
  if (authLabel === "ai" && authConf >= AI_REJECT_THRESHOLD) {
    throw new MLError(
      `This image appears to be AI-generated (${authConf.toFixed(1)}% confidence). ` +
      "Only real pet photos are accepted.",
      "AI_GENERATED",
      authConf,
    );
  }

  // Rule 2: Breed confidence check (only for dogs and cats)
  if (animal === "dog" || animal === "cat") {
    if (breedConf === null || breedConf < BREED_REJECT_THRESHOLD) {
      const confStr = breedConf !== null ? `${breedConf.toFixed(1)}%` : "unavailable";
      throw new MLError(
        `Breed could not be identified with enough confidence (${confStr}). ` +
        "Please upload a clearer photo where the pet is the main subject.",
        "LOW_BREED_CONFIDENCE",
        breedConf ?? 0,
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCategory(animal: string): string {
  switch (animal?.toLowerCase()) {
    case "dog":    return "Dogs";
    case "cat":    return "Cats";
    case "bird":   return "Birds";
    case "rabbit": return "Others";
    default:       return "Others";
  }
}

function humaniseBreed(s: string): string {
  if (!s || s === "Unknown") return "Unknown";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPetMLFields(raw: MLSuccessResponse): PetMLFields {
  const categoryConf = raw.confidence ?? 0;
  const authConf     = raw.authenticity?.confidence ?? 100;
  const breedConf    = raw.breed_confidence ?? null;

  const scores: MLScores = {
    categoryConfidence: Math.round(categoryConf * 10) / 10,
    breedConfidence:    breedConf !== null ? Math.round(breedConf * 10) / 10 : null,
    authConfidence:     Math.round(authConf * 10) / 10,
    trustScore: raw.trust_score ?? computeTrustScore(categoryConf, authConf, breedConf),
  };

  return {
    category:     mapCategory(raw.animal),
    breed:        humaniseBreed(raw.breed),
    authenticity: raw.authenticity?.label ?? "real",
    imageUrl:     raw.image_url ?? null,
    scores,
    raw,
  };
}

// ─── Fetch with timeout ───────────────────────────────────────────────────────

async function fetchWithTimeout(
  url:     string,
  options: RequestInit,
  ms:      number,
): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new MLError(
        `ML server did not respond within ${ms / 1000}s. Please try again.`,
        "TIMEOUT",
      );
    }
    throw new MLError(
      "Cannot reach the ML server. Check your internet connection.",
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkMLHealth(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetchWithTimeout(`${ML_API_BASE_URL}/health`, { method: "GET" }, 5_000);
    if (!res.ok) return { ok: false, reason: `Server HTTP ${res.status}` };
    const data = await res.json();
    if (data.ready === false) {
      return { ok: false, reason: "Models still loading — please wait and retry." };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? "Server unreachable" };
  }
}

// ─── Image preparation ────────────────────────────────────────────────────────

export async function prepareImageForML(imageUri: string): Promise<{
  uri:  string;
  name: string;
  type: string;
}> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 224, height: 224 } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
  );
  return {
    uri:  result.uri,
    name: `pet_${Date.now()}.jpg`,
    type: "image/jpeg",
  };
}

// ─── Classify ─────────────────────────────────────────────────────────────────

export async function classifyPetImage(imageUri: string): Promise<PetMLFields> {
  // 1. Health check
  const health = await checkMLHealth();
  if (!health.ok) {
    throw new MLError(health.reason ?? "ML server unavailable", "SERVER_UNAVAILABLE");
  }

  // 2. Prepare 224×224 JPEG
  const prepared = await prepareImageForML(imageUri);

  // 3. Build form data
  const form = new FormData();
  form.append("file", {
    uri:  prepared.uri,
    name: prepared.name,
    type: prepared.type,
  } as any);

  // 4. POST to server
  const res = await fetchWithTimeout(
    `${ML_API_BASE_URL}/predict`,
    { method: "POST", body: form },
    ML_REQUEST_TIMEOUT_MS,
  );

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new MLError(detail, "SERVER_UNAVAILABLE");
  }

  // 5. Parse server response
  const raw: MLRawResponse = await res.json();

  // 6. Handle server-side rejections
  if (raw.status === "rejected") {
    switch (raw.reason) {
      case "ai_generated":  throw new MLError(raw.message, "AI_GENERATED",  raw.confidence);
      case "invalid_image": throw new MLError(raw.message, "INVALID_IMAGE", 0);
      default:              throw new MLError(raw.message, "LOW_CONFIDENCE", raw.confidence);
    }
  }

  // 7. Apply client-side rejection rules (AI ≥ 85% or breed < 85%)
  applyClientRejectionRules(raw);

  // 8. Build and return
  return buildPetMLFields(raw);
}