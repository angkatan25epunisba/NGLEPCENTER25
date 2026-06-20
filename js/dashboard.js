// ============================================================
// EP CARE CENTER — Dashboard Logic (v3 — fully fixed)
// ============================================================
import {
  auth, db,
  ROLES, hasAdminAccess, isPrivileged,
  signInWithGoogle, signOutUser, getCurrentUserData,
  onAuthStateChanged,
  doc, setDoc, getDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, getDocs, writeBatch, increment, arrayUnion,
} from '../js/firebase.js';

import {
  initCursor, initParticles, initToasts, initScrollReveal,
  initNavScroll, initMobileNav, initLoader, hideLoader, showToast,
  formatTime, animateNumber, debounce,
  STATUS_CONFIG, CATEGORY_CONFIG, URGENCY_CONFIG
} from '../js/ui.js';

initCursor(); initParticles(); initToasts(); initScrollReveal();
initNavScroll(); initMobileNav(); initLoader();

// ── Global State ──
let currentUser     = null;
let currentRole     = ROLES.MAHASISWA;
let allMyReports    = [];
let allAdminReports = [];
let uploadedFiles   = [];
let activeSection   = 'overview';
let activeReportId  = null;
let unsubMyReports, unsubAdminReports, unsubNotifs;

const ROLE_LABEL = {
  mahasiswa: 'Mahasiswa',
  admin:     'Admin',
  dosen:     'Dosen',
  founder:   'Founder',
  developer: 'Developer'
};

// ── Auth State ──
onAuthStateChanged(auth, async user => {
  hideLoader();

  if (!user) {
    document.getElementById('auth-guard').classList.remove('hidden');
    document.getElementById('auth-guard').style.display = 'flex';
    document.getElementById('dashboard-main').classList.add('hidden');
    return;
  }

  const data = await getCurrentUserData();
  if (!data) {
    document.getElementById('auth-guard').classList.remove('hidden');
    document.getElementById('auth-guard').style.display = 'flex';
    document.getElementById('dashboard-main').classList.add('hidden');
    return;
  }

  currentUser = data;
  currentRole = data.role;

  document.getElementById('auth-guard').classList.add('hidden');
  document.getElementById('auth-guard').style.display = 'none';
  document.getElementById('dashboard-main').classList.remove('hidden');

  // Nav
  document.getElementById('nav-user-info').style.display = 'flex';
  document.getElementById('nav-avatar').src = user.photoURL || '';
  document.getElementById('nav-username').textContent = user.displayName?.split(' ')[0] || 'Pengguna';

  // Sidebar
  document.getElementById('sidebar-avatar').src = user.photoURL || '';
  document.getElementById('sidebar-name').textContent = user.displayName || 'Pengguna';
  document.getElementById('sidebar-role').textContent = ROLE_LABEL[currentRole] || 'Mahasiswa';
  document.getElementById('welcome-title').textContent = `Halo, ${user.displayName?.split(' ')[0]} 👋`;

  // Profile
  document.getElementById('profile-photo').src = user.photoURL || '';
  document.getElementById('profile-name').textContent  = user.displayName || '';
  document.getElementById('profile-email').textContent = user.email || '';
  document.getElementById('profile-role-badge').textContent = ROLE_LABEL[currentRole] || 'Mahasiswa';
  document.getElementById('profile-joined').textContent =
    data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('id-ID', { year:'numeric', month:'long', day:'numeric' }) : '—';

  if (hasAdminAccess(currentRole)) {
    document.getElementById('admin-nav').classList.remove('hidden');
  }

  subscribeMyReports();
  subscribeNotifications();
  if (hasAdminAccess(currentRole)) {
    subscribeAdminReports();
    loadAdminStats();
  }
});

// ── Logout ──
document.getElementById('nav-logout-btn')?.addEventListener('click', async () => {
  await signOutUser();
  window.location.href = '../index.html';
});
document.getElementById('guard-login-btn')?.addEventListener('click', async () => {
  const res = await signInWithGoogle();
  if (res.success) window.location.reload();
  else showToast({ type:'error', title:'Gagal Login', message: res.error });
});

// ── Section Switcher ──
window.switchSection = function(name) {
  activeSection = name;
  document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.remove('hidden');
  document.getElementById(`link-${name}`)?.classList.add('active');
  if (name === 'gallery-mgmt') loadGalleryMgmt();
  if (name === 'users') loadUsersTable();
  if (name === 'admin-dash') loadAdminStats();
};

