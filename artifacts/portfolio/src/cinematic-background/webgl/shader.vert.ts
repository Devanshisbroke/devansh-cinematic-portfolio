/**
 * Pass-through vertex shader for the Cinematic_Background fullscreen quad.
 *
 * The quad is supplied as four NDC corners in `a_pos` ([-1,-1] .. [1,1])
 * and rendered with `gl.TRIANGLE_STRIP`. The shader simply forwards the
 * position to clip space and emits a UV in [0, 1] for the fragment shader
 * to sample its noise field over.
 *
 * Combined with `shader.frag.ts`, the source must stay ≤ 1 KB gzipped
 * (R10.4 / 12.2 budget).
 *
 * Validates: Requirements 5.4, 5.8, 10.4
 */
export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`.trim();
