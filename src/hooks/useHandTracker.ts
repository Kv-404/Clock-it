import { useRef, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandData, BoxCoords } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** MediaPipe landmark index for the middle-finger MCP joint */
const MCP_INDEX = 9;

/** Euclidean distance threshold (normalised) that triggers a pinch */
const PINCH_THRESHOLD = 0.05;

/** How long (ms) to suppress repeated pinch triggers */
const PINCH_COOLDOWN_MS = 1200;

/** Total number of shader effects (effectIndex cycles 0 → N_EFFECTS-1) */
const N_EFFECTS = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseHandTrackerArgs {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  boxRef: React.MutableRefObject<BoxCoords>;
  handsRef: React.MutableRefObject<HandData[]>;
  pinchCooldownRef: React.MutableRefObject<boolean>;
  setVideoReady: (v: boolean) => void;
  setModelsReady: (v: boolean) => void;
  setErrorMsg: (msg: string) => void;
  setEffectIndex: React.Dispatch<React.SetStateAction<number>>;
}

interface UseHandTrackerReturn {
  /** Call once after the intro screen completes to load MediaPipe and start the webcam. */
  initTracker: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 2-D Euclidean distance between two normalised landmark coords. */
function dist2D(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHandTracker({
  videoRef,
  boxRef,
  handsRef,
  pinchCooldownRef,
  setVideoReady,
  setModelsReady,
  setErrorMsg,
  setEffectIndex,
}: UseHandTrackerArgs): UseHandTrackerReturn {
  /** Stores the RAF id so we can cancel on cleanup. */
  const animFrameRef   = useRef<number>(0);
  /** Counts every RAF tick — used for even-frame detection skip. */
  const frameCountRef  = useRef<number>(0);
  /** Holds the last valid MediaPipe result so overlay stays smooth on skipped frames. */
  const lastResultsRef = useRef<HandData[]>([]);

  const initTracker = useCallback(async (): Promise<void> => {
    try {
      // ── 1. Load MediaPipe WASM + model ──────────────────────────────────
      console.log('[VESPERA] Starting MediaPipe init...');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      console.log('[VESPERA] FilesetResolver done, creating HandLandmarker...');

      let landmarker: HandLandmarker;
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          numHands: 2,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('[VESPERA] GPU delegate failed, falling back to CPU:', gpuError);
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU'
          },
          numHands: 2,
          runningMode: 'VIDEO',
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      console.log('[VESPERA] HandLandmarker ready:', !!landmarker);
      setModelsReady(true);

      // ── 2. Open webcam stream ────────────────────────────────────────────
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        });
      } catch (camErr) {
        const isPermissionDenied =
          camErr instanceof DOMException && camErr.name === 'NotAllowedError';

        throw new Error(
          isPermissionDenied
            ? 'Camera permission denied. Please allow camera access and reload.'
            : `Camera error: ${camErr instanceof Error ? camErr.message : String(camErr)}`,
        );
      }

      const video = videoRef.current;
      if (!video) throw new Error('Video element not mounted.');

      video.srcObject = stream;

      // Wait for enough data to be available
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) { resolve(); return; }
        video.addEventListener('canplay', () => resolve(), { once: true });
      });

      try { await video.play(); } catch (_) {}

      // Confirm video is actually producing frames
      await new Promise<void>((resolve) => {
        const check = () => {
          if (video.videoWidth > 0) { resolve(); return; }
          requestAnimationFrame(check);
        };
        check();
      });

      setVideoReady(true);

      // ── 3. Animation loop ────────────────────────────────────────────────
      const detect = (): void => {
        console.log('[VESPERA] loop tick, readyState:', videoRef.current?.readyState);
        frameCountRef.current++;

        // Guard: video must have at least one decoded frame
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        // Frame-skip: run MediaPipe every other frame to halve CPU pressure.
        // The overlay canvas still draws at full frame-rate using lastResultsRef.
        if (frameCountRef.current % 2 === 0) {
          const result = landmarker.detectForVideo(video, performance.now());

          // ── 3a. Parse hands ──────────────────────────────────────────────
          const hands: HandData[] = result.landmarks.map((lmGroup, i) => ({
            landmarks:  lmGroup.map(({ x, y, z }) => ({ x, y, z })),
            handedness: (result.handedness[i]?.[0]?.categoryName ?? 'Left') as 'Left' | 'Right',
          }));
          lastResultsRef.current = hands;

          // ── 3b. Gesture detection (Pinch) ──────────────────────────────
          let isPinched = false;
          for (const hand of hands) {
            if (hand.landmarks.length > 8) {
              const isPinch = dist2D(
                hand.landmarks[4].x, hand.landmarks[4].y,
                hand.landmarks[8].x, hand.landmarks[8].y
              ) < PINCH_THRESHOLD;
              if (isPinch) {
                isPinched = true;
                break;
              }
            }
          }

          if (isPinched) {
            boxRef.current = [0, 0, 0, 0];
            if (!pinchCooldownRef.current) {
              setEffectIndex((prev) => (prev + 1) % N_EFFECTS);
              pinchCooldownRef.current = true;
              setTimeout(() => { pinchCooldownRef.current = false; }, PINCH_COOLDOWN_MS);
            }
          } else {
            // ── 3c. Bounding-box computation ──────────────────────────────
            if (hands.length === 2) {
              const lm0 = hands[0].landmarks[MCP_INDEX];
              const lm1 = hands[1].landmarks[MCP_INDEX];

              // Fix inverted axes: WebGL Y is inverted vs HTML Canvas.
              // WebGL expects 0=bottom, 1=top. MediaPipe gives 0=top, 1=bottom.
              const x0 = lm0.x;
              const y0 = 1.0 - lm0.y;
              const x1 = lm1.x;
              const y1 = 1.0 - lm1.y;

              const distance = dist2D(x0, y0, x1, y1);

              const centerX   = (x0 + x1) / 2;
              const centerY   = (y0 + y1) / 2;
              const boxWidth  = distance * 1.3;
              const boxHeight = boxWidth  * 0.75;

              boxRef.current = [
                clamp01(centerX - boxWidth  / 2),
                clamp01(centerY - boxHeight / 2),
                clamp01(centerX + boxWidth  / 2),
                clamp01(centerY + boxHeight / 2),
              ];
            } else {
              boxRef.current = [0, 0, 0, 0];
            }
          }
        }

        // Always write latest known results so the overlay canvas stays smooth
        handsRef.current = lastResultsRef.current;

        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);

      // ── 4. Cleanup (returned as a side-effect via closure) ──────────────
      // The caller can hold a reference to cancel via the animFrameRef, but
      // we also expose an explicit cleanup via a returned function attached
      // to the video element's 'pause' / unmount path (see App.tsx useEffect).
      //
      // For component unmount, App.tsx should call the returned cleanup fn.
      // We stash it on the video element as a non-standard property so that
      // a simple useEffect cleanup in App can invoke it without extra state.
      (video as HTMLVideoElement & { __vesperaCleanup?: () => void }).__vesperaCleanup = () => {
        cancelAnimationFrame(animFrameRef.current);
        landmarker.close();
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };

    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error initialising VESPERA.';
      setErrorMsg(message);
    }
  }, [
    videoRef,
    boxRef,
    handsRef,
    pinchCooldownRef,
    setVideoReady,
    setModelsReady,
    setErrorMsg,
    setEffectIndex,
  ]);

  return { initTracker };
}