// ── Realtime: My Reports (no composite index needed) ──
function subscribeMyReports() {
  if (!currentUser) return;

  // Show loading state
  const wrap = document.getElementById('my-reports-list');
  if (wrap) wrap.innerHTML = `
    <div class="skeleton" style="height:120px;border-radius:var(--r-lg)"></div>
    <div class="skeleton" style="height:120px;border-radius:var(--r-lg)"></div>
    <div class="skeleton" style="height:120px;border-radius:var(--r-lg)"></div>`;

  const q = query(collection(db, 'reports'), where('uid', '==', currentUser.uid));
  unsubMyReports = onSnapshot(q, snap => {
    allMyReports = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    updateStudentStats();
    renderMyReports(allMyReports);
    renderRecentReports(allMyReports.slice(0, 3));
  }, err => {
    console.warn('subscribeMyReports:', err.message);
    const w = document.getElementById('my-reports-list');
    if (w) w.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Gagal memuat laporan</div><div class="empty-desc">${err.message}</div></div>`;
  });
}

// ── Realtime: Admin Reports ──
function subscribeAdminReports() {
  if (!hasAdminAccess(currentRole)) return;
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
  unsubAdminReports = onSnapshot(q, snap => {
    allAdminReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminReports(allAdminReports);
    updateAdminBadge();
  }, err => console.warn('subscribeAdminReports:', err.message));
}

// ── Realtime: Notifications (single where, no composite index) ──
function subscribeNotifications() {
  if (!currentUser) return;
  const q = query(collection(db, 'notifications'), where('uid', '==', currentUser.uid), limit(50));
  unsubNotifs = onSnapshot(q, snap => {
    const unread = snap.docs.filter(d => d.data().read === false).length;
    const countEl = document.getElementById('nav-notif-count');
    if (countEl) { countEl.textContent = unread; countEl.classList.toggle('hidden', unread === 0); }
  }, err => console.warn('subscribeNotifications:', err.message));
}

// ── Stats: Student ──
function updateStudentStats() {
  const total  = allMyReports.length;
  const active = allMyReports.filter(r => ['read','process','waiting'].includes(r.status)).length;
  const done   = allMyReports.filter(r => r.status === 'done').length;
  const unread = allMyReports.filter(r => r.status === 'unread').length;

  animateNumber(document.getElementById('stat-total'),  total);
  animateNumber(document.getElementById('stat-active'), active);
  animateNumber(document.getElementById('stat-done'),   done);
  animateNumber(document.getElementById('stat-unread'), unread);

  animateNumber(document.getElementById('ps-total'),  total,  600);
  animateNumber(document.getElementById('ps-done'),   done,   600);
  animateNumber(document.getElementById('ps-active'), active, 600);

  const badge = document.getElementById('badge-unread');
  if (badge) { badge.textContent = unread; badge.classList.toggle('hidden', unread === 0); }
}

function updateAdminBadge() {
  const unread = allAdminReports.filter(r => r.status === 'unread').length;
  const badge  = document.getElementById('badge-admin-unread');
  if (badge) { badge.textContent = unread; badge.classList.toggle('hidden', unread === 0); }
}

// ── Stats: Admin (real data from Firestore) ──
async function loadAdminStats() {
  try {
    const [usersSnap, reportsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'reports'))
    ]);

    const users   = usersSnap.docs.map(d => d.data());
    const reports = reportsSnap.docs.map(d => d.data());

    const mahasiswaCount = users.filter(u => u.role === 'mahasiswa').length;
    const totalReports   = reports.length;
    const activeReports  = reports.filter(r => ['read','process','waiting'].includes(r.status)).length;
    const doneReports    = reports.filter(r => r.status === 'done').length;
    const responseRate   = totalReports > 0 ? Math.round((doneReports / totalReports) * 100) : 0;

    animateNumber(document.getElementById('admin-stat-users'),   mahasiswaCount);
    animateNumber(document.getElementById('admin-stat-reports'), totalReports);
    animateNumber(document.getElementById('admin-stat-active'),  activeReports);
    animateNumber(document.getElementById('admin-stat-done'),    doneReports);

    renderCategoryChart(reports);
    renderUrgencyChart(reports);

    // Update beranda hero stats dengan data nyata
    updateHeroStats(totalReports, doneReports, mahasiswaCount, responseRate);
  } catch(err) {
    console.warn('loadAdminStats:', err.message);
  }
}

// Update hero stats di beranda — simpan ke Firestore public collection & sessionStorage
async function updateHeroStats(total, done, mahasiswa, responseRate) {
  try {
    // Simpan ke sessionStorage supaya index.html bisa baca saat sudah login
    sessionStorage.setItem('epcc_stats', JSON.stringify({ total, done, mahasiswa, responseRate, ts: Date.now() }));
    // Simpan ke Firestore public stats (bisa dibaca siapa saja, termasuk tamu)
    await setDoc(doc(db, 'settings', 'public_stats'), {
      total, done, mahasiswa, responseRate, updatedAt: serverTimestamp()
    }, { merge: true });
  } catch(e) { console.warn('updateHeroStats write failed:', e.message); }
}

function renderCategoryChart(reports) {
  const wrap = document.getElementById('chart-category');
  if (!wrap) return;
  if (!reports.length) {
    wrap.innerHTML = '<div class="text-dim text-sm">Belum ada laporan.</div>';
    return;
  }
  const counts = {};
  reports.forEach(r => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);
  wrap.innerHTML = Object.entries(counts)
    .sort(([,a],[,b]) => b - a)
    .map(([cat, count]) => {
      const cfg = CATEGORY_CONFIG[cat] || { label: cat, color: '#6b7280', icon: '📌' };
      const pct = Math.round((count / max) * 100);
      return `
        <div class="chart-bar-item">
          <div class="chart-bar-label">
            <span>${cfg.icon} ${cfg.label}</span>
            <span>${count}</span>
          </div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%;background:${cfg.color}"></div>
          </div>
        </div>`;
    }).join('');
}

function renderUrgencyChart(reports) {
  const wrap = document.getElementById('chart-urgency');
  if (!wrap) return;
  if (!reports.length) {
    wrap.innerHTML = '<div class="text-dim text-sm">Belum ada laporan.</div>';
    return;
  }
  const counts = {};
  reports.forEach(r => { if (r.urgency) counts[r.urgency] = (counts[r.urgency] || 0) + 1; });
  const max = Math.max(...Object.values(counts), 1);
  wrap.innerHTML = Object.entries(counts)
    .sort(([,a],[,b]) => b - a)
    .map(([urg, count]) => {
      const cfg = URGENCY_CONFIG[urg] || { label: urg, color: '#6b7280', icon: '⚪' };
      const pct = Math.round((count / max) * 100);
      return `
        <div class="chart-bar-item">
          <div class="chart-bar-label">
            <span>${cfg.icon} ${cfg.label}</span>
            <span>${count}</span>
          </div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%;background:${cfg.color}"></div>
          </div>
        </div>`;
    }).join('');
}

// ── Render: My Reports ──
function renderMyReports(reports, filter = 'all', search = '') {
  const wrap = document.getElementById('my-reports-list');
  if (!wrap) return;
  let filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }
  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Tidak ada laporan</div><div class="empty-desc">Coba ubah filter atau kata kunci.</div></div>`;
    return;
  }
  wrap.innerHTML = filtered.map(r => `
    <div class="card report-card" onclick="openReportDetail('${r.id}', false)" style="cursor:pointer">
      <div class="report-meta">
        ${badgeHTML(r.status)}
        <span class="report-category">${CATEGORY_CONFIG[r.category]?.icon || '📌'} ${CATEGORY_CONFIG[r.category]?.label || r.category}</span>
        <span class="badge" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4)">${URGENCY_CONFIG[r.urgency]?.icon || ''} ${URGENCY_CONFIG[r.urgency]?.label || r.urgency}</span>
      </div>
      <div class="report-title">${r.title}</div>
      <div class="report-preview">${r.description}</div>
      ${r.userNote ? `<div class="user-note text-sm">💬 Catatan Admin: ${r.userNote}</div>` : ''}
      <div class="report-footer">
        <span class="report-time">${formatTime(r.createdAt)}</span>
        <span class="text-xs text-dim">ID: ${r.id.slice(0,8).toUpperCase()}</span>
      </div>
    </div>
  `).join('');
}

function renderRecentReports(reports) {
  const wrap = document.getElementById('recent-reports-list');
  if (!wrap) return;
  if (!reports.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Belum ada laporan</div><div class="empty-desc">Buat laporan pertamamu.</div></div>`;
    return;
  }
  wrap.innerHTML = reports.map(r => `
    <div class="card report-card" onclick="openReportDetail('${r.id}', false)" style="cursor:pointer;margin-bottom:12px">
      <div class="report-meta">${badgeHTML(r.status)}<span class="report-category">${CATEGORY_CONFIG[r.category]?.icon || '📌'} ${CATEGORY_CONFIG[r.category]?.label || r.category}</span></div>
      <div class="report-title mt-2">${r.title}</div>
      <div class="report-footer mt-2"><span class="report-time">${formatTime(r.createdAt)}</span></div>
    </div>`).join('');
}

// ── Render: Admin Reports ──
function renderAdminReports(reports, filter = 'all', search = '') {
  const wrap = document.getElementById('admin-reports-list');
  if (!wrap) return;
  let filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r =>
      r.title?.toLowerCase().includes(q) || r.displayName?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }
  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Tidak ada laporan</div></div>`;
    return;
  }
  wrap.innerHTML = filtered.map(r => `
    <div class="card report-card" style="cursor:pointer">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div style="flex:1">
          <div class="report-meta mb-2">
            ${badgeHTML(r.status)}
            ${!r.seenAdmin ? `<span class="badge badge-unread" style="font-size:0.6rem">🔴 BARU</span>` : ''}
            <span class="report-category">${CATEGORY_CONFIG[r.category]?.icon || '📌'} ${CATEGORY_CONFIG[r.category]?.label || r.category}</span>
          </div>
          <div class="report-title mb-1">${r.title}</div>
          <div class="report-preview mb-2">${r.description}</div>
          <div class="flex gap-4 items-center flex-wrap">
            <span class="text-xs text-dim">👤 ${r.isAnonymous ? 'Anonim' : r.displayName}</span>
            <span class="text-xs text-dim">📧 ${r.isAnonymous ? '***' : r.email}</span>
            <span class="report-time">${formatTime(r.createdAt)}</span>
            <span class="badge" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4)">${URGENCY_CONFIG[r.urgency]?.icon || ''} ${URGENCY_CONFIG[r.urgency]?.label || r.urgency}</span>
          </div>
        </div>
        <div class="flex gap-2 flex-wrap flex-col" style="min-width:160px;align-items:flex-end">
          <button class="btn btn-primary btn-sm" onclick="openReportDetail('${r.id}', true)">Lihat Detail</button>
          <button class="btn btn-ghost btn-sm" onclick="openActionModal('${r.id}')">Update Status</button>
        </div>
      </div>
    </div>
  `).join('');
}

function badgeHTML(status) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unread;
  return `<span class="badge ${cfg.class}">${cfg.label}</span>`;
}

