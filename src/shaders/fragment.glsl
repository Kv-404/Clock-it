// Removed manual precision declaration to defer to Three.js defaults
// ─── Uniforms ──────────────────────────────────────────────────────────────────
uniform sampler2D uTexture;
uniform float     uTime;
uniform vec4      uBox;        // xMin, yMin, xMax, yMax  (normalised 0-1)
uniform float     uEffect;     // 0.0 – 6.0
uniform vec2      uResolution;

// ─── Varyings ─────────────────────────────────────────────────────────────────
varying vec2 vUv;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Simplex 2-D noise ─────────────────────────────────────────────────────────
vec2 mod289_2(vec2 x)  { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 mod289_3(vec3 x)  { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x)   { return mod289_3(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
     0.211324865405187,   //  (3.0 - sqrt(3.0)) / 6.0
     0.366025403784439,   //  0.5 * (sqrt(3.0) - 1.0)
    -0.577350269189626,   // -1.0 + 2.0 * C.x
     0.024390243902439    //  1.0 / 41.0
  );

  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289_2(i);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0))
          + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x   + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

// ── Luminance ─────────────────────────────────────────────────────────────────
float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// ── Fire gradient — black → red → orange → yellow ────────────────────────────
vec3 fireGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.0,  0.0,  0.0);   // t = 0.00
  vec3 c1 = vec3(0.9,  0.0,  0.0);   // t = 0.33
  vec3 c2 = vec3(1.0,  0.45, 0.0);   // t = 0.66
  vec3 c3 = vec3(1.0,  1.0,  0.0);   // t = 1.00

  vec3 col = mix(c0, c1, clamp(t / 0.33,        0.0, 1.0));
  col      = mix(col, c2, clamp((t - 0.33) / 0.33, 0.0, 1.0));
  col      = mix(col, c3, clamp((t - 0.66) / 0.34, 0.0, 1.0));
  return col;
}

// ── Thermal gradient — dark blue → blue → green → yellow → red ───────────────
vec3 thermalGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.0,  0.0,  0.2);   // t = 0.00
  vec3 c1 = vec3(0.1,  0.0,  1.0);   // t = 0.25
  vec3 c2 = vec3(0.0,  1.0,  0.0);   // t = 0.50
  vec3 c3 = vec3(1.0,  0.9,  0.0);   // t = 0.75
  vec3 c4 = vec3(1.0,  0.0,  0.0);   // t = 1.00

  vec3 col = mix(c0, c1, clamp(t / 0.25,          0.0, 1.0));
  col      = mix(col, c2, clamp((t - 0.25) / 0.25, 0.0, 1.0));
  col      = mix(col, c3, clamp((t - 0.50) / 0.25, 0.0, 1.0));
  col      = mix(col, c4, clamp((t - 0.75) / 0.25, 0.0, 1.0));
  return col;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
