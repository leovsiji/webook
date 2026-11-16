/* ==========================================================
   Webook reader — a real book: content on BOTH pages of a spread.   (static/js/reader.js)
   Used by the editor preview dialog. Same logic as the script inside the
   shared reader.html, so the preview matches what the receiver sees.

   Every Webook page becomes one or two "sides":
     · a text side  (milk, title + words)
     · photo sides  (wine, polaroids, max 3 photos each)
   A page that has photos always starts on a LEFT page and is padded to an even
   number of sides, so its photos are never shown beside another page's words.

     cover │ side 1 · side 2 │ side 3 · side 4 │ … │ The End │ back cover

   A leaf's back is the LEFT page, the next leaf's front is the RIGHT page.
   Phones: bigger spread, no buttons (swipe). Held upright, the whole book is
   turned to the left automatically (.is-rotated) so it is always landscape.
   (Not inside the editor preview dialog, which is never rotated.)

   The flip is a CSS 3D transform; JS only toggles classes.
   ========================================================== */
(() => {
  const root = document.querySelector('[data-reader]');
  if (!root) return;

  const book    = root.querySelector('[data-book]');
  const sources = [...root.querySelectorAll('[data-page-src]')];
  const coverEl = root.querySelector('[data-cover-src]');
  const prevBtn = root.querySelector('[data-prev]');
  const nextBtn = root.querySelector('[data-next]');
  const status  = root.querySelector('[data-status]');
  const dlg     = root.closest('dialog');      // set when used as a preview inside the editor

  /* ---------- phones ----------
     is-phone   : small touch screen -> bigger book, no arrow buttons, swipe to turn
     is-rotated : phone held upright -> the whole book is turned to the left (see CSS) */
  const touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches;
  let rot = false, phone = false;
  function syncDevice() {
    const w = window.innerWidth, h = window.innerHeight;
    root.style.setProperty('--vw', w + 'px');   // real visible size, used by the CSS
    root.style.setProperty('--vh', h + 'px');
    phone = touch && Math.min(w, h) <= 760;
    rot = phone && w < h && !dlg;               // the editor preview is never rotated
    root.classList.toggle('is-phone', phone);
    root.classList.toggle('is-rotated', rot);
    if (!dlg) document.body.classList.toggle('is-locked', rot);
    if (typeof render === 'function' && typeof current === 'number') render();
  }

  /* ---------- cover colour (set per Webook in the editor) ---------- */
  (function applyCover() {
    const c = root.dataset.cover || '';
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) return;               // ignore anything that is not #rrggbb
    const n = parseInt(c.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    root.style.setProperty('--cover-c', c);
    root.style.setProperty('--cover-ink', lum > 0.62 ? '#3a0a12' : '#F4ECEB');   // dark text on pale covers
  })();

  const FLIP_MS = 1100;
  const N = sources.length;

  /* ---------- helpers ---------- */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const part = (src, name) => src.querySelector(`[data-part="${name}"]`);
  const textOf  = (src) => part(src, 'text').textContent.trim();
  const titleOf = (src) => part(src, 'title').textContent.trim();
  const hasPhotos = (src) => { const p = part(src, 'photos'); return !!(p && p.children.length); };
  const MAX_PHOTOS = 3;                     // 3 big polaroids per page; more photos continue on the next page
  const chunkSizes = (n) => {
    const k = Math.ceil(n / MAX_PHOTOS), base = Math.floor(n / k), extra = n % k;
    return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  };
  const photosClone = (d) => {              // d = { src, from, to }
    const c = part(d.src, 'photos').cloneNode(true);
    [...c.children].forEach((f, i) => { if (i < d.from || i >= d.to) f.remove(); });
    c.dataset.count = String(d.to - d.from);
    return c;
  };

  const face = (kind, cls, ...children) => {
    const f = el('div', `face face--${kind} ${cls}`);
    const inner = el('div', 'face__inner');
    children.filter(Boolean).forEach((c) => inner.appendChild(c));
    f.appendChild(inner);
    return f;
  };
  const heartBlock = () => el('div', 'face__inner--center', '<span class="ornament">♥</span>');
  const endBlock = () => el('div', 'face__inner--center',
    '<div><span class="ornament">♥</span><h2>The End</h2></div>');
  const folio = (n, onWine) => {
    const f = el('span', 'folio', String(n));
    if (onWine) f.style.color = 'var(--rose-soft)';
    return f;
  };

  const coverFace = () => {
    const f = el('div', 'face face--front cover');
    f.appendChild(el('div', 'face__inner', coverEl.innerHTML));
    return f;
  };

  /* ---------- the continuous row of sides ---------- */
  const descs = [];
  const filler = () => descs.push({ type: 'blank' });
  sources.forEach((src, i) => {
    const page = i + 1;
    const group = [{ type: 'text', src, page }];
    if (hasPhotos(src)) {
      let from = 0;
      chunkSizes(part(src, 'photos').children.length).forEach((size) => {
        group.push({ type: 'photos', src, page, from, to: from + size });
        from += size;
      });
    }
    if (group.length > 1) {
      if (descs.length % 2 === 1) filler();               // start on a left page
      descs.push(...group);
      if (group.length % 2 === 1) filler();               // keep the next page on a left page
    } else {
      descs.push(group[0]);
    }
  });
  if (descs.length % 2 === 1) filler();                   // keeps "The End" on a left page
  descs.push({ type: 'end', page: N + 1 });
  descs.forEach((d, i) => { d.n = i + 1; });              // printed page number

  function sideFace(d, kind) {
    if (d.type === 'photos') {
      const f = face(kind, 'paper paper--wine', photosClone(d));
      f.firstChild.classList.add('is-collage');
      f.appendChild(folio(d.n, true));
      return f;
    }
    if (d.type === 'text') {
      const t = titleOf(d.src), x = textOf(d.src);
      if (!t && !x) return face(kind, 'paper', heartBlock());        // photos-only page without a title
      const title = t ? el('h2', null, part(d.src, 'title').innerHTML) : null;
      const text = x ? el('div', 'prose', part(d.src, 'text').innerHTML) : null;
      const f = face(kind, 'paper', title, text);
      f.appendChild(folio(d.n));
      return f;
    }
    if (d.type === 'end') return face(kind, 'paper paper--wine', endBlock());
    return face(kind, 'paper', heartBlock());                  // blank filler page
  }

  const labelFor = (list) => {
    const pages = list.filter((d) => d.type === 'photos' || d.type === 'text').map((d) => d.page);
    if (!pages.length) return 'The End';
    const a = Math.min(...pages), b = Math.max(...pages);
    return a === b ? `Page ${a} of ${N}` : `Pages ${a}–${b} of ${N}`;
  };

  /* ---------- build the leaves ---------- */
  const L = Math.floor(descs.length / 2) + 1;      // cover leaf + one per pair of sides
  const leaves = [];
  const labels = ['Cover'];
  for (let k = 0; k < L; k++) {
    const leaf = el('div', 'leaf');
    leaf.appendChild(k === 0 ? coverFace() : sideFace(descs[2 * k - 1], 'front'));
    leaf.appendChild(sideFace(descs[2 * k], 'back'));
    book.appendChild(leaf);
    leaves.push(leaf);
  }
  for (let s = 1; s <= L; s++) {
    labels.push(labelFor([descs[2 * s - 2], descs[2 * s - 1]].filter(Boolean)));
  }

  /* ---------- state ---------- */
  let current = 0;                 // number of leaves already turned (0 = closed, L = The End)
  const restZ = (i) => (i < current ? i + 1 : L - i);

  function render(moved = -1) {
    leaves.forEach((leaf, i) => {
      leaf.classList.toggle('is-flipped', i < current);
      if (i === moved) {
        leaf.style.zIndex = L + 5;                             // the turning leaf stays on top
        clearTimeout(leaf._z);
        leaf._z = setTimeout(() => { leaf.style.zIndex = restZ(i); }, FLIP_MS);
      } else {
        leaf.style.zIndex = restZ(i);
      }
    });
    book.classList.toggle('is-closed-front', current === 0);
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === L;
    status.textContent = (phone && current === 0) ? 'Swipe to open ♥' : (labels[current] || '');
  }

  function go(target) {
    target = Math.max(0, Math.min(L, target));
    if (target === current) return;
    const moved = target > current ? current : target;
    current = target;
    render(moved);
  }

  /* ---------- input ---------- */
  prevBtn.addEventListener('click', () => go(current - 1));
  nextBtn.addEventListener('click', () => go(current + 1));

  document.addEventListener('keydown', (e) => {
    if (dlg && !dlg.open) return;
    if (e.key === 'ArrowRight') go(current + 1);
    if (e.key === 'ArrowLeft')  go(current - 1);
  });

  // click/tap the book: right half forward, left half back
  book.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    if (String(window.getSelection()).length) return;
    if (current === 0) return go(1);
    const r = book.getBoundingClientRect();
    // when the book is turned to the left, its own "x" runs UP the screen
    const x = rot ? (r.bottom - e.clientY) / r.height : (e.clientX - r.left) / r.width;
    go(current + (x > 0.5 ? 1 : -1));
  });

  let touchX = null, touchY = null;
  book.addEventListener('touchstart', (e) => {
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  book.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    const along  = rot ? -dy : dx;     // movement along the book's own x axis (up the screen when turned)
    const across = rot ? dx : dy;
    if (Math.abs(along) > 45 && Math.abs(along) > Math.abs(across) * 1.4) go(current + (along < 0 ? 1 : -1));
  });

  /* ---------- sizing: --u = 1% of book width ---------- */
  const fit = () => book.style.setProperty('--u', `${book.clientWidth / 100}px`);
  new ResizeObserver(fit).observe(book);
  fit();

  // reopening a preview starts from the cover again
  if (dlg) dlg.addEventListener('close', () => { current = 0; render(); });

  syncDevice();
  window.addEventListener('resize', syncDevice);
  window.addEventListener('orientationchange', () => setTimeout(syncDevice, 300));
  book.classList.add('is-ready');
})();


