// ─── VESPERA — Vertex Shader ──────────────────────────────────────────────────
// Passthrough: forwards UV coordinates to the fragment shader.
// The mesh is a 2×2 PlaneGeometry in clip space, so no MVP transform is needed
// beyond the identity (position is already in NDC).

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
