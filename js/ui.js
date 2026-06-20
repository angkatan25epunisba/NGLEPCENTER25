// ============================================================
// EP CARE CENTER — Core UI Utilities
// Cursor · Particles · Toast · Scroll Reveal · Transitions
// ============================================================

// ── Custom Cursor ── (Disabled: using standard OS cursor)
export function initCursor() {
  // Custom cursor disabled — uses OS default cursor
}

// ── Particles ──
export function initParticles(canvasId = 'particles-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const colors = ['rgba(77,159,255,', 'rgba(0,212,255,', 'rgba(168,85,247,', 'rgba(16,217,134,'];

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x     = Math.random() * W;
      this.y     = Math.random() * H;
      this.r     = Math.random() * 1.5 + 0.3;
      this.vx    = (Math.random() - 0.5) * 0.3;
      this.vy    = -(Math.random() * 0.4 + 0.1);
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.life  = 0;
      this.maxLife = Math.random() * 300 + 200;
    }
    update() {
      this.x    += this.vx;
      this.y    += this.vy;
      this.life++;
      if (this.y < -10 || this.life > this.maxLife) this.reset();
    }
    draw() {
      const fade = Math.min(this.life / 30, 1) * Math.max(1 - (this.life - this.maxLife * 0.7) / (this.maxLife * 0.3), 0);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `${this.color}${this.alpha * fade})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) {
    const p = new Particle();
    p.life = Math.random() * p.maxLife; // stagger
    particles.push(p);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(draw);
  }
  draw();
}

// ── Toast Notifications ──
let toastContainer;

export function initToasts() {
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

export function showToast({ type = 'info', title, message, duration = 4000 }) {
  if (!toastContainer) initToasts();

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] ?? icons.info}</span>
    <div class="toast-content">
      <div class="toast-title">${title ?? type.charAt(0).toUpperCase() + type.slice(1)}</div>
      ${message ? `<div class="toast-desc">${message}</div>` : ''}
    </div>
    <div class="toast-progress"></div>
  `;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });

  const timer = setTimeout(() => dismissToast(toast), duration);
  toast.addEventListener('click', () => { clearTimeout(timer); dismissToast(toast); });
}

function dismissToast(toast) {
  toast.classList.remove('show');
  toast.classList.add('hide');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ── Scroll Reveal ──
export function initScrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ── Navbar Scroll Effect ──
export function initNavScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ── Mobile Nav ──
export function initMobileNav() {
  const burger  = document.querySelector('.nav-hamburger');
  const mobileNav = document.querySelector('.nav-mobile');
  if (!burger || !mobileNav) return;

  burger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    burger.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      burger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ── Loading Screen ──
let _loaderScreen = null;
let _loaderHideTimer = null;

export function initLoader() {
  _loaderScreen = document.getElementById('loading-screen');
  if (!_loaderScreen) return;

  // Always hide after max 4s — never get stuck
  _loaderHideTimer = setTimeout(() => hideLoader(), 4000);

  // Also hide on window load if it fires sooner
  window.addEventListener('load', () => {
    setTimeout(() => hideLoader(), 800);
  });
}

export function hideLoader() {
  if (!_loaderScreen) _loaderScreen = document.getElementById('loading-screen');
  if (!_loaderScreen) return;
  if (_loaderHideTimer) { clearTimeout(_loaderHideTimer); _loaderHideTimer = null; }
  _loaderScreen.classList.add('hidden');
}

// ── Page Transition ──
export function navigateTo(href) {
  const overlay = document.querySelector('.page-transition-overlay');
  if (!overlay) { window.location.href = href; return; }

  overlay.classList.add('enter');
  overlay.addEventListener('transitionend', () => {
    window.location.href = href;
  }, { once: true });
}

// ── Active Nav Link ──
export function setActiveNavLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
    const href = a.getAttribute('href') ?? '';
    const isRoot   = (href === '/' || href === '/index.html' || href === './index.html' || href === '.');
    const isCurrent = isRoot
      ? (path === '/' || path.endsWith('/index.html'))
      : path.includes(href.replace('./', '').replace('.html', ''));
    a.classList.toggle('active', isCurrent);
  });
}

// ── Sidebar Link Switching ──
export function initSidebarNav(sections) {
  // sections: [{ linkId, sectionId }]
  sections.forEach(({ linkId, sectionId }) => {
    const link    = document.getElementById(linkId);
    const section = document.getElementById(sectionId);
    if (!link || !section) return;

    link.addEventListener('click', () => {
      // Hide all sections, deactivate all links
      sections.forEach(({ linkId: l, sectionId: s }) => {
        const el = document.getElementById(l);
        const se = document.getElementById(s);
        if (el) el.classList.remove('active');
        if (se) se.classList.add('hidden');
      });
      link.classList.add('active');
      section.classList.remove('hidden');
    });
  });
}

// ── File Upload Zone ──
export function initFileUpload(zoneId, inputId, onFiles) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    onFiles(Array.from(e.dataTransfer.files));
  });
  input.addEventListener('change', () => onFiles(Array.from(input.files)));
}

// ── Format Timestamp ──
export function formatTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)      return 'Baru saja';
  if (diff < 3600000)    return `${Math.floor(diff/60000)} mnt lalu`;
  if (diff < 86400000)   return `${Math.floor(diff/3600000)} jam lalu`;
  if (diff < 604800000)  return `${Math.floor(diff/86400000)} hari lalu`;
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

// ── Animate Number ──
export function animateNumber(el, target, duration = 1000) {
  let start = 0;
  const step = ts => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Debounce ──
export function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ── Status Config ──
export const STATUS_CONFIG = {
  unread:   { label: 'Belum Dibaca',         class: 'badge-unread',   icon: '⚪', color: 'var(--status-unread)' },
  read:     { label: 'Dibaca',               class: 'badge-read',     icon: '🔵', color: 'var(--status-read)' },
  process:  { label: 'Diproses',             class: 'badge-process',  icon: '🟡', color: 'var(--status-process)' },
  waiting:  { label: 'Menunggu Tindak Lanjut', class: 'badge-waiting', icon: '🟣', color: 'var(--status-waiting)' },
  done:     { label: 'Selesai',              class: 'badge-done',     icon: '🟢', color: 'var(--status-done)' },
  rejected: { label: 'Ditolak',              class: 'badge-rejected', icon: '🔴', color: 'var(--status-rejected)' }
};

export const CATEGORY_CONFIG = {
  academic:    { label: 'Kendala Akademik',    icon: '📚', color: '#4d9fff' },
  lecturer:    { label: 'Kendala Dosen',       icon: '👨‍🏫', color: '#a855f7' },
  curhat:      { label: 'Curhat Perkuliahan',  icon: '💬', color: '#ec4899' },
  consultation:{ label: 'Konsultasi',          icon: '🤝', color: '#10d986' },
  suggestion:  { label: 'Saran',               icon: '💡', color: '#f59e0b' },
  complaint:   { label: 'Keluhan',             icon: '😔', color: '#ef4444' },
  aspiration:  { label: 'Aspirasi',            icon: '🚀', color: '#00d4ff' },
  other:       { label: 'Lainnya',             icon: '📌', color: '#6b7280' }
};

export const URGENCY_CONFIG = {
  low:      { label: 'Rendah',   color: 'var(--neon-green)', icon: '🟢' },
  medium:   { label: 'Sedang',   color: 'var(--neon-amber)', icon: '🟡' },
  high:     { label: 'Tinggi',   color: 'var(--neon-red)',   icon: '🔴' },
  critical: { label: 'Kritis',   color: 'var(--neon-pink)',  icon: '🚨' }
};
