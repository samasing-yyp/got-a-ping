// the game's backdrop (shaders/shd_bg) behind the page: two tones of a pastel color in one of six patterns,
// a change of pattern dissolves in 2x2 blocks by an ordered dither, the color drifts through the class colors
// like the game's menu. drawn at half the page's resolution so one game pixel is 2 css px
// BG.want(pattern, rgb or null, speed): 0 checker, 1 stripes, 2 rings round the cube, 3 cubes, 4 diamonds, 5 rays
const BG = (() => {
  const cv = document.getElementById('bg');
  const gl = cv && cv.getContext('webgl', { antialias: false, alpha: false });
  const FS = `precision highp float;
uniform vec3 u_col; uniform vec2 u_off; uniform float u_sz; uniform float u_t; uniform vec2 u_c; uniform vec4 u_wa; uniform vec2 u_wb; uniform float u_h;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float checker(vec2 q, float s) { return mod(floor(q.x / s) + floor(q.y / s), 2.0); }
float stripes(vec2 q, float s) { return mod(floor((q.x + q.y) / (s * 0.7)), 2.0); }
float squares(vec2 p, float s) { vec2 d = abs(p - u_c); return mod(floor(max(d.x, d.y) / (s * 0.55) - u_t), 2.0); }
float cubes(vec2 q, float s) {
  vec2 r = vec2(1.0, 1.7320508) * s * 1.2; vec2 h = r * 0.5;
  vec2 a = mod(q, r) - h; vec2 b = mod(q - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b;
  float d = degrees(atan(g.y, g.x)); if (d < 0.0) d += 360.0;
  if (d >= 30.0 && d < 150.0) return 0.0; if (d >= 150.0 && d < 270.0) return 0.5; return 1.0;
}
float diamonds(vec2 q, float s) { vec2 c = floor(q / s), f = fract(q / s) - 0.5; float r = 0.22 + 0.1 * sin(u_t * 2.0 + (c.x + c.y) * 0.8); return step(abs(f.x) + abs(f.y), r); }
float rays(vec2 p, float s) { vec2 d = p - u_c; float a = atan(d.y, d.x) / 6.2831853; return mod(floor(a * 18.0 + length(d) / (s * 3.0) - u_t * 0.5), 2.0); }
void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, u_h - gl_FragCoord.y)); vec2 q = p + u_off; float s = u_sz;
  float tot = max(0.0001, u_wa.x + u_wa.y + u_wa.z + u_wa.w + u_wb.x + u_wb.y); vec4 wa = u_wa / tot; vec2 wb = u_wb / tot;
  float r = bayer8(floor(p * 0.5));
  float m = checker(q, s), acc = wa.x;
  if (r >= acc) m = stripes(q, s); acc += wa.y;
  if (r >= acc) m = squares(p, s); acc += wa.z;
  if (r >= acc) m = cubes(q, s); acc += wa.w;
  if (r >= acc) m = diamonds(q, s); acc += wb.x;
  if (r >= acc) m = rays(p, s);
  vec3 a = mix(u_col, vec3(1.0), 0.55); float l = dot(a, vec3(0.299, 0.587, 0.114)); vec3 b = mix(a, vec3(l), 0.35) * 0.93;
  gl_FragColor = vec4(mix(a, b, m), 1.0);
}`;
  const VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
  let P, U = {}, W = [1, 0, 0, 0, 0, 0], col = [1, 0.43, 0.7], spd = 1, t = 0, ox = 0, oy = 0, want = { p: 0, col: null, spd: 1 }, last = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (gl) {
    const sh = (k, s) => { const o = gl.createShader(k); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    P = gl.createProgram();
    gl.attachShader(P, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(P, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(P);
    gl.useProgram(P);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(P, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['u_col', 'u_off', 'u_sz', 'u_t', 'u_c', 'u_wa', 'u_wb', 'u_h']) U[n] = gl.getUniformLocation(P, n);
  }
  const cls = () => (window.GAME ? GAME.classes.slice(0, 13).map(c => c.col.map(v => v / 255)) : [[1, 0.43, 0.7]]);
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  // the middle of the 3d cube on the canvas, the rings and rays come out of it
  function center() {
    const c = document.getElementById('cube');
    if (!c) return [cv.width * 0.5, cv.height * 0.4];
    const r = c.getBoundingClientRect();
    return [(r.left + r.width * 0.5) * 0.5, (r.top + r.height * 0.5) * 0.5];
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (gl) {
      const w = Math.ceil(innerWidth / 2), h = Math.ceil(innerHeight / 2);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      // the color: what a page asked for, else the class colors in turn, 12 s each, eased
      const C = cls(), k = now / 12000, i = Math.floor(k) % C.length, e = k % 1, ee = e * e * (3 - 2 * e);
      const target = want.col || mix(C[i], C[(i + 1) % C.length], ee);
      col = mix(col, target, 1 - Math.exp(-3 * dt));
      for (let j = 0; j < 6; j++) W[j] += ((j === want.p ? 1 : 0) - W[j]) * (1 - Math.exp(-2.5 * dt));
      spd += (want.spd - spd) * (1 - Math.exp(-3 * dt));
      if (!still) { t += dt * spd; ox += dt * 7 * spd; oy += dt * 4.5 * spd; }
      const c = center();
      gl.uniform3f(U.u_col, col[0], col[1], col[2]);
      gl.uniform2f(U.u_off, Math.floor(ox), Math.floor(oy));
      gl.uniform1f(U.u_sz, 22); gl.uniform1f(U.u_t, t); gl.uniform1f(U.u_h, h);
      gl.uniform2f(U.u_c, c[0], c[1]);
      gl.uniform4f(U.u_wa, W[0], W[1], W[2], W[3]); gl.uniform2f(U.u_wb, W[4], W[5]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { want(p, rgb, s) { want = { p, col: rgb ? rgb.map(v => v / 255) : null, spd: s == null ? 1 : s }; } };
})();
