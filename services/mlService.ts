/**
 * services/mlService.ts  v4
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes in v4:
 *   • prepareImageForML now sends EXACTLY 224×224 px to the server.
 *     The model was trained on 224×224 direct-resized images. Sending a larger
 *     image and letting the server resize is fine, but sending exactly 224×224
 *     removes one variable and guarantees the server does zero resizing.
 *   • Image is sent as JPEG quality 0.92 (high enough to avoid artefacts that
 *     confuse EfficientNet, lower than 1.0 to keep transfer fast).
 *   • breed_confidence added to PetMLFields + MLSuccessResponse.
 *   • computeTrustScore mirrors the server-side formula exactly.
 */

import * as ImageManipulator from "expo-image-manipulator";
import { ML_API_BASE_URL, ML_REQUEST_TIMEOUT_MS } from "@/config/mlConfig";

// ─── Server response types ─────────────────────────────────────────────────────

export type AnimalType = "cat" | "dog" | "bird" | "rabbit" | string;

export interface MLSuccessResponse {
  status:            "success";
  method:            string;
  animal:            AnimalType;
  confidence:        number;              // animal-type model confidence 0-100
  breed:             string;
  breed_confidence:  number | null;       // breed model confidence 0-100, null for bird/rabbit
  trust_score:       number;             // composite score 0-100, floor 85 for approved
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

// ─── UI-facing types ───────────────────────────────────────────────────────────

export interface MLScores {
  categoryConfidence: number;        // animal-type model
  breedConfidence:    number | null; // breed model, null for bird/rabbit/other
  authConfidence:     number;        // real-vs-AI model
  trustScore:         number;        // composite, always ≥ 85 for approved images
}

export interface PetMLFields {
  category:     string;   // "Dogs" | "Cats" | "Birds" | "Others"
  breed:        string;   // humanised breed name or "Unknown"
  authenticity: "real" | "ai" | null;
  imageUrl:     string | null;
  scores:       MLScores;
  raw:          MLSuccessResponse;
}

// ─── Trust score (mirrors server formula) ─────────────────────────────────────

export const TRUST_FLOOR = 85;

/**
 * Weighted composite: auth 40% + category 35% + breed 25%
 * (55/45 auth/category when breed is unavailable)
 * Floor-clamped: approved images always show ≥ 85%.
 */
export function computeTrustScore(
  categoryConf: number,
  authConf:     number,
  breedConf:    number | null,
): number {
  // Use the server-provided trust_score directly when available.
  // This function is a client-side mirror for cases where we compute locally.
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
      | "INVALID_IMAGE"
      | "UNKNOWN",
    public readonly confidence?: number,
  ) {
    super(message);
    this.name = "MLError";
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
    // Prefer the server-computed trust_score (it has all model internals)
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

// ─── fetch with timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url:      string,
  options:  RequestInit,
  ms:       number,
): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new MLError(
        `ML server did not respond within ${ms / 1000}s. ` +
        "The server may be starting up (Render free tier takes ~30 s cold-start). " +
        "Please try again.",
        "TIMEOUT",
      );
    }
    throw new MLError(
      "Cannot reach the ML server. Ensure your phone and laptop are on the " +
      "same WiFi and the IP in mlConfig.ts is correct.",
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
      return { ok: false, reason: "Models still loading on server — please wait 30 s and retry." };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? "Server unreachable" };
  }
}


export async function prepareImageForML(imageUri: string): Promise<{
  uri:  string;
  name: string;
  type: string;
}> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 224, height: 224 } }],  // direct stretch, no crop
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
  // 1. Quick health check
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

  // 4. POST
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

  // 5. Parse
  const raw: MLRawResponse = await res.json();

  if (raw.status === "rejected") {
    switch (raw.reason) {
      case "ai_generated":  throw new MLError(raw.message, "AI_GENERATED",  raw.confidence);
      case "invalid_image": throw new MLError(raw.message, "INVALID_IMAGE", 0);
      default:              throw new MLError(raw.message, "LOW_CONFIDENCE", raw.confidence);
    }
  }

  return buildPetMLFields(raw);
}