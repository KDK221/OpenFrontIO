#version 300 es
precision highp float;

// Golden lands: rich farmland painted as gold paddy fields with a slow
// sheen and a dark-gold field boundary. The mask is 255 on golden tiles and
// sampled with linear filtering, so its 0..1 ramp gives a soft edge.

in vec2 vUV;
in vec2 vWorld;

uniform sampler2D uMask;
uniform float uTime;

out vec4 fragColor;

void main() {
  float m = texture(uMask, vUV).r;
  if (m < 0.02) discard;

  float fill = smoothstep(0.3, 0.7, m);
  // Field boundary: a thin band where the mask crosses ~0.42.
  float rim = clamp(1.0 - abs(m - 0.42) / 0.14, 0.0, 1.0);

  // Paddy furrows; faded out when zoomed far enough to alias.
  float phase = (vWorld.x * 0.8 + vWorld.y * 0.6) * 2.4;
  float furrowFade = clamp(1.5 - fwidth(phase) * 0.6, 0.0, 1.0);
  float furrow = (0.5 + 0.5 * sin(phase)) * furrowFade;

  // A slow sheen drifting across the fields.
  float sheen = 0.5 + 0.5 * sin(uTime * 1.2 + (vWorld.x - vWorld.y) * 0.08);

  vec3 gold = vec3(0.96, 0.74, 0.18);
  vec3 light = vec3(1.0, 0.92, 0.55);
  vec3 tint = mix(gold, light, 0.35 * furrow);
  float a = (0.55 + 0.15 * sheen) * fill;

  vec3 rimColor = vec3(0.62, 0.40, 0.08);
  float rimA = 0.9 * rim;

  // Premultiply-free "over": field first, boundary on top.
  float outA = rimA + a * (1.0 - rimA);
  vec3 outC = (rimColor * rimA + tint * a * (1.0 - rimA)) / max(outA, 1e-4);
  fragColor = vec4(outC, outA);
}