// ── Open Report Detail Modal ──
window.openReportDetail = async function(reportId, isAdmin) {
  const reportRef = doc(db, 'reports', reportId);
  const snap = await getDoc(reportRef);
  if (!snap.exists()) return;
  const r = { id: snap.id, ...snap.data() };

  if (isAdmin && !r.seenAdmin) {
    await updateDoc(reportRef, { seenAdmin: true, status: r.status === 'unread' ? 'read' : r.status });
  }
  if (!isAdmin && !r.seenUser && r.status !== 'unread') {
    await updateDoc(reportRef, { seenUser: true });
  }

  const cfg    = STATUS_CONFIG[r.status] || STATUS_CONFIG.unread;
  const catCfg = CATEGORY_CONFIG[r.category] || { label: r.category, icon: '📌' };

  document.getElementById('modal-title').textContent = r.title;
  document.getElementById('modal-body').innerHTML = `
    <div class="flex gap-3 flex-wrap mb-2">
      <span class="badge ${cfg.class}">${cfg.label}</span>
      <span class="badge" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6)">${catCfg.icon} ${catCfg.label}</span>
      <span class="badge" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6)">${URGENCY_CONFIG[r.urgency]?.icon || ''} ${URGENCY_CONFIG[r.urgency]?.label}</span>
    </div>
    ${isAdmin ? `<div class="text-sm text-muted mb-4">Dari: ${r.isAnonymous ? 'Anonim' : `${r.displayName} (${r.email})`} · ${formatTime(r.createdAt)}</div>` : ''}
    <h4 class="text-sm font-ui mb-2" style="color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;font-size:0.72rem">Deskripsi</h4>
    <p class="text-sm" style="color:rgba(255,255,255,0.8);line-height:1.7;margin-bottom:20px">${r.description}</p>
    ${(r.attachments?.length || r.fileURLs?.length) ? `
      <h4 class="text-sm font-ui mb-2" style="color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;font-size:0.72rem">Lampiran</h4>
      <div class="flex gap-2 flex-wrap mb-4">
        ${(r.attachments||[]).map(att => `<a href="${att.data}" download="${att.name}" class="btn btn-ghost btn-sm">📎 ${att.name}</a>`).join('')}
        ${(r.fileURLs||[]).map((url,i) => `<a href="${url}" target="_blank" class="btn btn-ghost btn-sm">📎 Lampiran ${i+1}</a>`).join('')}
      </div>` : ''}
    ${renderMessageThread(r)}
    ${isAdmin && r.internalNote ? `<div class="internal-note mb-4"><strong class="text-xs" style="color:var(--neon-amber)">🔒 Catatan Internal:</strong><br/>${r.internalNote}</div>` : ''}
    ${!isAdmin ? renderReplyBox(r) : ''}
    <h4 class="text-sm font-ui mb-3 mt-2" style="color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;font-size:0.72rem">Riwayat Status</h4>
    <div class="timeline">
      ${(r.history || [{ status: r.status, timestamp: r.createdAt, note: 'Laporan dibuat' }]).map(h => `
        <div class="timeline-item">
          <div class="timeline-dot done"></div>
          <div class="timeline-content">
            <div class="timeline-title">${STATUS_CONFIG[h.status]?.label || h.status}</div>
            ${h.note ? `<div class="timeline-desc">${h.note}</div>` : ''}
            <div class="timeline-time">${formatTime(h.timestamp)}</div>
          </div>
        </div>`).join('')}
    </div>`;

  document.getElementById('modal-footer').innerHTML = isAdmin ? `
    <button class="btn btn-ghost" onclick="closeModal('report-modal')">Tutup</button>
    <button class="btn btn-primary" onclick="closeModal('report-modal'); openActionModal('${r.id}')">Update Status</button>
  ` : `<button class="btn btn-ghost" onclick="closeModal('report-modal')">Tutup</button>`;

  document.getElementById('report-modal').classList.add('open');
};

