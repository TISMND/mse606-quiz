// Firebase Auth + Firestore, mirrored to localStorage. The app always works from the local copy;
// the cloud is best-effort (offline, quota exhausted, or rules errors never block the quiz).
import { firebaseConfig, SDK } from './firebase-config.js';
import { emptyUser, mergeUsers } from './logic.js';

let fb = null;          // loaded SDK modules
let auth = null, db = null;
let uid = 'local';
let onUserCb = () => {};
let merging = false; // while true, the auth listener leaves account switching to signInGoogle

const localKey = (id) => `mse606.user.${id}`;
const readLocal = (id) => {
  try { return JSON.parse(localStorage.getItem(localKey(id))) || null; } catch { return null; }
};
const writeLocal = (id, user) => {
  try { localStorage.setItem(localKey(id), JSON.stringify(user)); } catch { /* storage full or blocked */ }
};
const normalize = (u) => ({ ...emptyUser(), ...(u || {}) });
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

function authInfo() {
  const u = auth?.currentUser;
  return { isAnonymous: !u || u.isAnonymous, displayName: u?.displayName || u?.email || null, cloud: !!u };
}

async function loadRemote(id) {
  try {
    const snap = await withTimeout(fb.fs.getDoc(fb.fs.doc(db, 'users', id)), 5000);
    return snap.exists() ? normalize(snap.data()) : null;
  } catch (e) {
    console.warn('[store] cloud load failed, using local copy', e.message);
    return undefined; // unknown, as opposed to null = known empty
  }
}

async function loadFor(id) {
  const local = readLocal(id);
  const remote = await loadRemote(id);
  const user = remote ?? normalize(local);
  writeLocal(id, user);
  return user;
}

export async function initStore(onUser) {
  onUserCb = onUser;
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
    onUserCb(normalize(readLocal('local')), authInfo());
    return;
  }

  let started = false;
  const fallback = setTimeout(() => {
    if (!started) { started = true; onUserCb(normalize(readLocal('local')), authInfo()); }
  }, 6000);

  fb.a.onAuthStateChanged(auth, async (u) => {
    if (!u) {
      try { await fb.a.signInAnonymously(auth); } catch (e) {
        console.warn('[store] anonymous sign-in failed, running local-only', e.message);
        clearTimeout(fallback);
        if (!started) { started = true; uid = 'local'; onUserCb(normalize(readLocal('local')), authInfo()); }
      }
      return;
    }
    clearTimeout(fallback);
    if (merging) return;
    uid = u.uid;
    let user = await loadFor(uid);
    // Progress made while running local-only (before auth worked) is folded in once.
    const pending = readLocal('local');
    if (pending) { user = mergeUsers(user, pending); localStorage.removeItem(localKey('local')); saveUser(user); }
    started = true;
    console.log('[store] signed in', uid, u.isAnonymous ? '(anonymous)' : '(google)');
    onUserCb(user, authInfo());
  });
}

export function saveUser(user) {
  writeLocal(uid, user);
  if (!db || uid === 'local') return;
  // Full overwrite (not merge): deleted miss ids must disappear from the cloud copy too.
  fb.fs.setDoc(fb.fs.doc(db, 'users', uid), user).catch((e) => console.warn('[store] save failed', e.message));
}

export function logAnswer({ qid, chapter, picked, correct, mode }) {
  if (!db || uid === 'local') return;
  fb.fs.addDoc(fb.fs.collection(db, 'users', uid, 'answers'), { qid, chapter, picked, correct, mode, at: Date.now() })
    .catch((e) => console.warn('[store] answer log failed', e.message));
}

const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

export async function signInGoogle() {
  if (!auth) throw new Error('Sign-in is unavailable right now.');
  const provider = new fb.a.GoogleAuthProvider();
  const anon = auth.currentUser;
  try {
    await fb.a.linkWithPopup(anon, provider);
    onUserCb(await loadFor(uid), authInfo());
  } catch (e) {
    if (CANCELLED.includes(e.code)) return;
    if (e.code === 'auth/popup-blocked') throw new Error('Your browser blocked the sign-in popup. Allow popups for this site and try again.');
    if (e.code !== 'auth/credential-already-in-use') throw e;
    // The Google account already has data: carry this device's anonymous progress into it.
    const cred = fb.a.GoogleAuthProvider.credentialFromError(e);
    const anonUser = normalize(readLocal(anon.uid));
    let answers = [];
    try {
      const snap = await fb.fs.getDocs(fb.fs.collection(db, 'users', anon.uid, 'answers'));
      answers = snap.docs.map((d) => d.data());
    } catch { /* answer log is best-effort */ }
    merging = true;
    try {
      await fb.a.signInWithCredential(auth, cred);
      uid = auth.currentUser.uid;
      const target = await loadFor(uid);
      const merged = mergeUsers(target, anonUser);
      saveUser(merged);
      for (let i = 0; i < answers.length; i += 400) {
        const batch = fb.fs.writeBatch(db);
        for (const ans of answers.slice(i, i + 400)) batch.set(fb.fs.doc(fb.fs.collection(db, 'users', uid, 'answers')), ans);
        batch.commit().catch((err) => console.warn('[store] answer copy failed', err.message));
      }
      onUserCb(merged, authInfo());
    } finally {
      // Release after the listener's pending callback for this sign-in has been skipped.
      setTimeout(() => { merging = false; }, 0);
    }
  }
}

export async function signOutUser() {
  if (auth) await fb.a.signOut(auth); // onAuthStateChanged then signs in a fresh anonymous user
}
