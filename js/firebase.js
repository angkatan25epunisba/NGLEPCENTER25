// ============================================================
// EP CARE CENTER — Firebase Configuration
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDYfQTi-nqqhZ8wVkaho6O8vteA_V--7lg",
  authDomain:        "nglepcenter25.firebaseapp.com",
  projectId:         "nglepcenter25",
  storageBucket:     "nglepcenter25.firebasestorage.app",
  messagingSenderId: "982074055948",
  appId:             "1:982074055948:web:f675280f31542f68e17d29"
};

import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, where, orderBy, limit,
         onSnapshot, addDoc, serverTimestamp, getDocs, deleteDoc, increment, writeBatch, arrayUnion }
                                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject }
                                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const storage  = getStorage(app);
const provider = new GoogleAuthProvider();

// ── Role Constants ──
const ROLES = {
  MAHASISWA: 'mahasiswa',
  ADMIN:     'admin',
  DOSEN:     'dosen',
  FOUNDER:   'founder',
  DEVELOPER: 'developer'
};

// ── Privileged Accounts ──
// Ganti email di bawah sesuai kebutuhan. Format: 'email@gmail.com': ROLES.ROLE
const PRIVILEGED_ACCOUNTS = {

  // FOUNDER (2 akun) — akses penuh ke semua fitur
  'kamilfauzan651@gmail.com':             ROLES.FOUNDER,
  'angkatan25epunisba@gmail.com':         ROLES.FOUNDER,

  // DEVELOPER (10 akun) — akses penuh + kelola sistem
  'developer01.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer02.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer03.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer04.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer05.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer06.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer07.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer08.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer09.epcc@gmail.com':           ROLES.DEVELOPER,
  'developer10.epcc@gmail.com':           ROLES.DEVELOPER,

  // ADMIN (15 akun) — kelola laporan, balas pesan
  'admin01.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin02.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin03.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin04.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin05.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin06.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin07.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin08.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin09.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin10.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin11.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin12.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin13.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin14.epunisba25@gmail.com':         ROLES.ADMIN,
  'admin15.epunisba25@gmail.com':         ROLES.ADMIN,

  // DOSEN (30 akun) — lihat & balas laporan, tidak bisa hapus/galeri
  'dosen01.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen02.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen03.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen04.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen05.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen06.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen07.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen08.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen09.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen10.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen11.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen12.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen13.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen14.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen15.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen16.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen17.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen18.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen19.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen20.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen21.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen22.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen23.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen24.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen25.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen26.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen27.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen28.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen29.feb.unisba@gmail.com':         ROLES.DOSEN,
  'dosen30.feb.unisba@gmail.com':         ROLES.DOSEN,
};

// ── Auth: Sign In with Google ──
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    await ensureUserDocument(user);
    return { success: true, user };
  } catch (err) {
    console.error('Sign in error:', err);
    return { success: false, error: err.message };
  }
}

async function signOutUser() {
  try { await signOut(auth); return { success: true }; }
  catch (err) { return { success: false, error: err.message }; }
}

async function ensureUserDocument(user) {
  const userRef  = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  const role     = PRIVILEGED_ACCOUNTS[user.email] ?? ROLES.MAHASISWA;

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid, email: user.email,
      displayName: user.displayName, photoURL: user.photoURL,
      role, reportCount: 0,
      createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), isActive: true
    });
    // Update agregat publik supaya statistik di beranda ikut bertambah real-time
    if (role === ROLES.MAHASISWA) {
      try {
        await setDoc(doc(db, 'settings', 'public_stats'), {
          mahasiswa: increment(1), updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) { console.warn('public_stats mahasiswa increment failed:', e.message); }
    }
  } else {
    const updates = { lastLoginAt: serverTimestamp() };
    if (PRIVILEGED_ACCOUNTS[user.email]) updates.role = role;
    await updateDoc(userRef, updates);
  }
}

async function getCurrentUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { uid: user.uid, ...snap.data() } : null;
}

function hasAdminAccess(role) {
  return [ROLES.ADMIN, ROLES.DOSEN, ROLES.FOUNDER, ROLES.DEVELOPER].includes(role);
}

function isPrivileged(role) {
  return [ROLES.FOUNDER, ROLES.DEVELOPER].includes(role);
}

export {
  auth, db, storage,
  ROLES, PRIVILEGED_ACCOUNTS,
  signInWithGoogle, signOutUser,
  ensureUserDocument, getCurrentUserData,
  hasAdminAccess, isPrivileged,
  doc, setDoc, getDoc, updateDoc, collection, query, where, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp, getDocs, deleteDoc, increment, writeBatch, arrayUnion,
  ref, uploadBytes, getDownloadURL, deleteObject,
  onAuthStateChanged, GoogleAuthProvider
};