// ── Render: Message Thread (percakapan laporan) ──
function renderMessageThread(r) {
  const msgs = (r.messages && r.messages.length)
    ? r.messages
    : (r.userNote ? [{ sender: 'admin', senderName: 'Admin', text: r.userNote, timestamp: r.updatedAt }] : []);

  if (!msgs.length) return '';

  return `
    <h4 class="text-sm font-ui mb-2" style="color:rgba(255,255,255,0.5);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;font-size:0.72rem">💬 Percakapan</h4>
    <div class="message-thread mb-4">
      ${msgs.map(m => `
        <div class="message-bubble message-${m.sender === 'admin' ? 'admin' : 'user'}">
          <div class="message-bubble-head">
            <strong>${m.sender === 'admin' ? '🛡️ Admin / Dosen' : (m.senderName || 'Kamu')}</strong>
            <span class="message-time">${formatTime(m.timestamp)}</span>
          </div>
          <div class="message-text">${m.text}</div>
        </div>
      `).join('')}
    </div>`;
}

// ── Render: Reply Box (mahasiswa balas pesan pada laporan yang sama) ──
function renderReplyBox(r) {
  if (['done', 'rejected'].includes(r.status)) {
    return `<div class="reply-locked text-xs mb-4">🔒 Laporan ini sudah ditutup (${STATUS_CONFIG[r.status]?.label || r.status}). Buat laporan baru jika ada hal lain yang ingin disampaikan.</div>`;
  }

  const msgs = r.messages || [];
  const last = msgs[msgs.length - 1];
  const waitingForAdmin = last && last.sender === 'user' && !r.seenAdmin;

  if (waitingForAdmin) {
    return `<div class="reply-locked text-xs mb-4">⏳ Pesanmu sudah terkirim. Tunggu sampai dibalas atau dibaca oleh admin/dosen sebelum mengirim pesan lagi.</div>`;
  }

  return `
    <div class="reply-box mb-4">
      <textarea class="form-textarea" id="student-reply-text" rows="2" placeholder="Tulis balasan untuk admin/dosen pada laporan ini..."></textarea>
      <button class="btn btn-primary btn-sm mt-2" id="student-reply-btn" onclick="sendStudentReply('${r.id}')">Kirim Balasan</button>
    </div>`;
}

