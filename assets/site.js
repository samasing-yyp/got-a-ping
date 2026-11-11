// the page's behavior: the language button, the character carousel (the handheld's select screen, it recolors
// the 3d cube and the page accent), and what the backdrop shows on each page
(() => {
  const H = document.documentElement, lang = () => H.dataset.lang || 'es';
  const T = o => (o && typeof o === 'object') ? (o[lang()] || o.es || '') : (o || '');
  // a page text from the panel's table (see rel_site TEXT), by key
  const X = k => T((window.SITE_TEXT || {})[k]);
  const title = () => { const b = document.body.dataset; document.title = (lang() === 'en' ? b.titleEn : b.titleEs) || document.title; };
  title();
  const rgb = c => 'rgb(' + c.join(',') + ')';
  const pastel = (c, k) => c.map(v => Math.round(v + (255 - v) * k));

  // ---- language, remembered
  const lb = document.getElementById('lang');
  if (lb) lb.addEventListener('click', () => {
    const l = lang() === 'es' ? 'en' : 'es';
    H.dataset.lang = l; H.lang = l;
    try { localStorage.setItem('gap_lang', l); } catch (e) {}
    title();
    render();
  });

  // ---- the backdrop: the menu's checker on the landing, diamonds on downloads (shops and treasure),
  // isometric cubes on the changelog (the sticker cube menu), rings rushing in while you hover a download
  const page = document.body.dataset.page;
  if (window.BG) BG.want(page === 'downloads' ? 4 : (page === 'changelog' ? 3 : 0), null, page === 'changelog' ? 0.5 : 1);
  document.querySelectorAll('.dl:not(.off)').forEach(a => {
    a.addEventListener('mouseenter', () => BG.want(2, [255, 214, 90], -4));
    a.addEventListener('mouseleave', () => BG.want(page === 'downloads' ? 4 : 3, null, page === 'changelog' ? 0.5 : 1));
  });

  // ---- characters
  const box = document.getElementById('carousel');
  if (!box || !window.GAME) return;
  const CL = {}; GAME.classes.forEach(c => { CL[c.key] = c; });
  const heroes = GAME.heroes.filter(h => h.png);
  let i = Math.floor(Math.random() * heroes.length), timer = null;
  const STAT = [['hp', 'st_hp'], ['dmg', 'st_dmg'], ['rate', 'st_rate'], ['spd', 'st_spd'], ['luck', 'st_luck']];

  function pick(n) {
    i = (n + heroes.length) % heroes.length;
    render();
    clearInterval(timer);
    timer = setInterval(() => pick(i + 1), 7000);
  }
  function render() {
    const h = heroes[i], c = h.cls && CL[h.cls] ? CL[h.cls].col : [255, 110, 180];
    // the page takes the character's color, the handheld a pastel of it, the cube their 6 faces
    H.style.setProperty('--acc', rgb(c));
    H.style.setProperty('--ds', rgb(pastel(c, 0.62)));
    if (window.CUBE) CUBE.colors((h.faces || GAME.cube_def).map(f => (CL[f] ? CL[f].col : [40, 42, 54])));
    const bars = STAT.map(([k, n]) => {
      const v = (h.traits || {})[k] || 0;
      let b = '';
      for (let j = 0; j < Math.max(4, v); j++) b += '<i class="' + (j < Math.min(v, 4) ? 'on' : (j < v ? 'over' : '')) + '"></i>';
      return '<span class="dim">' + X(n) + '</span><span class="bar">' + b + '</span>';
    }).join('');
    const faces = (h.faces || []).map(f => '<i style="background:' + (CL[f] ? rgb(CL[f].col) : '#282a36') + '"></i>').join('');
    const kind = h.melee ? X('kind_melee') : X('kind_shooter');
    box.innerHTML =
      '<button class="car-arrow" type="button" aria-label="prev">&lt;</button>' +
      '<div class="car-card">' +
        '<img class="car-face" src="' + h.png + '" alt="' + h.name + '" width="128" height="128">' +
        '<div><div class="car-name">' + h.name + '</div>' +
        '<div class="dim">' + (h.cls && CL[h.cls] ? T(CL[h.cls].name) : X('cls_random')) + ' - ' + kind + '</div>' +
        '<div class="car-desc">' + T(h.desc).replace(/</g, '&lt;') + '</div>' +
        '<div class="traits">' + bars + '</div><div class="faces">' + faces + '</div></div>' +
      '</div>' +
      '<button class="car-arrow" type="button" aria-label="next">&gt;</button>' +
      '<div class="dots" style="grid-column:1/-1">' + heroes.map((x, j) => '<button type="button" class="' + (j === i ? 'on' : '') + '" aria-label="' + x.name + '"></button>').join('') + '</div>';
    const A = box.querySelectorAll('.car-arrow');
    A[0].onclick = () => pick(i - 1); A[1].onclick = () => pick(i + 1);
    box.querySelectorAll('.dots button').forEach((b, j) => { b.onclick = () => pick(j); });
  }
  // a swipe on a phone turns it too
  let sx = null;
  box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => { if (sx == null) return; const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 40) pick(i + (d < 0 ? 1 : -1)); sx = null; });
  pick(i);
})();
