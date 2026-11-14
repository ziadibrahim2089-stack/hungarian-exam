// Handwriting pad on lined paper. A finger can write too (iPhone, iPad without a Pencil) —
// until the Apple Pencil is used once on this device: from then on only the Pencil (and a
// mouse, for testing) draws, so a resting palm never scribbles.
// Pen pressure → line width. touch-action:none so the page never scrolls while writing.
export function createPad({ height = 220, guide = '', guideMode = 'none' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'pad';
  wrap.style.height = height + 'px';
  const paper = document.createElement('canvas');   // lines + faint word to trace
  const ink = document.createElement('canvas');     // your writing
  paper.className = 'pad-paper';
  ink.className = 'pad-ink';
  ink.setAttribute('aria-label', 'مساحة الكتابة بالقلم');
  wrap.append(paper, ink);

  const strokes = [];
  let current = null;
  let dpr = 1;
  let ignoredTouch = false;

  function size() {
    const w = wrap.clientWidth || 600;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const c of [paper, ink]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(height * dpr);
      c.style.width = w + 'px';
      c.style.height = height + 'px';
    }
    drawPaper();
    redraw();
  }

  function drawPaper() {
    const g = paper.getContext('2d');
    const w = paper.width / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, height);
    const css = getComputedStyle(wrap);
    const line = css.getPropertyValue('--pad-line').trim() || '#b9cbe6';
    const margin = css.getPropertyValue('--pad-margin').trim() || '#e8a3a3';
    const gap = 72;
    const base = height / 2 + 30;
    g.strokeStyle = line;
    g.lineWidth = 1.5;
    for (let y = base % gap; y < height; y += gap) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    g.setLineDash([6, 8]);                            // middle line helps letter height
    g.strokeStyle = line;
    g.globalAlpha = 0.55;
    g.beginPath(); g.moveTo(0, base - 36); g.lineTo(w, base - 36); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.strokeStyle = margin;
    g.beginPath(); g.moveTo(28, 0); g.lineTo(28, height); g.stroke();
    if (guide && guideMode === 'trace') {
      let fs = 74;
      g.font = `500 ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      while (g.measureText(guide).width > w - 70 && fs > 30) { fs -= 4; g.font = `500 ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }
      g.fillStyle = css.getPropertyValue('--pad-guide').trim() || 'rgba(120,120,120,.28)';
      g.textBaseline = 'alphabetic';
      g.direction = 'ltr';
      g.fillText(guide, 44, base - 4);
    }
  }

  function width(p) {
    const pressure = p.t === 'pen' ? (p.p || 0.5) : 0.5;
    return 1.6 + pressure * 4.2;
  }

  function drawSegment(g, a, b) {
    g.lineWidth = (width(a) + width(b)) / 2;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }

  function redraw() {
    const g = ink.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, ink.width, ink.height);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = getComputedStyle(wrap).getPropertyValue('--ink').trim() || '#1d2a57';
    for (const s of strokes) {
      if (s.length === 1) { drawSegment(g, s[0], { ...s[0], x: s[0].x + 0.1 }); continue; }
      for (let i = 1; i < s.length; i++) drawSegment(g, s[i - 1], s[i]);
    }
  }

  const point = (e) => {
    const r = ink.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure, t: e.pointerType };
  };
  let penSeen = false;
  try { penSeen = localStorage.getItem('hkv-pen-seen') === '1'; } catch { /* private mode */ }
  let activeId = null;
  const accepts = (e) => e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && !penSeen);

  ink.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'pen' && !penSeen) {
      penSeen = true;
      try { localStorage.setItem('hkv-pen-seen', '1'); } catch { /* ignore */ }
    }
    if (!accepts(e)) { ignoredTouch = true; wrap.dispatchEvent(new CustomEvent('pad:finger')); return; }
    if (current && activeId !== e.pointerId) return;   // a second finger never draws
    e.preventDefault();
    activeId = e.pointerId;
    try { ink.setPointerCapture(e.pointerId); } catch { /* pointer already gone — keep drawing anyway */ }
    current = [point(e)];
    strokes.push(current);
    redraw();
    wrap.dispatchEvent(new CustomEvent('pad:change'));
  });
  ink.addEventListener('pointermove', (e) => {
    if (!current || !accepts(e) || e.pointerId !== activeId) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const g = ink.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    g.strokeStyle = getComputedStyle(wrap).getPropertyValue('--ink').trim() || '#1d2a57';
    for (const ev of events.length ? events : [e]) {
      const p = point(ev);
      drawSegment(g, current[current.length - 1], p);
      current.push(p);
    }
  });
  const end = (e) => {
    if (!current || (e && e.pointerId !== activeId)) return;
    if (e && accepts(e)) e.preventDefault();
    current = null;
    activeId = null;
    wrap.dispatchEvent(new CustomEvent('pad:change'));
  };
  ink.addEventListener('pointerup', end);
  ink.addEventListener('pointercancel', end);
  ink.addEventListener('pointerleave', end);
  // Stop Safari from scrolling / zooming / selecting while the pencil writes.
  ink.addEventListener('touchstart', (e) => { if (e.touches[0]?.touchType === 'stylus') e.preventDefault(); }, { passive: false });
  ink.addEventListener('touchmove', (e) => { if (e.touches[0]?.touchType === 'stylus') e.preventDefault(); }, { passive: false });

  const ro = new ResizeObserver(() => size());
  ro.observe(wrap);
  requestAnimationFrame(size);

  return {
    el: wrap,
    undo() { strokes.pop(); redraw(); wrap.dispatchEvent(new CustomEvent('pad:change')); },
    clear() { strokes.length = 0; redraw(); wrap.dispatchEvent(new CustomEvent('pad:change')); },
    isEmpty: () => strokes.length === 0,
    strokeCount: () => strokes.length,
    ignoredTouch: () => ignoredTouch,
    setGuide(text, mode) { guide = text; guideMode = mode; drawPaper(); },
    destroy() { ro.disconnect(); },
  };
}