// ── Send Student Reply (lanjutan percakapan, tanpa buat laporan baru) ──
window.sendStudentReply = async function(reportId) {
  const textarea = document.getElementById('student-reply-text');
  const text = textarea?.value.trim();
  if (!text) { showToast({ type:'warning', title:'Pesan Kosong', message:'Tulis pesan balasan terlebih dahulu.' }); return; }

  const btn = document.getElementById('student-reply-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

  try {
    const reportRef = doc(db, 'reports', reportId);
    const snap = await getDoc(reportRef);
    if (!snap.exists()) throw new Error('Laporan tidak ditemukan.');
    const r = snap.data();

    if (['done', 'rejected'].includes(r.status)) {
      showToast({ type:'warning', title:'Laporan Sudah Ditutup', message:'Buat laporan baru jika ada hal lain yang ingin disampaikan.' });
      return;
    }
    const msgs = r.messages || [];
    const last = msgs[msgs.length - 1];
    if (last && last.sender === 'user' && !r.seenAdmin) {
      showToast({ type:'warning', title:'Menunggu Balasan', message:'Tunggu sampai dibalas atau dibaca oleh admin/dosen.' });
      return;
    }

    const newMsg = {
      sender: 'user',
      senderName: currentUser?.displayName || 'Mahasiswa',
      text,
      timestamp: new Date().toISOString()
    };

    await updateDoc(reportRef, {
      messages:  arrayUnion(newMsg),
      seenAdmin: false,
      updatedAt: serverTimestamp()
    });

    try {
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin','dosen','founder','developer'])));
      const batch = writeBatch(db);
      adminSnap.docs.forEach(adminDoc => {
        batch.set(doc(collection(db, 'notifications')), {
          uid: adminDoc.id, type: 'reply',
          title: `Balasan Baru: ${r.title}`,
          message: `${currentUser?.displayName || 'Mahasiswa'} membalas laporan ini.`,
          reportId, read: false, createdAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch(e) { console.warn('Notify staff (reply) failed:', e.message); }

    showToast({ type:'success', title:'Balasan Terkirim', message:'Pesanmu sudah dikirim ke admin/dosen.' });
    closeModal('report-modal');
  } catch (err) {
    console.error('sendStudentReply error:', err);
    showToast({ type:'error', title:'Gagal Mengirim', message: err.message });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Kirim Balasan'; }
  }
};

// ── Action Modal (Update Status & Kirim Balasan) ──
window.openActionModal = function(reportId) {
  activeReportId = reportId;
  document.getElementById('action-modal').classList.add('open');
};

document.getElementById('action-confirm-btn')?.addEventListener('click', async () => {
  if (!activeReportId) return;
  const status       = document.getElementById('action-status').value;
  const userNote     = document.getElementById('action-user-note').value.trim();
  const internalNote = document.getElementById('action-internal-note').value.trim();

  const btn = document.getElementById('action-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const reportRef = doc(db, 'reports', activeReportId);
    const snap      = await getDoc(reportRef);
    if (!snap.exists()) throw new Error('Laporan tidak ditemukan.');
    const r = snap.data();

    // FIX: history entry pakai ISO string, BUKAN serverTimestamp() di dalam array
    const historyEntry = {
      status,
      timestamp: new Date().toISOString(),
      note: userNote || `Status diubah ke ${STATUS_CONFIG[status]?.label || status}`
    };

    const updatePayload = {
      status,
      seenUser:  false,
      seenAdmin: true,
      updatedAt: serverTimestamp(),
      history:   [...(r.history || []), historyEntry]
    };
    if (userNote)     updatePayload.userNote     = userNote;
    if (internalNote) updatePayload.internalNote = internalNote;
    if (userNote) {
      updatePayload.messages = arrayUnion({
        sender: 'admin',
        senderName: currentUser?.displayName || 'Admin',
        text: userNote,
        timestamp: new Date().toISOString()
      });
    }

    await updateDoc(reportRef, updatePayload);

    // Jaga agar counter "Sudah Selesai" di beranda tetap akurat
    const wasDone   = r.status === 'done';
    const isDoneNow = status === 'done';
    if (wasDone !== isDoneNow) {
      try {
        await setDoc(doc(db, 'settings', 'public_stats'), {
          done: increment(isDoneNow ? 1 : -1), updatedAt: serverTimestamp()
        }, { merge: true });
      } catch(e) { console.warn('public_stats done update failed:', e.message); }
    }

    // Kirim notifikasi ke mahasiswa
    if (r.uid) {
      await addDoc(collection(db, 'notifications'), {
        uid:      r.uid,
        type:     'status_update',
        title:    `Laporan "${r.title}" diperbarui`,
        message:  `Status berubah: ${STATUS_CONFIG[status]?.label || status}${userNote ? `. Catatan: ${userNote}` : ''}`,
        reportId: activeReportId,
        read:     false,
        createdAt: serverTimestamp()
      });
    }

    closeModal('action-modal');
    showToast({ type:'success', title:'Berhasil Diperbarui', message:`Status laporan → ${STATUS_CONFIG[status]?.label || status}` });
    document.getElementById('action-user-note').value     = '';
    document.getElementById('action-internal-note').value = '';
  } catch (err) {
    console.error('updateDoc error:', err);
    showToast({ type:'error', title:'Gagal Update', message: err.message });
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Simpan Update';
  }
});

// ── Modal Utils ──
window.closeModal = function(id) {
  document.getElementById(id)?.classList.remove('open');
};
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ── Report Form ──
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('report-category').value = btn.dataset.cat;
  });
});
document.querySelectorAll('.urgency-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.urgency-option').forEach(b => b.className = 'urgency-option');
    btn.classList.add(`selected-${btn.dataset.urg}`);
    document.getElementById('report-urgency').value = btn.dataset.urg;
  });
});

