import { useState, useRef, useCallback, useEffect } from 'react';
import IntroScreen    from './components/IntroScreen';
import EffectsCanvas  from './components/EffectsCanvas';
import OverlayCanvas  from './components/OverlayCanvas';
import { useHandTracker } from './hooks/useHandTracker';
import type { BoxCoords, HandData } from './types';

// ─── VESPERA — Root Application ───────────────────────────────────────────────

export default function App() {
  // ── UI state ───────────────────────────────────────────────────────────────
  const [introComplete, setIntroComplete] = useState(false);
  const [videoReady,    setVideoReady]    = useState(false);
  const [modelsReady,   setModelsReady]   = useState(false);
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [effectIndex,   setEffectIndex]   = useState(0);
  const [showHelp,      setShowHelp]      = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const boxRef          = useRef<BoxCoords>([0, 0, 0, 0]);
  const handsRef        = useRef<HandData[]>([]);
  const videoRef        = useRef<HTMLVideoElement>(null);

  // ── Hand tracker ───────────────────────────────────────────────────────────
  const { initTracker } = useHandTracker({
    videoRef,
    boxRef,
    handsRef,
    setVideoReady,
    setModelsReady,
    setErrorMsg,
    setEffectIndex,
  });

  // ── Start tracker once intro completes ─────────────────────────────────────
  useEffect(() => {
    if (!introComplete) return;
    void initTracker();
  }, [introComplete, initTracker]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const video = videoRef.current as
        (HTMLVideoElement & { __vesperaCleanup?: () => void }) | null;
      video?.__vesperaCleanup?.();
    };
  }, []);

  // ── Retry ──────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    setVideoReady(false);
    setModelsReady(false);
    void initTracker();
  }, [initTracker]);

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isLoading = introComplete && (!videoReady || !modelsReady) && !errorMsg;
  const isActive  = introComplete &&  videoReady  &&  modelsReady  && !errorMsg;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-black overflow-hidden w-screen h-screen relative">

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100vw', height: '100vh',
          opacity: 0,
          pointerEvents: 'none',
          objectFit: 'cover',
          zIndex: 0
        }}
        aria-hidden="true"
      />

      {/* ── Intro (auto-dismisses after 2.6 s) ────────────────────────────── */}
      {!introComplete && (
        <IntroScreen onComplete={() => setIntroComplete(true)} />
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            background: '#000000 radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)',
          }}
          aria-live="polite"
          aria-label="Loading VESPERA"
        >
          <style>{`
            @keyframes vesperaLoadRing {
              0%   { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes vesperaLoadPulse {
              0%, 100% { opacity: 0.15; transform: scale(1); }
              50%      { opacity: 0.35; transform: scale(1.08); }
            }
            @keyframes vesperaLoadTextFade {
              0%, 100% { opacity: 0.35; }
              50%      { opacity: 0.6; }
            }
            @keyframes vesperaLoadDots {
              0%   { content: ''; }
              25%  { content: '.'; }
              50%  { content: '..'; }
              75%  { content: '...'; }
            }
          `}</style>

          {/* Outer pulsing ring */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            marginBottom: '40px',
          }}>
            {/* Pulse glow */}
            <div style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.06)',
              animation: 'vesperaLoadPulse 3s ease-in-out infinite',
            }} />
            {/* Spinning arc */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid transparent',
              borderTopColor: 'rgba(255,255,255,0.5)',
              borderRightColor: 'rgba(255,255,255,0.15)',
              animation: 'vesperaLoadRing 1.8s linear infinite',
            }} role="status" />
            {/* Inner dot */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.35)',
              transform: 'translate(-50%, -50%)',
              animation: 'vesperaLoadPulse 3s ease-in-out infinite',
            }} />
          </div>

          {/* Wordmark */}
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: '24px',
            letterSpacing: '0.4em',
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}>
            CLOCK IT
          </p>

          {/* Divider */}
          <div style={{
            width: '60px',
            height: '1px',
            background: 'rgba(255,255,255,0.08)',
            marginBottom: '20px',
          }} />

          {/* Status text */}
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              animation: 'vesperaLoadTextFade 2.5s ease-in-out infinite',
            }}
          >
            {videoReady ? 'Loading AI models' : 'Initializing camera'}
          </p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center px-8"
          style={{ background: '#000' }}
          role="alert"
        >
          <span className="text-4xl" style={{ color: 'rgb(248,113,113)' }}>⚠</span>
          <p
            className="font-mono text-sm max-w-sm"
            style={{ color: 'rgba(252,165,165,0.8)', lineHeight: 1.7 }}
          >
            {errorMsg}
          </p>
          <button
            onClick={handleRetry}
            className="mt-4 px-6 py-2 font-mono text-xs tracking-widest uppercase rounded transition-colors"
            style={{
              border:     '1px solid rgba(248,113,113,0.30)',
              color:      'rgba(248,113,113,0.70)',
              background: 'transparent',
              cursor:     'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(248,113,113,0.10)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'transparent';
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Active canvas layers ───────────────────────────────────────────── */}
      {isActive && (
        <>
          <EffectsCanvas
            videoRef={videoRef}
            boxRef={boxRef}
            effectIndex={effectIndex}
          />
          <OverlayCanvas
            handsRef={handsRef}
            videoRef={videoRef}
          />

          {/* ── Instructions HUD ────────────────────────────────────────────── */}
          <div
            style={{
              position: 'fixed',
              bottom: '32px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              fontFamily: 'monospace',
              pointerEvents: 'auto',
            }}
          >
            {showHelp && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '12px 24px',
                  borderRadius: '4px',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  color: 'rgba(255, 255, 255, 0.45)',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Raise palms to reveal the rift</span>
                <span style={{ margin: '0 12px', opacity: 0.2 }}>|</span>
                <span>Pinch index and thumb to shift reality</span>
              </div>
            )}
            <button
              onClick={() => setShowHelp(!showHelp)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.25)',
                fontSize: '10px',
                cursor: 'pointer',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            >
              [{showHelp ? 'HIDE' : 'HELP'}]
            </button>
          </div>
        </>
      )}

    </div>
  );
}
