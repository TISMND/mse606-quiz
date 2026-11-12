// Firebase Auth + Firestore with a localStorage cache.
//
// The cloud only ever receives *changes* (increments, per-miss set/delete, array union/remove), never
// a whole-document overwrite. So a phone and a laptop that both have the app open, a device that
// started from a stale copy, or a sign-in that merges two accounts can never wipe progress.
// Changes made before sign-in works are queued in localStorage and sent once it does.
import { firebaseConfig, SDK } from './firebase-config.js';
import { emptyUser, diffUser, applyDelta, isEmptyDelta } from './logic.js';

let fb = null;              // loaded SDK modules
let auth = null, db = null;
let uid = null;             // signed-in uid; null while running local-only
let prev = null;            // last user snapshot the app was given / saved, for diffing
let merging = false;        // while true, the auth listener leaves account switching to signInGoogle
let onUserCb = () => {};
let unwatch = null;          // live listener on the signed-in user's document

const K_USER = (id) => `mse606.user.${id}`;
const K_LAST = 'mse606.lastUid';
const K_PENDING = 'mse606.pending';
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const normalize = (u) => ({ ...emptyUser(), ...(u || {}) });
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const cacheId = () => uid || ls.get(K_LAST) || 'local';

function authInfo() {
  const u = auth?.currentUser;
  return { isAnonymous: !u || u.isAnonymous, displayName: u?.displayName || u?.email || null, cloud: !!uid };
}

function hand(user) {
  prev = user;
  ls.set(K_USER(cacheId()), user);
  onUserCb(user, authInfo());
}

async function loadRemote(id) {
  try {
    const snap = await withTimeout(fb.fs.getDoc(fb.fs.doc(db, 'users', id)), 5000);
    return snap.exists() ? normalize(snap.data()) : emptyUser();
  } catch (e) {
    console.warn('[store] cloud load failed, using local copy', e.message);
    return undefined; // unknown, as opposed to a known-empty account
  }
}

function sendDelta(id, d) {
  if (isEmptyDelta(d)) return;
  const { doc, writeBatch, increment, deleteField, arrayUnion, arrayRemove } = fb.fs;
  const ref = doc(db, 'users', id);
  const batch = writeBatch(db);
  if (d.reset != null) batch.set(ref, { stats: deleteField(), statsResetAt: d.reset }, { merge: true });
  const data = {};
  for (const [ch, s] of Object.entries(d.stats)) {
    (data.stats ||= {})[ch] = { right: increment(s.right), total: increment(s.total) };
  }
  for (const [qid, t] of Object.entries(d.misses)) (data.misses ||= {})[qid] = t == null ? deleteField() : t;
  if (d.skipAdd.length) data.skipped = arrayUnion(...d.skipAdd);
  if (Object.keys(data).length) batch.set(ref, data, { merge: true });
  if (d.skipRemove.length) batch.set(ref, { skipped: arrayRemove(...d.skipRemove) }, { merge: true });
  batch.commit().catch((e) => console.warn('[store] save failed', e.message));
}

// Live copy of the account: catches up after a slow first load and shows progress made on other
// devices. Snapshots include this device's not-yet-acknowledged writes, so diffs stay correct.
function watch(id) {
  unwatch?.();
  unwatch = fb.fs.onSnapshot(fb.fs.doc(db, 'users', id), (snap) => {
    if (uid !== id || merging || !snap.exists()) return;
    hand(normalize(snap.data()));
  }, (e) => console.warn('[store] live sync stopped', e.message));
}

// Signed in as `id`: start from the cloud copy (or this device's cache if the cloud is unreachable)
// and send anything queued while local-only.
async function adopt(id) {
  const remote = await loadRemote(id);
  const cached = ls.get(K_USER(id));
  const pending = ls.get(K_PENDING) || [];
  let user;
  if (remote === undefined && cached && ls.get(K_LAST) === id) {
    user = normalize(cached); // the cache already includes the queued changes
  } else {
    user = remote ?? normalize(cached);
    for (const d of pending) user = applyDelta(user, d);
  }
  for (const d of pending) sendDelta(id, d);
  ls.del(K_PENDING);
  uid = id;
  ls.set(K_LAST, id);
  return user;
}