void main() {

  // ── STEP 1 — Flip UV (mirror X for selfie orientation) ──────────────────────
  vec2 uv = vec2(1.0 - vUv.x, vUv.y);

  // ── STEP 2 — Pre-sample ALL textures (ZERO texture2D calls after this block) ─
  vec2 texel = 1.0 / uResolution;

  // Base sample
  vec4 base = texture2D(uTexture, uv);

  // Noise-displaced sample
  vec2 dispUv    = uv + snoise(uv * 3.0 + uTime * 0.4) * 0.04;
  vec4 dispSample = texture2D(uTexture, dispUv);

  // Chromatic aberration samples
  float rOff = snoise(vec2(uv.y * 5.0, uTime))          * 0.012;
  float gOff = snoise(vec2(uv.y * 5.0, uTime + 1.0))    * 0.012;
  float bOff = snoise(vec2(uv.y * 5.0, uTime + 2.0))    * 0.012;
  vec4 rSample = texture2D(uTexture, uv + vec2(rOff, 0.0));
  vec4 gSample = texture2D(uTexture, uv + vec2(gOff, 0.0));
  vec4 bSample = texture2D(uTexture, uv + vec2(bOff, 0.0));

  // Pixelated (Matrix) sample
  float aspect  = uResolution.x / uResolution.y;
  float cols    = 90.0;
  vec2  gridUv  = floor(uv * vec2(cols, cols / aspect))
                / vec2(cols, cols / aspect)
                + vec2(0.5 / cols, 0.5 / (cols / aspect));
  vec4 pixelSample = texture2D(uTexture, gridUv);

  // Sobel 8-neighbourhood
  vec4 s00 = texture2D(uTexture, uv + vec2(-texel.x, -texel.y));
  vec4 s10 = texture2D(uTexture, uv + vec2( 0.0,     -texel.y));
  vec4 s20 = texture2D(uTexture, uv + vec2( texel.x, -texel.y));
  vec4 s01 = texture2D(uTexture, uv + vec2(-texel.x,  0.0    ));
  vec4 s21 = texture2D(uTexture, uv + vec2( texel.x,  0.0    ));
  vec4 s02 = texture2D(uTexture, uv + vec2(-texel.x,  texel.y));
  vec4 s12 = texture2D(uTexture, uv + vec2( 0.0,      texel.y));
  vec4 s22 = texture2D(uTexture, uv + vec2( texel.x,  texel.y));

  // CRT chromatic-split samples (Effect 8)
  vec4 crtR = texture2D(uTexture, uv + vec2(0.005, 0.0));
  vec4 crtB = texture2D(uTexture, uv - vec2(0.005, 0.0));

  // Psychedelic-wave displaced sample (Effect 11)
  vec2 pwUv = uv + vec2(
    sin(uv.y * 12.0 + uTime * 2.0) * 0.03,
    cos(uv.x * 12.0 + uTime * 2.0) * 0.03
  );
  vec4 waveSample = texture2D(uTexture, pwUv);

  // ── STEP 3 — Pre-compute luminance values ────────────────────────────────────
  float lum     = getLuma(base.rgb);
  float dispLum = getLuma(dispSample.rgb);

  // ── STEP 4 — Outside-box: desaturated grayscale passthrough ─────────────────
  bool inBox = uBox.z > 0.001
            && uv.x > uBox.x && uv.x < uBox.z
            && uv.y > uBox.y && uv.y < uBox.w;

  if (!inBox) {
    float gray = getLuma(base.rgb);
    // Slightly darken and fully desaturate outside the portal
    vec3 outside = vec3(gray) * 0.75;
    gl_FragColor = vec4(outside, 1.0);
    return;
  }

  // ── STEP 5 — Silver shimmering border (0.004 thick) ────────────────────────
  bool onBorder = (uv.x < uBox.x + 0.004 || uv.x > uBox.z - 0.004
                || uv.y < uBox.y + 0.004 || uv.y > uBox.w - 0.004);

  if (onBorder) {
    // Soft silver-white border with a slow breathing pulse
    float pulse = 0.6 + 0.4 * sin(uTime * 1.2);
    // Very subtle position-based variation — not rainbow, just depth
    float positionalShimmer = 0.08 * sin(uv.x * 12.0 + uTime * 0.8) * cos(uv.y * 12.0 - uTime * 0.6);
    float brightness = pulse + positionalShimmer;
    vec3 borderColor = vec3(brightness * 0.92, brightness * 0.94, brightness);
    // The border is slightly blue-white — cold, clean, premium
    gl_FragColor = vec4(borderColor, 1.0);
    return;
  }

  // ── STEP 6 — Effect selection (no texture2D calls below this line) ───────────

  // ── Effect 0 — Burning Inferno ───────────────────────────────────────────────
  if (uEffect < 0.5) {
    float flickerLum = dispLum * (0.85 + snoise(uv * 10.0 + uTime) * 0.15);
    gl_FragColor = vec4(fireGradient(flickerLum), 1.0);
  }

  // ── Effect 1 — Neon Silhouette ───────────────────────────────────────────────
  else if (uEffect < 1.5) {
    float b    = pow(lum, 1.2) * 1.5;
    float n    = snoise(uv * 200.0 + uTime * 0.5) * 0.15;
    float core = smoothstep(0.5 + n, 0.7 + n, b);
    float halo = smoothstep(0.2 + n, 0.6 + n, b);
    vec3  col  = mix(vec3(0.0), vec3(0.4, 0.9, 1.0), halo);
          col  = mix(col, vec3(1.0), core);
    gl_FragColor = vec4(col, 1.0);
  }

  // ── Effect 2 — Thermal Vision ────────────────────────────────────────────────
  else if (uEffect < 2.5) {
    float tv = clamp((lum - 0.1) * 1.2, 0.0, 1.0);
    gl_FragColor = vec4(thermalGradient(tv), 1.0);
  }

  // ── Effect 3 — Matrix Dots ───────────────────────────────────────────────────
  else if (uEffect < 3.5) {
    float pl      = getLuma(pixelSample.rgb);
    vec2  cellUv  = fract(uv * vec2(cols, cols / aspect));
    float d       = distance(cellUv, vec2(0.5));
    float dotSize = 0.35 + pl * 0.1;
    vec3  matColor = d < dotSize
                   ? vec3(0.0, pl > 0.25 ? 1.0 : 0.2, 0.05)
                   : vec3(0.0, 0.08, 0.0);
    gl_FragColor = vec4(matColor, 1.0);
  }

  // ── Effect 4 — Glitch Signal ─────────────────────────────────────────────────
  else if (uEffect < 4.5) {
    vec3  glitch    = vec3(rSample.r, gSample.g, bSample.b);
          glitch   -= sin(uv.y * 800.0 + uTime * 10.0) * 0.04;
    float tearCheck = step(0.95, fract(uTime * 2.0)) * step(abs(uv.y - 0.5), 0.01);
          glitch    = mix(glitch, 1.0 - glitch, tearCheck);
    gl_FragColor = vec4(clamp(glitch, 0.0, 1.0), 1.0);
  }

  // ── Effect 5 — Neon Edges / Sobel ────────────────────────────────────────────
  else if (uEffect < 5.5) {
    float l00 = getLuma(s00.rgb), l10 = getLuma(s10.rgb), l20 = getLuma(s20.rgb);
    float l01 = getLuma(s01.rgb), l21 = getLuma(s21.rgb);
    float l02 = getLuma(s02.rgb), l12 = getLuma(s12.rgb), l22 = getLuma(s22.rgb);

    float Gx = -l00 - 2.0*l01 - l02 + l20 + 2.0*l21 + l22;
    float Gy = -l00 - 2.0*l10 - l20 + l02 + 2.0*l12 + l22;

    float edge      = clamp(sqrt(Gx*Gx + Gy*Gy) * 3.0, 0.0, 1.0);
    vec3  edgeColor = vec3(0.1, 1.0, 0.8) * edge * 2.5 + base.rgb * 0.3;
    gl_FragColor = vec4(edgeColor, 1.0);
  }

  // ── Effect 6 — Constellation Pulse ───────────────────────────────────────────
  else if (uEffect < 6.5) {
    vec2  boxCenter    = (uBox.xy + uBox.zw) * 0.5;
    float distToCenter = distance(uv, boxCenter);
    float pulse        = 0.5 + 0.5 * sin(uTime * 3.0);
    float glow         = smoothstep(0.4, 0.0, distToCenter) * pulse * 0.4;

    vec3 tinted = mix(base.rgb, vec3(0.03, 0.0, 0.15), 0.65);
    tinted += vec3(0.25, 0.08, 1.0) * glow;
    tinted += vec3(0.0, 0.45, 1.0) * sin(uv.x * 40.0 - uTime * 5.0) * 0.03;

    float spark = pow(lum, 4.0) * (0.5 + 0.5 * snoise(uv * 30.0 + uTime));
    tinted += vec3(0.55, 0.75, 1.0) * spark;

    gl_FragColor = vec4(clamp(tinted, 0.0, 1.0), 1.0);
  }

  // ── Effect 7 — Vaporwave Dream ───────────────────────────────────────────────
  else if (uEffect < 7.5) {
    vec3 c = base.rgb;
    // Boost magenta and cyan
    c.r = pow(c.r, 0.8) * 1.5;
    c.g = pow(c.g, 1.2) * 0.8;
    c.b = pow(c.b, 0.8) * 1.8;
    
    // Horizontal scanlines and vertical grid
    float grid = step(0.95, fract(uv.y * 20.0 + uTime * 0.5)) + step(0.95, fract(uv.x * 20.0));
    gl_FragColor = vec4(mix(c, vec3(1.0, 0.2, 0.8), grid * 0.2), 1.0);
  }

  // ── Effect 8 — Retro CRT ─────────────────────────────────────────────────────
  else if (uEffect < 8.5) {
    // RGB split using pre-sampled CRT textures
    vec3 c = vec3(crtR.r, base.g, crtB.b);
    
    // Scanlines
    float scanline = sin(uv.y * 800.0) * 0.04;
    c -= scanline;
    
    // Vignette
    float dist = distance(uv, vec2(0.5));
    c *= smoothstep(0.8, 0.3, dist * (1.0 + 0.2 * sin(uTime * 5.0)));
    
    gl_FragColor = vec4(c, 1.0);
  }

  // ── Effect 9 — Vintage Sepia ─────────────────────────────────────────────────
  else if (uEffect < 9.5) {
    float r = (base.r * 0.393) + (base.g * 0.769) + (base.b * 0.189);
    float g = (base.r * 0.349) + (base.g * 0.686) + (base.b * 0.168);
    float b = (base.r * 0.272) + (base.g * 0.534) + (base.b * 0.131);
    
    vec3 sepia = vec3(r, g, b);
    
    // Subtle film grain
    float noise = snoise(uv * 200.0 + uTime * 10.0) * 0.05;
    sepia += noise;
    
    // Film scratch (vertical lines occasionally)
    float scratch = step(0.998, fract(sin(dot(uv.x + uTime * 0.1, 12.9898)) * 43758.5453));
    sepia += scratch * 0.2;

    // Darker edges
    float dist = distance(uv, vec2(0.5));
    sepia *= smoothstep(0.8, 0.4, dist);
    
    gl_FragColor = vec4(clamp(sepia, 0.0, 1.0), 1.0);
  }

  // ── Effect 10 — Cyberpunk Edge ───────────────────────────────────────────────
  else if (uEffect < 10.5) {
    float l00 = getLuma(s00.rgb), l10 = getLuma(s10.rgb), l20 = getLuma(s20.rgb);
    float l01 = getLuma(s01.rgb), l21 = getLuma(s21.rgb);
    float l02 = getLuma(s02.rgb), l12 = getLuma(s12.rgb), l22 = getLuma(s22.rgb);
    float Gx = -l00 - 2.0*l01 - l02 + l20 + 2.0*l21 + l22;
    float Gy = -l00 - 2.0*l10 - l20 + l02 + 2.0*l12 + l22;
    float edge = clamp(sqrt(Gx*Gx + Gy*Gy) * 3.0, 0.0, 1.0);
    
    // Split neon cyan/pink
    vec3 cy = vec3(0.0, 1.0, 0.9);
    vec3 pk = vec3(1.0, 0.0, 0.6);
    float side = step(0.5, uv.x + sin(uv.y * 10.0 + uTime)*0.1);
    vec3 edgeColor = mix(pk, cy, side) * edge * 2.5;
    
    // Tint dark areas with deep purple
    vec3 baseTint = mix(vec3(0.05, 0.0, 0.1), base.rgb, 0.2);
    
    gl_FragColor = vec4(clamp(baseTint + edgeColor, 0.0, 1.0), 1.0);
  }

  // ── Effect 11 — Psychedelic Wave ─────────────────────────────────────────────
  else if (uEffect < 11.5) {
    vec3 c = waveSample.rgb;
    // Map luminance to a rotating rainbow palette
    float l = getLuma(c);
    vec3 rainbow = vec3(
      0.5 + 0.5 * sin(l * 10.0 + uTime),
      0.5 + 0.5 * sin(l * 10.0 + uTime + 2.09),
      0.5 + 0.5 * sin(l * 10.0 + uTime + 4.18)
    );
    
    gl_FragColor = vec4(mix(c, rainbow, 0.6), 1.0);
  }

  // ── Effect 12 — Inverted Void ────────────────────────────────────────────────
  else {
    // High contrast black and white negative
    float gray = getLuma(base.rgb);
    float contrastGray = smoothstep(0.3, 0.7, gray);
    vec3 inverted = vec3(1.0 - contrastGray);
    
    // White glowing trails outside the sharp edges based on motion (using dispersion trick)
    float lDisp = getLuma(dispSample.rgb);
    float glow = smoothstep(0.4, 0.8, lDisp);
    
    // Pure black void for the darkest parts
    inverted *= smoothstep(0.1, 0.3, gray);
    inverted += vec3(glow * 0.3);
    
    gl_FragColor = vec4(clamp(inverted, 0.0, 1.0), 1.0);
  }
}