// File Upload
const uploadZone = document.getElementById('upload-zone');
const fileInput  = document.getElementById('report-files');
uploadZone?.addEventListener('click', () => fileInput.click());
uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone?.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(Array.from(e.dataTransfer.files)); });
fileInput?.addEventListener('change', () => handleFiles(Array.from(fileInput.files)));

function handleFiles(files) {
  uploadedFiles = [...uploadedFiles, ...files].slice(0, 5);
  renderFilePreview();
}
function renderFilePreview() {
  const wrap = document.getElementById('file-preview');
  if (!wrap) return;
  wrap.innerHTML = uploadedFiles.map((f, i) => `
    <div class="file-tag">📎 ${f.name} <span class="text-dim">(${(f.size/1024/1024).toFixed(1)}MB)</span>
      <button onclick="removeFile(${i})" class="file-tag-remove">✕</button>
    </div>`).join('');
}
window.removeFile = function(i) { uploadedFiles.splice(i, 1); renderFilePreview(); };

// Submit Report
window.submitReport = async function(e) {
  e.preventDefault();
  if (!currentUser) return showToast({ type:'error', title:'Belum Login' });
  const cat   = document.getElementById('report-category').value;
  const title = document.getElementById('report-title').value.trim();
  const desc  = document.getElementById('report-desc').value.trim();
  const urg   = document.getElementById('report-urgency').value;
  const anon  = document.getElementById('report-anonymous').checked;

  if (!cat || !title || !desc || !urg) {
    return showToast({ type:'warning', title:'Form Belum Lengkap', message:'Isi semua field yang wajib.' });
  }

  const btn = document.getElementById('submit-report-btn');
  btn.disabled = true;
  document.getElementById('submit-text').classList.add('hidden');
  document.getElementById('submit-spinner').classList.remove('hidden');

  const timeout = setTimeout(() => {
    showToast({ type:'error', title:'Timeout', message:'Koneksi lambat. Coba lagi.' });
    btn.disabled = false;
    document.getElementById('submit-text').classList.remove('hidden');
    document.getElementById('submit-spinner').classList.add('hidden');
  }, 20000);

  try {
    const attachments = [];
    for (const file of uploadedFiles) {
      if (file.size > 5 * 1024 * 1024) { showToast({ type:'warning', title:'File Dilewati', message:`${file.name} > 5MB.` }); continue; }
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result);
        reader.onerror = () => rej(new Error('Gagal baca file'));
        reader.readAsDataURL(file);
      });
      attachments.push({ name: file.name, size: file.size, type: file.type, data: base64 });
    }

    const reportData = {
      uid:         currentUser.uid,
      displayName: anon ? 'Anonim' : (currentUser.displayName || ''),
      email:       anon ? '' : (currentUser.email || ''),
      photoURL:    anon ? '' : (currentUser.photoURL || ''),
      isAnonymous: anon, category: cat, title, description: desc, urgency: urg,
      attachments, fileURLs: [],
      status: 'unread', seenAdmin: false, seenUser: false,
      history: [{ status:'unread', timestamp: new Date().toISOString(), note:'Laporan dibuat' }],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };

    let reportRef;
    try {
      reportRef = await addDoc(collection(db, 'reports'), reportData);
    } catch(sizeErr) {
      showToast({ type:'warning', title:'Lampiran Dilewati', message:'File terlalu besar, laporan dikirim tanpa lampiran.' });
      reportData.attachments = [];
      reportRef = await addDoc(collection(db, 'reports'), reportData);
    }

    try { await updateDoc(doc(db, 'users', currentUser.uid), { reportCount: increment(1) }); } catch(e) {}
    try {
      await setDoc(doc(db, 'settings', 'public_stats'), {
        total: increment(1), updatedAt: serverTimestamp()
      }, { merge: true });
    } catch(e) { console.warn('public_stats total increment failed:', e.message); }
    try {
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin','dosen','founder','developer'])));
      const batch = writeBatch(db);
      adminSnap.docs.forEach(adminDoc => {
        batch.set(doc(collection(db, 'notifications')), {
          uid: adminDoc.id, type: 'new_report',
          title: `Laporan Baru: ${title}`,
          message: `${anon ? 'Anonim' : currentUser.displayName} — ${CATEGORY_CONFIG[cat]?.label || cat}`,
          reportId: reportRef.id, read: false, createdAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch(e) { console.warn('Notify admins failed (non-fatal):', e.message); }

    showToast({ type:'success', title:'Laporan Terkirim!', message:'Laporanmu berhasil dikirim.' });
    resetReportForm();
    switchSection('my-reports');
  } catch (err) {
    console.error(err);
    let msg = err.message;
    if (err.code === 'permission-denied') msg = 'Akses ditolak. Pastikan sudah login dengan benar.';
    showToast({ type:'error', title:'Gagal Mengirim', message: msg });
  } finally {
    clearTimeout(timeout);
    btn.disabled = false;
    document.getElementById('submit-text').classList.remove('hidden');
    document.getElementById('submit-spinner').classList.add('hidden');
  }
};

window.resetReportForm = function() {
  document.getElementById('report-form')?.reset();
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.urgency-option').forEach(b => b.className = 'urgency-option');
  document.getElementById('report-category').value = '';
  document.getElementById('report-urgency').value  = '';
  uploadedFiles = [];
  renderFilePreview();
};

// ── Filter & Search ──
let currentMyFilter   = 'all';
let currentAdminFilter = 'all';
const mySearch    = debounce(q => renderMyReports(allMyReports, currentMyFilter, q), 300);
const adminSearch = debounce(q => renderAdminReports(allAdminReports, currentAdminFilter, q), 300);
document.getElementById('my-reports-search')?.addEventListener('input', e => mySearch(e.target.value));
document.getElementById('admin-search')?.addEventListener('input', e => adminSearch(e.target.value));
document.querySelectorAll('#my-reports-filter .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#my-reports-filter .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active'); currentMyFilter = pill.dataset.filter;
    renderMyReports(allMyReports, currentMyFilter, document.getElementById('my-reports-search')?.value || '');
  });
});
document.querySelectorAll('#admin-filter .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#admin-filter .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active'); currentAdminFilter = pill.dataset.filter;
    renderAdminReports(allAdminReports, currentAdminFilter, document.getElementById('admin-search')?.value || '');
  });
});

