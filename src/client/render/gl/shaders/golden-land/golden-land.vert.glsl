#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;

uniform mat3 uCamera;
// Bounding box of every golden land, in tiles: x, y, width, height.
uniform vec4 uRect;

out vec2 vUV;
out vec2 vWorld;

void main() {
  vUV = aPos;
  vWorld = uRect.xy + aPos * uRect.zw;
  vec3 clip = uCamera * vec3(vWorld, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
