const THREE = require('three');
const fs = require('fs');
const vertex = fs.readFileSync('src/shaders/vertex.glsl', 'utf8');
const fragment = fs.readFileSync('src/shaders/fragment.glsl', 'utf8');

const glContext = require('gl')(1, 1);
const renderer = new THREE.WebGLRenderer({ context: glContext });
const material = new THREE.ShaderMaterial({
  vertexShader: vertex,
  fragmentShader: fragment,
  uniforms: {
    uTexture: { value: null },
    uTime: { value: 0 },
    uBox: { value: new THREE.Vector4() },
    uEffect: { value: 0 },
    uResolution: { value: new THREE.Vector2() }
  }
});
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
const scene = new THREE.Scene();
scene.add(mesh);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
renderer.render(scene, camera);
console.log('Shader compiled and rendered!');
