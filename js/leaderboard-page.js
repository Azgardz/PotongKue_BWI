(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const LB = window.PotongKueLB;
  const el = {
    summary: $('#summary'),
    players: $('#s-players'),
    success: $('#s-success'),
    attempts: $('#s-attempts'),
    live: $('#live'),
    liveText: $('#live-text'),
    empty: $('#empty'),
    emptyText: $('#empty-text'),
    table: $('#table'),
    rows: $('#rows'),
    share: $('#share'),
    shareUrl: $('#share-url'),
    copy: $('#copy-btn'),
    play: $('#play-link'),
  };

  const SESSION = 'UMUM'; // harus sama dengan js/game.js
  let seen = new Map(); // playerKey -> signature, to flash rows that changed

  const keyOf = (r) => r.name.trim().toLowerCase() + '|' + (r.team || '').trim().toLowerCase();
  const sigOf = (r) => [r.success, r.pieces, r.balance, r.timeMs, r.attempts].join('/');

  function setLive(state, text) {
    el.live.dataset.state = state;
    el.liveText.textContent = text;
  }

  const gameUrl = () => new URL('index.html', location.href).href;

  function render(rows) {
    const board = LB.buildBoard(rows);
    el.players.textContent = board.length;
    el.success.textContent = board.filter((r) => r.success).length;
    el.attempts.textContent = rows.length;

    if (!board.length) {
      el.table.hidden = true;
      el.empty.hidden = false;
      el.emptyText.textContent = 'Belum ada skor. Skor muncul otomatis begitu peserta menyelesaikan 3 potongan.';
      seen = new Map();
      return;
    }
    el.empty.hidden = true;
    el.table.hidden = false;

    const next = new Map();
    const frag = document.createDocumentFragment();
    board.forEach((r, i) => {
      const k = keyOf(r);
      const sig = sigOf(r);
      next.set(k, sig);
      const tr = document.createElement('tr');
      if (i < 3) tr.className = 'top' + (i + 1);
      if (seen.size && seen.get(k) !== sig) tr.classList.add('fresh');

      const rank = document.createElement('td');
      rank.className = 'c-rank';
      rank.innerHTML = '<span class="medal"></span>';
      rank.firstChild.textContent = i + 1;

      const name = document.createElement('td');
      name.className = 'c-name';
      const nm = document.createElement('span');
      nm.className = 'pname';
      nm.textContent = r.name;
      name.appendChild(nm);
      if (r.team) {
        const tm = document.createElement('span');
        tm.className = 'pteam';
        tm.textContent = r.team;
        name.appendChild(tm);
      }

      const status = document.createElement('td');
      status.className = 'c-status';
      const badge = document.createElement('span');
      badge.className = 'badge ' + (r.success ? 'ok' : 'no');
      badge.textContent = r.success ? 'Berhasil · 8/8' : r.pieces === 8 ? '8/8 · belum rata' : `${r.pieces}/8 bagian`;
      status.appendChild(badge);

      const time = document.createElement('td');
      time.className = 'c-num';
      time.textContent = LB.fmtTime(r.timeMs);

      const bal = document.createElement('td');
      bal.className = 'c-num c-bal';
      bal.textContent = r.pieces === 8 ? Math.round(r.balance) + '%' : '—';

      const tries = document.createElement('td');
      tries.className = 'c-num c-tries';
      tries.textContent = r.attempts;

      tr.append(rank, name, status, time, bal, tries);
      frag.appendChild(tr);
    });
    el.rows.replaceChildren(frag);
    seen = next;
  }

  async function start() {
    el.summary.hidden = false;
    el.share.hidden = false;
    el.shareUrl.textContent = gameUrl();
    el.play.href = gameUrl();
    setLive('wait', 'Menghubungkan…');
    try {
      await LB.watchSession(
        SESSION,
        (rows) => { render(rows); setLive('on', 'Live'); },
        (err) => { console.warn(err); setLive('off', 'Koneksi terputus'); }
      );
    } catch (err) {
      console.warn(err);
      setLive('off', 'Gagal terhubung');
      el.emptyText.textContent = 'Tidak bisa terhubung ke database. Periksa koneksi internet, lalu muat ulang halaman.';
    }
  }

  el.copy.addEventListener('click', async () => {
    const text = el.shareUrl.textContent;
    try {
      await navigator.clipboard.writeText(text);
      el.copy.textContent = 'Tersalin ✓';
    } catch (err) {
      const r = document.createRange();
      r.selectNodeContents(el.shareUrl);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      el.copy.textContent = 'Tekan Ctrl+C';
    }
    setTimeout(() => { el.copy.textContent = 'Salin'; }, 1800);
  });

  start();
})();
