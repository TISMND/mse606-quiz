const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function pulse(kind) {
  const v = document.getElementById('vignette');
  if (!v) return;
  v.className = '';
  void v.offsetWidth; // restart the animation
  v.className = kind;
  if (reduced()) setTimeout(() => { v.className = ''; }, 500);
}

export function shake(el) {
  if (!el || reduced()) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

const COLORS = ['#7cf7c5', '#2fd98a', '#ffe66d', '#8be9ff', '#ffffff'];

export function sparks(x, y, n = 28) {
  if (reduced()) return;
  for (let k = 0; k < n; k++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = 70 + Math.random() * 90;
    const c = COLORS[k % COLORS.length];
    s.style.cssText = `left:${x}px;top:${y}px;background:${c};box-shadow:0 0 8px ${c};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}
