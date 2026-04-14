import { useRef, useEffect, useCallback } from 'react';
import type { HandData, LandmarkPoint } from '../types';

// ─── Hand landmark connection pairs (MediaPipe standard topology) ──────────────
const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [0, 17],
];

const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;

// ─── Style Configurations ─────────────────────────────────────────────────────

/** 
 * Platinum and Ivory silver-white tints to gently distinguish the hands 
 * without breaking the minimalist aesthetic.
 */
const HAND_COLORS: [string, string] = [
  '200, 200, 210',  // Hand 0: Platinum tint
  '210, 200, 200',  // Hand 1: Ivory tint
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Mirror X so overlay aligns with the "selfie" webcam orientation. */
function toScreen(
  lm: LandmarkPoint,
  w: number,
  h: number,
): { x: number; y: number } {
  return { x: (1 - lm.x) * w, y: lm.y * h };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OverlayCanvasProps {
  handsRef: React.MutableRefObject<HandData[]>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}

export default function OverlayCanvas({ handsRef }: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // ── Drawing pipeline (useCallback for stable identity in useEffect dep) ─────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w     = canvas.width;
    const h     = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const hands = handsRef.current;

    // ── A. Skeleton lines ──────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth   = 1.0;
    ctx.lineCap     = 'round';

    for (const hand of hands) {
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = toScreen(hand.landmarks[a], w, h);
        const pb = toScreen(hand.landmarks[b], w, h);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── B. Clean white tracking nodes ─────────────────────────────────────
    for (let hi = 0; hi < hands.length; hi++) {
      const colorBasis = HAND_COLORS[hi % 2];

      for (let i = 0; i < hands[hi].landmarks.length; i++) {
        const { x, y } = toScreen(hands[hi].landmarks[i], w, h);
        
        let r = 2.5; 
        let opacity = 0.35;

        // Wrist
        if (i === 0) {
          r = 4;
          opacity = 0.6;
        } 
        // Fingertips
        else if ((FINGERTIP_INDICES as ReadonlyArray<number>).includes(i)) {
          r = 5;
          opacity = 0.75;
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        // Use the subtly tinted silver-white bases instead of raw 255
        ctx.fillStyle = `rgba(${colorBasis}, ${opacity})`; 
        ctx.fill();
      }
    }

    // ── Two-hand-only effects ─────────────────────────────────────────────
    if (hands.length === 2) {
      const maxDist = w * 0.65;
      const now     = Date.now();

      for (let i = 0; i < FINGERTIP_INDICES.length; i++) {
        const tipIdx = FINGERTIP_INDICES[i];
        const p0     = toScreen(hands[0].landmarks[tipIdx], w, h);
        const p1     = toScreen(hands[1].landmarks[tipIdx], w, h);

        const dx   = p1.x - p0.x;
        const dy   = p1.y - p0.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) continue;

        const connectOpacity = (1 - dist / maxDist) * 0.4;
        const connectWidth   = (1 - dist / maxDist) * 1.2 + 0.3;

        // ── C. Subtle inter-hand constellation line ──────────────────────────
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${connectOpacity})`;
        ctx.lineWidth   = connectWidth;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.restore();

        // ── D. Midpoint pulse orb ──────────────────────────────────────────
        const midX        = (p0.x + p1.x) / 2;
        const midY        = (p0.y + p1.y) / 2;
        const pulseRadius = 1.8 + Math.sin(now * 0.004 + i * 1.2) * 0.8;

        ctx.beginPath();
        ctx.arc(midX, midY, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [handsRef]);

  // ── Mount: fit canvas, wire resize listener, start RAF loop ──────────────
  useEffect(() => {
    console.log('[VESPERA] OverlayCanvas mounted, canvasRef:', !!canvasRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize(); 

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        10,
      }}
      aria-hidden="true"
    />
  );
}
