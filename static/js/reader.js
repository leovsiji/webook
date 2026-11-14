/* ==========================================================
   Webook reader — a real book: content on BOTH pages of a spread.

   Every Webook page becomes one or two "sides":
     · a photo side (wine, polaroids)  — only if the page has photos
     · a text side  (milk, title + words)
   The sides run in one continuous row, like a printed book:

     cover │ side 1 · side 2 │ side 3 · side 4 │ … │ The End │ back cover

   A leaf's back is the LEFT page, the next leaf's front is the RIGHT page.
   Phones: a bigger, wider spread with no buttons (swipe). Held upright, the whole
   book is turned to the left like an open book (.is-rotated in reader.css).

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
     is-rotated : phone held upright -> the whole book is turned to the left (see reader.css) */
  const touch = (navigator.maxTouchPoints || 0) > 0;
  let rot = false, phone = false;
  function syncDevice() {
    const w = window.innerWidth, h = window.innerHeight;
    phone = touch && Math.min(w, h) <= 760;
    rot = phone && w < h;
    root.classList.toggle('is-phone', phone);
    root.classList.toggle('is-rotated', rot);
    if (typeof render === 'function' && typeof current === 'number') render();
  }

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
  const hasPhotos = (src) => { const p = part(src, 'photos'); return !!(p && p.children.length); };
  const photosClone = (src) => part(src, 'photos').cloneNode(true);

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
  sources.forEach((src, i) => {
    const page = i + 1;
    if (hasPhotos(src)) descs.push({ type: 'photos', src, page });
    descs.push({ type: 'text', src, page });
  });
  if (descs.length % 2 === 1) descs.push({ type: 'blank' });   // keeps "The End" on a left page
  descs.push({ type: 'end', page: N + 1 });
  descs.forEach((d, i) => { d.n = i + 1; });                   // printed page number

  function sideFace(d, kind) {
    if (d.type === 'photos') {
      const f = face(kind, 'paper paper--wine', photosClone(d.src));
      f.appendChild(folio(d.n, true));
      return f;
    }
    if (d.type === 'text') {
      const title = el('h2', null, part(d.src, 'title').innerHTML);
      const text = el('div', 'prose', part(d.src, 'text').innerHTML);
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
  window.addEventListener('orientationchange', syncDevice);
  book.classList.add('is-ready');
})();