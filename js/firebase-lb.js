/*
 * Leaderboard online (Firebase Firestore) untuk Tantangan Potong Kue.
 *
 * Classic script (bukan module) supaya index.html tetap bisa dibuka langsung
 * dari disk; SDK Firebase dimuat lewat dynamic import dari CDN resmi.
 * Semua fungsi aman dipanggil walau Firebase gagal dimuat: game tetap jalan,
 * hanya skor yang tidak tersimpan.
 *
 * Koleksi: scores/{auto-id}
 *   name, team, session, pieces, balance, timeMs, success, createdAt
 */
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyCci5ZMEB0KaDSZDWT0zK4lUGD4kusOK38',
    authDomain: 'potong-kue-bwi.firebaseapp.com',
    projectId: 'potong-kue-bwi',
    storageBucket: 'potong-kue-bwi.firebasestorage.app',
    messagingSenderId: '602749553315',
    appId: '1:602749553315:web:f5309b42ff0aa295938d16',
  };

  const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
  const COLLECTION = 'scores';

  let ready = null;

  function init() {
    if (ready) return ready;
    ready = (async () => {
      const [appMod, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-firestore.js'),
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      const db = fs.getFirestore(app);
      if (window.PKLB_EMULATOR) fs.connectFirestoreEmulator(db, window.PKLB_EMULATOR.host, window.PKLB_EMULATOR.port);
      return { db, fs };
    })();
    ready.catch((err) => console.warn('Firebase gagal dimuat:', err));
    return ready;
  }

  // "jamkrindo 01 " -> "JAMKRINDO-01"
  function normSession(s) {
    return String(s || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 30);
  }

  function cleanText(s, max) {
    return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  // Urutan peringkat: berhasil dulu (waktu tercepat, lalu keseimbangan);
  // yang belum berhasil diurutkan dari jumlah bagian, keseimbangan, lalu waktu.
  function compare(a, b) {
    if (a.success !== b.success) return a.success ? -1 : 1;
    if (a.success) {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return b.balance - a.balance;
    }
    if (a.pieces !== b.pieces) return b.pieces - a.pieces;
    if (a.balance !== b.balance) return b.balance - a.balance;
    return a.timeMs - b.timeMs;
  }

  function playerKey(r) {
    return r.name.trim().toLowerCase() + '|' + (r.team || '').trim().toLowerCase();
  }

  // Satu baris per pemain (skor terbaiknya), sudah terurut.
  function buildBoard(rows) {
    const best = new Map();
    for (const r of rows) {
      const k = playerKey(r);
      const cur = best.get(k);
      if (!cur) best.set(k, { ...r, attempts: 1, lastAt: r.createdAtMs || 0 });
      else {
        const attempts = cur.attempts + 1;
        const lastAt = Math.max(cur.lastAt, r.createdAtMs || 0);
        best.set(k, compare(r, cur) < 0 ? { ...r, attempts, lastAt } : { ...cur, attempts, lastAt });
      }
    }
    return [...best.values()].sort(compare);
  }

  function rowFromDoc(d) {
    const x = d.data();
    const ts = x.createdAt && typeof x.createdAt.toMillis === 'function' ? x.createdAt.toMillis() : Date.now();
    return {
      id: d.id,
      name: String(x.name || ''),
      team: String(x.team || ''),
      session: String(x.session || ''),
      pieces: Number(x.pieces) || 0,
      balance: Number(x.balance) || 0,
      timeMs: Number(x.timeMs) || 0,
      success: !!x.success,
      createdAtMs: ts,
    };
  }

  async function fetchSession(session) {
    const { db, fs } = await init();
    const snap = await fs.getDocs(fs.query(fs.collection(db, COLLECTION), fs.where('session', '==', session)));
    return snap.docs.map(rowFromDoc);
  }

  // Simpan satu percobaan, lalu kembalikan peringkat pemain di sesinya.
  async function submitScore(player, result) {
    const { db, fs } = await init();
    const rec = {
      name: cleanText(player.name, 30),
      team: cleanText(player.team, 40),
      session: normSession(player.session),
      pieces: Math.max(1, Math.min(8, Math.round(result.count))),
      balance: result.balance == null ? 0 : Math.round(Math.max(0, Math.min(100, result.balance)) * 10) / 10,
      timeMs: Math.round(result.time),
      success: !!result.success,
      createdAt: fs.serverTimestamp(),
    };
    if (rec.timeMs < 3000) throw new Error('too-fast');
    await fs.addDoc(fs.collection(db, COLLECTION), rec);
    const rows = await fetchSession(rec.session);
    const board = buildBoard(rows);
    const key = playerKey(rec);
    const idx = board.findIndex((r) => playerKey(r) === key);
    return { rank: idx + 1, players: board.length, session: rec.session, best: board[idx] || null };
  }

  // Dengarkan perubahan skor satu sesi secara realtime. Mengembalikan fungsi unsubscribe.
  async function watchSession(session, onRows, onError) {
    const { db, fs } = await init();
    return fs.onSnapshot(
      fs.query(fs.collection(db, COLLECTION), fs.where('session', '==', session)),
      (snap) => onRows(snap.docs.map(rowFromDoc)),
      (err) => onError && onError(err)
    );
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  window.PotongKueLB = { init, normSession, cleanText, compare, buildBoard, submitScore, watchSession, fmtTime };
})();