// ── Gallery Upload (Admin/Dosen/Founder/Developer) ──
const galleryZone  = document.getElementById('gallery-upload-zone');
const galleryInput = document.getElementById('gallery-files');

galleryZone?.addEventListener('click', () => galleryInput?.click());
galleryZone?.addEventListener('dragover', e => { e.preventDefault(); galleryZone.classList.add('drag-over'); });
galleryZone?.addEventListener('dragleave', () => galleryZone.classList.remove('drag-over'));
galleryZone?.addEventListener('drop', e => { e.preventDefault(); galleryZone.classList.remove('drag-over'); handleGalleryFiles(Array.from(e.dataTransfer.files)); });
galleryInput?.addEventListener('change', e => handleGalleryFiles(Array.from(e.target.files)));

const GALLERY_CATEGORY_LABEL = {
  event: '📸 Event',
  kelas: '📚 Kegiatan Kelas',
  organisasi: '🏛️ Organisasi'
};

async function handleGalleryFiles(files) {
  if (!files.length) return;

  const categorySelect = document.getElementById('gallery-category-select');
  const titleInput     = document.getElementById('gallery-title-input');
  const category = categorySelect?.value || '';
  const title    = titleInput?.value.trim() || '';

  if (!category) {
    showToast({ type:'warning', title:'Pilih Kategori', message:'Pilih kategori foto sebelum upload.' });
    return;
  }

  const origHTML = galleryZone.innerHTML;
  galleryZone.innerHTML = `<div class="file-upload-icon">⏳</div><div class="file-upload-text"><strong>Mengupload ${files.length} foto...</strong><br/><span class="text-xs text-dim">Mohon tunggu</span></div>`;

  let ok = 0; const errs = [];
  for (const file of files) {
    try {
      if (file.size > 5*1024*1024) { errs.push(`${file.name}: > 5MB`); continue; }
      if (!file.type.startsWith('image/')) { errs.push(`${file.name}: bukan gambar`); continue; }
      const base64 = await new Promise((res,rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result);
        reader.onerror = () => rej(new Error('Gagal baca'));
        reader.readAsDataURL(file);
      });
      await addDoc(collection(db, 'gallery'), {
        url: base64,
        imageUrl: base64,
        name: file.name,
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        category,
        size: file.size,
        type: file.type,
        uploadedBy: currentUser?.uid || '',
        createdAt: serverTimestamp()
      });
      ok++;
    } catch(err) { errs.push(`${file.name}: ${err.message}`); }
  }

  galleryZone.innerHTML = origHTML;
  // Re-attach events after innerHTML reset
  document.getElementById('gallery-files')?.addEventListener('change', e => handleGalleryFiles(Array.from(e.target.files)));

  if (ok) {
    showToast({ type:'success', title:'Upload Berhasil', message:`${ok} foto berhasil ditambahkan ke galeri.` });
    if (titleInput) titleInput.value = '';
    if (categorySelect) categorySelect.value = '';
  }
  if (errs.length) showToast({ type:'warning', title:'Ada File Gagal',  message: errs.join(', ') });
  loadGalleryMgmt();
}