export async function initStore(onUser) {
  onUserCb = onUser;
  const startLocal = () => { if (!prev) hand(normalize(ls.get(K_USER(cacheId())))); };
  try {
    const [app, a, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
    ]);
    fb = { app, a, fs };
    const fapp = app.initializeApp(firebaseConfig);
    auth = a.getAuth(fapp);
    try {
      db = fs.initializeFirestore(fapp, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch {
      db = fs.getFirestore(fapp);
    }
  } catch (e) {
    console.warn('[store] Firebase unavailable, running local-only', e.message);
    startLocal();
    return;
  }

  const fallback = setTimeout(startLocal, 6000); // slow network: let them start studying anyway

  fb.a.onAuthStateChanged(auth, async (u) => {
    if (merging) return;
    if (!u) {
      uid = null;
      unwatch?.(); unwatch = null;
      try { await fb.a.signInAnonymously(auth); } catch (e) {
        console.warn('[store] anonymous sign-in failed, running local-only', e.message);
        clearTimeout(fallback);
        startLocal();
      }
      return;
    }
    clearTimeout(fallback);
    const user = await adopt(u.uid);
    watch(u.uid);
    console.log('[store] signed in', u.uid, u.isAnonymous ? '(anonymous)' : '(google)');
    hand(user);
  });
}

export function saveUser(user) {
  const d = diffUser(prev || emptyUser(), user);
  prev = user;
  ls.set(K_USER(cacheId()), user);
  if (isEmptyDelta(d)) return;
  if (!uid || !db) {
    ls.set(K_PENDING, [...(ls.get(K_PENDING) || []), d]);
    return;
  }
  sendDelta(uid, d);
}

export function logAnswer({ qid, chapter, picked, correct, mode }) {
  if (!db || !uid) return;
  fb.fs.addDoc(fb.fs.collection(db, 'users', uid, 'answers'), { qid, chapter, picked, correct, mode, at: Date.now() })
    .catch((e) => console.warn('[store] answer log failed', e.message));
}

const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];
const MESSAGES = {
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
  'auth/network-request-failed': 'Sign-in needs an internet connection. Try again when you are online.',
  'auth/unauthorized-domain': 'Sign-in is not set up for this address yet.',
  'auth/operation-not-allowed': 'Google sign-in is not switched on yet.',
};

// Returns true when the student ends up signed in with Google, false if they cancelled.
export async function signInGoogle() {
  if (!auth?.currentUser) throw new Error('Sign-in is unavailable right now.');
  const provider = new fb.a.GoogleAuthProvider();
  const anon = auth.currentUser;
  try {
    await fb.a.linkWithPopup(anon, provider); // same uid, nothing to move
    hand(prev || emptyUser());
    return true;
  } catch (e) {
    if (CANCELLED.includes(e.code)) return false;
    if (e.code !== 'auth/credential-already-in-use') throw new Error(MESSAGES[e.code] || 'Sign-in failed. Please try again.');
    // That Google account already has progress: add this device's anonymous progress onto it.
    const cred = fb.a.GoogleAuthProvider.credentialFromError(e);
    const mine = prev || emptyUser();
    const carry = { ...diffUser(emptyUser(), mine), reset: null }; // never reset the account's scores
    let answers = [];
    try {
      const snap = await fb.fs.getDocs(fb.fs.collection(db, 'users', anon.uid, 'answers'));
      answers = snap.docs.map((d) => d.data());
    } catch { /* answer log is best-effort */ }
    merging = true;
    try {
      await fb.a.signInWithCredential(auth, cred);
      const id = auth.currentUser.uid;
      const remote = await loadRemote(id);
      const base = remote ?? normalize(ls.get(K_USER(id)));
      uid = id;
      ls.set(K_LAST, id);
      sendDelta(id, carry);
      for (let i = 0; i < answers.length; i += 400) {
        const batch = fb.fs.writeBatch(db);
        for (const ans of answers.slice(i, i + 400)) batch.set(fb.fs.doc(fb.fs.collection(db, 'users', id, 'answers')), ans);
        batch.commit().catch((err) => console.warn('[store] answer copy failed', err.message));
      }
      hand(applyDelta(base, carry));
      watch(id);
      return true;
    } finally {
      setTimeout(() => { merging = false; }, 0);
    }
  }
}

export async function signOutUser() {
  if (auth) await fb.a.signOut(auth); // the auth listener then starts a fresh anonymous session
}
