import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import vertexShader   from '../shaders/vertex.glsl?raw';
import fragmentShader from '../shaders/fragment.glsl?raw';
import type { BoxCoords } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const EFFECT_NAMES = [
  'Burning Inferno',
  'Neon Silhouette',
  'Thermal Vision',
  'Matrix Dots',
  'Glitch Signal',
  'Neon Edges',
  'Constellation',
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface EffectsCanvasProps {
  videoRef:    React.MutableRefObject<HTMLVideoElement | null>;
  boxRef:      React.MutableRefObject<BoxCoords>;
  effectIndex: number;
}

interface ShaderPlaneProps {
  videoRef:    React.MutableRefObject<HTMLVideoElement | null>;
  boxRef:      React.MutableRefObject<BoxCoords>;
  effectIndex: number;
}

// ─── ShaderPlane — lives inside <Canvas> ─────────────────────────────────────

function ShaderPlane({ videoRef, boxRef, effectIndex }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create texture imperatively, update every frame
  const textureRef = useRef<THREE.VideoTexture | null>(null);

  useFrame(({ gl }) => {
    const video = videoRef.current;
    const mesh = meshRef.current;
    if (!video || !mesh) return;

    // Create texture on first frame that has data
    if (!textureRef.current && video.readyState >= 2 && video.videoWidth > 0) {
      const tex = new THREE.VideoTexture(video);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.format = THREE.RGBAFormat;
      tex.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = tex;
      
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uTexture.value = tex;
      mat.needsUpdate = true;
      console.log('[VESPERA] Texture assigned in useFrame, videoWidth:', video.videoWidth);
    }

    // Force update every frame
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }

    // Update other uniforms
    const mat = mesh.material as THREE.ShaderMaterial;
    if (mat.uniforms) {
      mat.uniforms.uTime.value += gl.info.render.frame ? 0.016 : 0.016;
      mat.uniforms.uBox.value.set(...boxRef.current);
      mat.uniforms.uEffect.value = THREE.MathUtils.lerp(
        mat.uniforms.uEffect.value, effectIndex, 0.06
      );
      mat.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }
  });

  const uniforms = useMemo(() => ({
    uTexture: { value: null },
    uTime: { value: 0 },
    uBox: { value: new THREE.Vector4(0, 0, 0, 0) },
    uEffect: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  }), []);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Effect name HUD (outside R3F tree) ──────────────────────────────────────

function EffectHUD({ effectIndex }: { effectIndex: number }) {
  const [color, setColor] = useState('rgba(255,255,255,0.30)');

  useEffect(() => {
    setColor('rgba(255,255,255,0.70)');
    const id = setTimeout(() => setColor('rgba(255,255,255,0.30)'), 100);
    return () => clearTimeout(id);
  }, [effectIndex]);

  return (
    <div
      style={{
        position:      'absolute',
        bottom:        '1.5rem',
        right:         '1.5rem',
        fontFamily:    'monospace',
        fontSize:      '0.75rem',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        color,
        transition:    'color 2s ease',
        zIndex:        10,
      }}
    >
      {EFFECT_NAMES[effectIndex]}
    </div>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

export default function EffectsCanvas({ videoRef, boxRef, effectIndex }: EffectsCanvasProps) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        orthographic
        camera={{ left: -1, right: 1, top: 1, bottom: -1, near: 0, far: 1, position: [0, 0, 0.5] }}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <ShaderPlane videoRef={videoRef} boxRef={boxRef} effectIndex={effectIndex} />
      </Canvas>

      <EffectHUD effectIndex={effectIndex} />
    </div>
  );
}
