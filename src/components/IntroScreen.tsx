import { useState, useEffect } from 'react';

// ─── Injected keyframes ───────────────────────────────────────────────────────

const INTRO_STYLES = `
  @keyframes vesperaWordmarkFade {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes vesperaSubtitleFade {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes vesperaDividerExpand {
    from { opacity: 0; transform: scaleX(0); }
    to   { opacity: 1; transform: scaleX(1); }
  }
  @keyframes vesperaAttributionFade {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes vesperaFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntroScreenProps {
  onComplete: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntroScreen({ onComplete }: IntroScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer     = setTimeout(() => setFading(true),  2400); 
    const completeTimer = setTimeout(() => onComplete(),    2900); 
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&display=swap"
      />
      <style>{INTRO_STYLES}</style>

      <div
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         50,
          background:     '#000000 radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          animation:      fading ? 'vesperaFadeOut 0.5s ease forwards' : 'none',
        }}
      >
        <h1
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontWeight:    300,
            fontSize:      'clamp(64px, 11vw, 108px)',
            letterSpacing: '0.4em',
            color:         '#fff',
            textTransform: 'uppercase',
            margin:        0,
            animation:     'vesperaWordmarkFade 1.0s ease-out 0s both',
          }}
        >
          CLOCK IT
        </h1>

        <p
          style={{
            fontFamily:    'monospace',
            fontSize:      '13px',
            letterSpacing: '0.22em',
            color:         'rgba(255, 255, 255, 0.55)',
            textTransform: 'uppercase',
            marginTop:     '28px',
            marginBottom:  0,
            animation:     'vesperaSubtitleFade 0.9s ease-out 0.35s both',
          }}
        >
          hand-powered visual synthesis
        </p>

        <div
          style={{
            width:           '120px',
            height:          '1px',
            background:      'rgba(255, 255, 255, 0.08)',
            marginTop:       '24px',
            marginBottom:    '23px', // 24+1+23 = ~48px spacing between elements
            transformOrigin: 'center',
            animation:       'vesperaDividerExpand 0.7s ease-out 0.65s both',
          }}
        />

        <p
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontStyle:     'italic',
            fontWeight:    400,
            fontSize:      '15px',
            letterSpacing: '0.12em',
            color:         'rgba(255, 255, 255, 0.45)',
            margin:        0,
            animation:     'vesperaAttributionFade 0.9s ease-out 0.85s both',
          }}
        >
          Made with love by Kv
        </p>
      </div>
    </>
  );
}
