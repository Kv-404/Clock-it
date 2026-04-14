// ─── GLSL shader imports via Vite's ?raw suffix ───────────────────────────────
// Tells TypeScript that importing a .glsl file (with ?raw) yields a plain string.
// Usage in components:
//   import vertexShader   from '../shaders/vertex.glsl?raw'
//   import fragmentShader from '../shaders/fragment.glsl?raw'

declare module '*.glsl?raw' {
  const src: string;
  export default src;
}

// Also support bare .glsl imports (without ?raw) as string, for flexibility.
declare module '*.glsl' {
  const src: string;
  export default src;
}
