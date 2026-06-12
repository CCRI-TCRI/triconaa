"use client"

// Client-side facial recognition helpers (powered by @vladmandic/face-api).
// Models are loaded from a CDN at runtime so no large weights are bundled.

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"

// Two faces are considered the same person when the Euclidean distance
// between their 128-d descriptors is below this threshold.
export const FACE_MATCH_THRESHOLD = 0.5

let modelsPromise: Promise<void> | null = null

export async function loadFaceModels(): Promise<void> {
  if (modelsPromise) return modelsPromise
  modelsPromise = (async () => {
    const faceapi = await import("@vladmandic/face-api")
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
  })()
  return modelsPromise
}

// Detect a single face and return its 128-d descriptor (or null if none found).
export async function getFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  const faceapi = await import("@vladmandic/face-api")
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return detection?.descriptor ?? null
}

export function euclideanDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function encodeDescriptor(descriptor: Float32Array): string {
  return JSON.stringify(Array.from(descriptor))
}

export function decodeDescriptor(encoded: string | null | undefined): number[] | null {
  if (!encoded) return null
  try {
    const arr = JSON.parse(encoded)
    return Array.isArray(arr) && arr.length === 128 ? arr : null
  } catch {
    return null
  }
}

export interface FaceProfile {
  id: string
  descriptor: number[]
}

// Find the closest enrolled face within the threshold.
export function findBestMatch(
  descriptor: Float32Array,
  profiles: FaceProfile[],
): { id: string; distance: number } | null {
  let best: { id: string; distance: number } | null = null
  for (const p of profiles) {
    const distance = euclideanDistance(descriptor, p.descriptor)
    if (!best || distance < best.distance) best = { id: p.id, distance }
  }
  if (best && best.distance <= FACE_MATCH_THRESHOLD) return best
  return null
}
