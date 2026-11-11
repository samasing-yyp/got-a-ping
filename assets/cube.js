// the game's sticker cube in 3d: 27 cubies with black bodies and rounded stickers in the 6 colors of a cube,
// cel shaded in bands like the game, drawn at half resolution so it is as pixelated as in the game. it tumbles on a
// drifting axis, scrambles itself a few turns and solves back (like obj_rubik idling), and turns with a drag
// CUBE.colors([[r,g,b] x 6]) sets the faces in the game's order: top, bottom, right, left, back, front
const CUBE = (() => {
  const cv = document.getElementById('cube');
  if (!cv) return { colors() {} };
  const gl = cv.getContext('webgl', { antialias: false, alpha: true });
  if (!gl) return { colors() {} };

  const VS = `attribute vec3 a_p; attribute vec3 a_n; attribute vec2 a_uv;
uniform mat4 u_mvp; uniform mat4 u_m; varying vec3 v_n; varying vec2 v_uv;
void main() { v_n = (u_m * vec4(a_n, 0.0)).xyz; v_uv = a_uv; gl_Position = u_mvp * vec4(a_p, 1.0); }`;
  // stickers are the game's rounded box (shd_rub): a hard edged square with round corners and a lighter rim,
  // light in three bands from the upper left front
  const FS = `precision mediump float;
uniform vec3 u_col; uniform float u_stk; varying vec3 v_n; varying vec2 v_uv;
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  float l = max(dot(normalize(v_n), normalize(vec3(-0.45, 0.7, 0.6))), 0.0);
  l = 0.55 + 0.45 * floor(l * 3.0 + 0.5) / 3.0;
  vec3 c = u_col * l;
  if (u_stk > 0.5) {
    float d = rbox(v_uv - 0.5, vec2(0.43), 0.1);
    if (d > 0.0) discard;
    if (d > -0.05) c = min(u_col * 1.25, vec3(1.0)) * l;
    if (v_uv.y > 0.8 && v_uv.x < 0.35 && v_uv.x > 0.12 && v_uv.y < 0.86) c = mix(c, vec3(1.0), 0.45);
  }
  gl_FragColor = vec4(c, 1.0);
}`;
  const sh = (k, s) => { const o = gl.createShader(k); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const P = gl.createProgram();
  gl.attachShader(P, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(P, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(P);
  gl.useProgram(P);
  const A = { p: gl.getAttribLocation(P, 'a_p'), n: gl.getAttribLocation(P, 'a_n'), uv: gl.getAttribLocation(P, 'a_uv') };
  const U = { mvp: gl.getUniformLocation(P, 'u_mvp'), m: gl.getUniformLocation(P, 'u_m'), col: gl.getUniformLocation(P, 'u_col'), stk: gl.getUniformLocation(P, 'u_stk') };

  // ---- small math: column major 4x4, quaternions [x, y, z, w]
  const m4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; }
  function trans(x, y, z) { const m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scl(s) { const m = m4(); m[0] = m[5] = m[10] = s; return m; }
  function qax(x, y, z, deg) { const l = Math.hypot(x, y, z) || 1, h = deg * Math.PI / 360, s = Math.sin(h) / l; return [x * s, y * s, z * s, Math.cos(h)]; }
  function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
  function qm4(q) { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1]; }
  function rax(a, deg) { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180), m = m4(); const i = (a + 1) % 3, j = (a + 2) % 3; m[i * 4 + i] = c; m[i * 4 + j] = s; m[j * 4 + i] = -s; m[j * 4 + j] = c; return m; }
  const ease = k => k * k * (3 - 2 * k);

  // ---- meshes: a unit cube body, a sticker quad facing +z
  function buf(data) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); return { b, n: data.length / 8 }; }
  const FN = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, 0, 1]];   // top bottom right left back front
  function quad(n, s, off) {
    // a square of half size s on the plane through n * off, uv 0..1
    const u = Math.abs(n[1]) > 0.5 ? [1, 0, 0] : [0, 1, 0], v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const P = (a, b) => [n[0] * off + (u[0] * a + v[0] * b) * s, n[1] * off + (u[1] * a + v[1] * b) * s, n[2] * off + (u[2] * a + v[2] * b) * s];
    const V = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    const tri = V.map(([a, b]) => [...P(a, b), ...n, (a + 1) / 2, (b + 1) / 2]);
    // keep it facing out: flip the winding when needed
    const e1 = [tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]], e2 = [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { [tri[1], tri[2]] = [tri[2], tri[1]]; [tri[4], tri[5]] = [tri[5], tri[4]]; }
    return tri.flat();
  }
  const BODY = buf(FN.flatMap(n => quad(n, 0.5, 0.5)));
  const STK = FN.map(n => buf(quad(n, 0.43, 0.505)));

  // ---- the cubies: position and turn, each sticker keeps the face it started on (its color)
  let C = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    const s = [];
    FN.forEach((n, f) => { if (n[0] * x + n[1] * y + n[2] * z === 1) s.push(f); });
    C.push({ p: [x, y, z], R: m4(), s });
  }
  let cols = [[245, 245, 245], [255, 213, 0], [225, 45, 45], [255, 130, 30], [40, 120, 230], [0, 158, 96]].map(c => c.map(v => v / 255));
  let q = qmul(qax(1, 0, 0, 24), qax(0, 1, 0, -34)), turn = null, hist = [], mode = 'shuffle', wait = 0.6, drag = null, seen = true;

  function commit(T) {
    const r = rax(T.a, 90 * T.d);
    for (const c of C) {
      if (Math.round(c.p[T.a]) !== T.l) continue;
      const p = c.p, n = [r[0] * p[0] + r[4] * p[1] + r[8] * p[2], r[1] * p[0] + r[5] * p[1] + r[9] * p[2], r[2] * p[0] + r[6] * p[1] + r[10] * p[2]];
      c.p = n.map(Math.round);
      c.R = mul(r, c.R);
    }
  }
  // scramble 7 turns, rest, solve them back faster, rest, again
  function step(dt) {
    if (turn) {
      turn.t += dt / turn.dur;
      if (turn.t >= 1) { commit(turn); turn = null; }
      return;
    }
    wait -= dt;
    if (wait > 0) return;
    if (mode === 'shuffle') {
      if (hist.length >= 7) { mode = 'solve'; wait = 1.4; return; }
      const T = { a: Math.floor(Math.random() * 3), l: Math.floor(Math.random() * 3) - 1, d: Math.random() < 0.5 ? 1 : -1, t: 0, dur: 0.32 };
      hist.push(T); turn = T; wait = 0.12;
    } else {
      const T = hist.pop();
      if (!T) { mode = 'shuffle'; wait = 2.4; return; }
      turn = { a: T.a, l: T.l, d: -T.d, t: 0, dur: 0.2 }; wait = 0.05;
    }
  }

  function draw() {
    const w = Math.max(32, Math.round(cv.clientWidth / 2)), h = Math.max(32, Math.round(cv.clientHeight / 2));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    const VP = mul(persp(0.5, w / h, 0.1, 50), trans(0, 0, -12.2)), Q = qm4(q);
    const TR = turn ? rax(turn.a, 90 * turn.d * ease(Math.min(1, turn.t))) : null;
    for (const c of C) {
      let M = mul(trans(c.p[0], c.p[1], c.p[2]), c.R);
      if (TR && Math.round(c.p[turn.a]) === turn.l) M = mul(TR, M);
      M = mul(Q, M);
      const MB = mul(M, scl(0.97));
      draw1(BODY, mul(VP, MB), MB, [0.07, 0.07, 0.09], 0);
      for (const f of c.s) draw1(STK[f], mul(VP, M), M, cols[f], 1);
    }
  }
  function draw1(B, mvp, m, col, stk) {
    gl.bindBuffer(gl.ARRAY_BUFFER, B.b);
    gl.enableVertexAttribArray(A.p); gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(A.n); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(A.uv); gl.vertexAttribPointer(A.uv, 2, gl.FLOAT, false, 32, 24);
    gl.uniformMatrix4fv(U.mvp, false, new Float32Array(mvp));
    gl.uniformMatrix4fv(U.m, false, new Float32Array(m));
    gl.uniform3f(U.col, col[0], col[1], col[2]); gl.uniform1f(U.stk, stk);
    gl.drawArrays(gl.TRIANGLES, 0, B.n);
  }

  // drag turns the whole cube, letting go goes back to tumbling
  cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
    drag = [e.clientX, e.clientY];
    q = qmul(qmul(qax(0, 1, 0, dx * 0.6), qax(1, 0, 0, dy * 0.6)), q);
  });
  const up = () => { drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  if ('IntersectionObserver' in window) new IntersectionObserver(E => { seen = E[0].isIntersecting; }).observe(cv);

  let last = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (seen) {
      if (!drag && !still) { const t = now / 1000; q = qmul(qax(Math.sin(t * 0.31), Math.cos(t * 0.23), Math.sin(t * 0.17 + 1), 24 * dt), q); }
      if (!still) step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { colors(A6) { cols = A6.map(c => c.map(v => v / 255)); } };
})();
