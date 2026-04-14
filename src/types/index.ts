// ─── VESPERA — Type Definitions ───────────────────────────────────────────────

/**
 * Global hand-tracking lifecycle state.
 * Used to coordinate UI states (intro → loading → ready / error).
 */
export interface HandTrackingState {
  videoReady: boolean;
  modelsReady: boolean;
  errorMsg: string | null;
}

/**
 * Bounding box for the detected hand region in normalised [0, 1] coordinates.
 * Tuple order: [xMin, yMin, xMax, yMax]
 */
export type BoxCoords = [
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number,
];

/**
 * A single MediaPipe hand landmark point in normalised 3-D space.
 * x, y ∈ [0, 1] (image fraction); z is relative depth (negative = toward camera).
 */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * All data for one detected hand in a single frame.
 */
export interface HandData {
  /** 21 landmarks as returned by MediaPipe HandLandmarker */
  landmarks: LandmarkPoint[];
  /** Which physical hand was detected */
  handedness: 'Left' | 'Right';
}