async function loadGalleryMgmt() {
  const snap = await getDocs(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')));
  const wrap = document.getElementById('gallery-mgmt-grid');
  if (!wrap) return;
  if (!snap.docs.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">🖼️</div><div class="empty-title">Belum ada foto</div></div>';
    return;
  }
  wrap.innerHTML = snap.docs.map(d => {
    const g = d.data();
    const catLabel = GALLERY_CATEGORY_LABEL[g.category] || g.category || 'Dokumentasi';
    return `
      <div class="gallery-item">
        <img src="${g.url || g.imageUrl}" alt="${g.title || g.name || 'foto'}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:8px" />
        <div class="gallery-item-overlay" style="flex-direction:column;align-items:flex-start;gap:4px">
          <div style="font-size:0.8rem;font-weight:700;color:white;font-family:var(--font-ui)">${g.title || g.name || 'Foto'}</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.6);font-family:var(--font-mono)">${catLabel}</div>
          <div class="flex gap-2 mt-2">
            <a href="${g.url || g.imageUrl}" target="_blank" class="btn btn-ghost btn-sm">🔗</a>
            <button class="btn btn-danger btn-sm" onclick="deleteGalleryItem('${d.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.deleteGalleryItem = async function(id) {
  if (!confirm('Hapus foto ini?')) return;
  await deleteDoc(doc(db, 'gallery', id));
  showToast({ type:'info', title:'Foto Dihapus' });
  loadGalleryMgmt();
};

// ── Users Table ──
async function loadUsersTable() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    const wrap = document.getElementById('users-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Laporan</th><th>Bergabung</th></tr></thead>
        <tbody>
          ${snap.docs.map(d => {
            const u = d.data();
            return `<tr>
              <td><div class="flex items-center gap-2">
                <img src="${u.photoURL||''}" width="28" height="28" style="border-radius:50%;object-fit:cover;border:1px solid var(--border)" onerror="this.style.display='none'" />
                ${u.displayName||'—'}
              </div></td>
              <td class="font-mono text-xs">${u.email||'—'}</td>
              <td><span class="badge badge-read">${ROLE_LABEL[u.role]||u.role}</span></td>
              <td>${u.reportCount||0}</td>
              <td class="text-xs text-muted">${u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('id-ID') : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(err) {
    console.warn('loadUsersTable:', err.message);
  }
}

// ── Notification Bell ──
document.getElementById('nav-notif-btn')?.addEventListener('click', () => {
  if (!currentUser) return;
  getDocs(query(collection(db, 'notifications'), where('uid', '==', currentUser.uid))).then(snap => {
    const unread = snap.docs.filter(d => d.data().read === false);
    unread.forEach(d => updateDoc(doc(db, 'notifications', d.id), { read: true }));
    if (unread.length) showToast({ type:'info', title:'Notifikasi', message:`${unread.length} notifikasi ditandai dibaca.` });
  });
});