/* ==========================================================
   Cover colour banner (editor page only)
   Click the banner -> pick a colour -> the banner, the preview book and
   the shared Webook all change. Does nothing on pages without the banner.
   ========================================================== */
(() => {
  const banner = document.querySelector('[data-cover-banner]');
  if (!banner) return;

  const toggle   = banner.querySelector('[data-banner-toggle]');
  const picker   = banner.querySelector('.cover-picker');
  const note     = banner.querySelector('[data-picker-note]');
  const custom   = banner.querySelector('[data-custom-color]');
  const swatches = [...banner.querySelectorAll('[data-color]')];
  const preview  = document.querySelector('#preview-dialog [data-reader]');
  const csrf     = banner.querySelector('[name=csrfmiddlewaretoken]').value;
  const HEX = /^#[0-9a-fA-F]{6}$/;

  const inkFor = (c) => {                       // dark text on pale covers
    const n = parseInt(c.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? '#3a0a12' : '#F4ECEB';
  };

  function paint(c) {
    [banner, preview].forEach((n) => {
      if (!n) return;
      n.style.setProperty('--cover-c', c);
      n.style.setProperty('--cover-ink', inkFor(c));
    });
    if (preview) preview.dataset.cover = c;
    custom.value = c.toLowerCase();
    swatches.forEach((s) => s.classList.toggle('is-active', s.dataset.color.toLowerCase() === c.toLowerCase()));
  }

  let timer;
  function save(c) {
    note.textContent = 'Saving…';
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const body = new URLSearchParams({ color: c });
        const r = await fetch(banner.dataset.url, {
          method: 'POST', body, headers: { 'X-CSRFToken': csrf },
        });
        note.textContent = r.ok ? 'Saved ♥ preview and shared Webook updated.' : `Could not save (error ${r.status}). The shared Webook was not changed.`;
      } catch (_) { note.textContent = 'Could not save. Try again.'; }
    }, 300);
  }

  function choose(c) { if (HEX.test(c)) { paint(c); save(c); } }

  const setOpen = (open) => { picker.hidden = !open; toggle.setAttribute('aria-expanded', open); };
  toggle.addEventListener('click', () => setOpen(picker.hidden));
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(picker.hidden); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', (e) => { if (!banner.contains(e.target)) setOpen(false); });

  swatches.forEach((s) => s.addEventListener('click', () => choose(s.dataset.color)));
  custom.addEventListener('input', () => choose(custom.value));

  paint(HEX.test(banner.dataset.cover) ? banner.dataset.cover : '#B76E79');
})();