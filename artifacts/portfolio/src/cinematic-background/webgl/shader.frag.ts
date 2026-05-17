/**
 * Cinematic plasma-mesh fragment shader.
 *
 * A multi-octave fbm flow field warped by mouse position, blended into
 * a three-color plasma palette (amber → plasma-purple → signal-cyan)
 * over the deep ink base. Output is sub-15% saturation so foreground
 * typography always wins the contrast battle.
 *
 * Inputs:
 *   u_time   — seconds since boot (for slow temporal drift)
 *   u_res    — viewport pixels
 *   u_mouse  — normalised mouse position [0..1] (smoothed in JS)
 *   u_scroll — scroll progress [0..1] (drives palette shift)
 *
 * Validates: Requirements 5.4, 5.8, 10.4
 */
export const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_scroll;
uniform float u_velocity;
uniform vec3 u_amber;
uniform vec3 u_plasma;
uniform vec3 u_signal;
uniform vec3 u_base;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
    u.y
  );
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for(int i = 0; i < 5; i++){
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main(){
  // Aspect-correct uv around centre
  vec2 uv = (v_uv - 0.5);
  uv.x *= u_res.x / u_res.y;

  // Mouse pull (very subtle)
  vec2 m = (u_mouse - 0.5);
  m.x *= u_res.x / u_res.y;
  vec2 toMouse = (m - uv) * 0.18;

  // Scroll velocity warps the field — fast scroll = deformed plasma
  float vWarp = u_velocity * 0.3;
  uv += vec2(0.0, vWarp * (uv.y * 0.5));

  // Two domain-warp layers drifting in opposite directions
  float t = u_time * 0.06 + u_velocity * 0.5;
  vec2 q = vec2(
    fbm(uv * 1.4 + vec2(t, -t) + toMouse),
    fbm(uv * 1.4 + vec2(-t, t * 0.7) - toMouse * 0.5)
  );
  float n = fbm(uv * 1.8 + q * 1.2 + t);

  // Three plasma fields, each shifted in space + phase
  float fA = smoothstep(0.20, 0.80, n);
  float fB = smoothstep(0.30, 0.70, fbm(uv * 1.3 + q + t * 0.8 + 3.7));
  float fC = smoothstep(0.35, 0.65, fbm(uv * 1.1 - q * 0.7 + t * 0.5 + 7.1));

  // Scroll shifts palette weighting: amber-dominant at top, signal-dominant at bottom
  float sShift = clamp(u_scroll, 0.0, 1.0);
  // Velocity also brightens (engagement = energy)
  float energy = 1.0 + u_velocity * 0.6;

  vec3 color = u_base;
  color = mix(color, u_amber,  fA * (0.18 + 0.10 * (1.0 - sShift)) * energy);
  color = mix(color, u_plasma, fB * (0.14 + 0.08 * sShift) * energy);
  color = mix(color, u_signal, fC * (0.12 + 0.06 * sShift) * energy);

  // Soft edge fade only — keep the canvas bright in the centre
  float r = length(uv);
  float vignette = 1.0 - smoothstep(1.1, 1.9, r) * 0.30;
  color *= vignette;

  // Subtle film grain
  float grain = (hash(v_uv * u_res + u_time) - 0.5) * 0.012;
  color += grain;

  gl_FragColor = vec4(color, 1.0);
}
`.trim();
