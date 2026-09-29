# PRD — Tantangan Potong Kue
## 3 Cuts. 8 Equal Pieces.

**Document type:** Product Requirements Document + Implementation Prompt  
**Format target:** Web game / interactive 3D puzzle  
**Primary stack:** HTML, CSS, JavaScript, Three.js  
**Language UI:** Bahasa Indonesia  
**Core device targets:** Desktop/laptop first, responsive tablet/mobile  
**Visual direction:** Premium warm bakery / home-kitchen, photorealistic chocolate cake, cream–caramel UI

---

# 1. Product Overview

**Tantangan Potong Kue** adalah game puzzle spatial sederhana yang meminta pemain:

> Membagi 1 kue menjadi **8 bagian sama besar** hanya dengan **3 kali potong**.

Game tidak boleh berubah menjadi game tentang kecepatan mouse atau tebakan acak. Inti pengalaman adalah membuat pemain menyadari bahwa kue merupakan **objek tiga dimensi**, sehingga potongan tidak harus selalu dilakukan dari atas.

Aha moment yang diharapkan:

1. Pemain mencoba memotong dari atas.
2. Pemain menyadari 3 garis dari atas saja tidak cukup.
3. Pemain memutar sudut pandang.
4. Pemain menemukan kemungkinan potongan horizontal.
5. Satu potongan horizontal membentuk 2 layer.
6. Dua potongan vertikal bersilangan membelah kedua layer sekaligus.
7. Hasil akhir = 8 bagian.

Game **tidak memberikan hint, clue, walkthrough, atau tombol lihat solusi**.

---

# 2. Product Goal

Membuat puzzle 3D yang:

- langsung dipahami dalam beberapa detik;
- memiliki visual premium dan polished;
- memberikan feedback potongan secara instan;
- membuat pemain bebas memutar objek dan berpikir secara spatial;
- mengevaluasi bukan hanya jumlah bagian, tetapi juga kesamaan ukuran;
- tetap sederhana: satu challenge, satu objective, satu flow.

---

# 3. Non-Goals

Jangan menambahkan:

- mode Classic / Guided / Precision / Speed;
- level selector;
- hint system;
- tombol "Petunjuk";
- tombol "Lihat Solusi";
- autoplay solusi;
- coin / XP / leaderboard / shop;
- dialog tutorial panjang setelah permainan dimulai;
- indikator yang membocorkan arah potongan;
- garis bantu solusi;
- persentase ukuran potongan yang selalu terlihat selama bermain.

---

# 4. Core Game Rule

## Objective

Pemain memiliki:

- **1 kue**
- **maksimal 3 kali potong**
- target **8 bagian**
- seluruh bagian harus sedekat mungkin dengan ukuran yang sama.

## Definisi "1 kali potong"

Satu drag pemain merepresentasikan **satu bidang potong 3D**, bukan hanya satu garis pada permukaan.

Bidang tersebut harus memotong **semua bagian kue yang beririsan dengan bidang yang sama**.

Contoh:

- Jika kue sudah menjadi dua layer akibat potongan horizontal,
- lalu pemain membuat satu bidang vertikal,
- bidang vertikal tersebut harus dapat memotong kedua layer dalam satu kali aksi.

Ini adalah aturan fundamental puzzle.

---

# 5. Critical Geometry Requirement

## Canonical Geometry vs Visual Separation

Setelah kue dipotong, bagian kue boleh bergeser sedikit agar garis potong terlihat.

Namun:

> **Visual separation tidak boleh mengubah logika geometri puzzle.**

Semua kalkulasi potongan berikutnya harus menggunakan:

- posisi canonical/original piece geometry; atau
- transform yang dikompensasikan dengan benar.

Tujuannya:

- explode/separation hanyalah visual;
- satu bidang potong tetap dianggap melewati posisi kue yang belum dipisahkan secara kosmetik;
- potongan berikutnya tidak boleh gagal hanya karena bagian kue sebelumnya bergeser beberapa pixel/centimeter untuk animasi.

Ini wajib diuji secara khusus.

---

# 6. Game Flow

## State 0 — Initial Load

Saat halaman dibuka:

- scene ruangan sudah terlihat di belakang;
- kue 3D berada di tengah meja;
- UI utama boleh terlihat redup / inactive;
- popup objective muncul di tengah.

Tidak ada menu mode.

---

## State 1 — Opening Popup

Popup hanya berfungsi menjelaskan tugas.

### Isi

**Spatial Puzzle**

# 3 CUTS. 8 EQUAL PIECES.

> Potong kue menjadi 8 bagian sama besar hanya dengan 3 kali potong.

Visual ringkas:

- 1 KUE
- 3 POTONGAN
- 8 BAGIAN SAMA BESAR

Instruksi singkat:

> Tarik garis pada kue untuk memotong. Gunakan Putar, klik kanan, atau dua jari untuk mengubah sudut pandang.

Primary CTA:

**Mulai Tantangan →**

### Aturan popup

- hanya tampil di awal challenge;
- tidak boleh memberikan clue bagaimana solusi dilakukan;
- jangan menyebut "horizontal", "layer", "dari samping", atau petunjuk spatial lain;
- setelah pemain menekan Mulai Tantangan, popup hilang.

---

# 7. In-Game UI

Setelah popup ditutup, gameplay dibuat bersih.

## Header

Kiri:

**Tantangan Potong Kue**

Subtext:

**3 kali potong. 8 bagian. Semuanya harus sama besar.**

Kanan:

### Sisa Potong
- icon pisau
- angka dinamis: 3 → 2 → 1 → 0

### Bagian Saat Ini
- icon slice cake
- angka dinamis berdasarkan jumlah solid/piece

### Waktu
- stopwatch
- format MM:SS
- timer dimulai saat tombol **Mulai Tantangan** ditekan.

---

# 8. In-Game Controls

Bottom control dock:

## Potong
Default active state.

Desktop:
- left mouse drag = membuat potongan.

Mobile:
- one finger drag = membuat potongan.

## Putar

Jika tombol Putar aktif:

Desktop:
- left drag = orbit camera.

Shortcut desktop:
- right drag / Ctrl + drag = orbit walaupun mode Potong aktif.

Mobile:
- two-finger gesture = orbit;
- pinch = zoom.

## Undo

- membatalkan satu potongan terakhir;
- mengembalikan jumlah cut;
- mengembalikan geometry;
- mengembalikan camera/object state yang relevan bila perlu.

## Pisahkan

Explode View.

- tidak dihitung sebagai potongan;
- hanya mengubah jarak visual antar-piece;
- tidak memengaruhi canonical cutting geometry;
- klik lagi = Satukan.

## Reset

- mengulang challenge;
- cuts kembali ke 3;
- pieces kembali 1;
- timer reset;
- camera kembali ke default;
- popup awal **tidak harus muncul lagi** jika Reset dilakukan saat sedang bermain.

---

# 9. No Hint Policy

Tidak boleh ada:

- hint button;
- hint popup;
- contextual clue seperti "coba dari samping";
- pesan "bisakah satu potongan terakhir menggandakan semuanya?";
- tutorial lanjutan;
- solution replay.

Feedback hanya boleh menjelaskan **apa yang baru terjadi**, bukan **apa yang seharusnya dilakukan selanjutnya**.

Contoh feedback yang diperbolehkan:

- "Potongan pertama selesai."
- "Sekarang ada 2 bagian."
- "Sisa 2 kali potong."
- "Garis belum mengenai kue."

Contoh feedback yang tidak diperbolehkan:

- "Coba lihat kue dari samping."
- "Apakah semua potongan harus dari atas?"
- "Satu potongan bisa membelah dua layer."

---

# 10. Cutting Interaction

## Drag Start

Ketika pemain mulai drag:

- cursor / knife feedback aktif;
- garis drag muncul;
- game belum memotong.

## Drag Move

Tampilkan **cutting plane preview** transparan.

Preview harus:

- menunjukkan bidang 3D;
- mengikuti garis drag;
- cukup transparan agar tidak menutupi cake;
- tidak memberikan snap-solution yang terlalu agresif.

Visual:
- cream/white translucent plane;
- thin glowing edge;
- opacity ± 0.15–0.25.

## Drag Release

Jika drag valid:

1. cutting plane flash ±150–250 ms;
2. geometry langsung terpotong;
3. cut surface langsung muncul;
4. kedua sisi bergeser sedikit;
5. counter langsung berubah;
6. feedback kecil boleh muncul.

Tidak boleh menunggu sampai potongan ke-3 untuk memperlihatkan hasil.

---

# 11. Immediate Cut Feedback

Setiap cut harus terasa sebagai aksi fisik.

Minimum feedback:

- geometry berubah saat mouse/touch dilepas;
- cut surface terlihat;
- piece separation kecil;
- soft shadow pada celah;
- camera tetap stabil.

Optional polish:

- micro camera impulse;
- knife swipe animation;
- small crumb particles;
- subtle chocolate dust;
- soft slicing sound.

Animation duration:
- 250–450 ms;
- jangan membuat pemain harus menunggu lama sebelum cut selanjutnya.

---

# 12. Visual Separation Logic

Normal separation setelah setiap cut:

- kecil;
- cukup untuk membaca garis irisan;
- mempertahankan bentuk cake secara keseluruhan.

Target displacement:
- sekitar 2–4% diameter kue.

Explode View:
- sekitar 12–20% diameter;
- hanya untuk inspeksi.

Untuk potongan horizontal:

- layer atas boleh naik sedikit;
- layer bawah sedikit turun / tetap;
- separation perlu lebih mudah dibaca dibanding potongan vertikal.

---

# 13. Camera System

## Default Camera

Tampilan awal adalah **normal three-quarter view**:

- cukup terlihat bagian atas;
- cukup terlihat bagian samping;
- cake terasa dimensional;
- bukan top-down penuh.

Referensi utama:
- chocolate cake normal / three-quarter reference yang sudah dibuat.

## Orbit

Pemain harus dapat bergerak dari:

- normal view;
- top-ish view;
- side view;
- sisi kiri/kanan.

Camera orbit:
- smooth;
- inertia ringan optional;
- vertical angle di-clamp agar tidak masuk ke bawah meja;
- zoom di-clamp agar tidak terlalu dekat / jauh.

## Suggested camera limits

- azimuth: 360°
- polar: ± sekitar 15° dari hampir-side sampai sekitar 75–82° top view
- jangan izinkan camera menembus countertop.

---

# 14. Cake Visual Specification

Gunakan tiga referensi utama cake:

1. **Normal / three-quarter**
2. **Top**
3. **Side**

Ketiganya harus dianggap sebagai visual mapping dari objek cake yang sama.

## Cake Shape

- round chocolate layer cake;
- diameter lebar;
- proporsi tidak terlalu tinggi;
- 2–3 chocolate sponge layers;
- chocolate buttercream di antara sponge;
- dark chocolate ganache di atas;
- drip ganache di sisi;
- chocolate crumbs pada bagian bawah;
- piped chocolate rosettes di perimeter atas.

## Consistency Requirement

Normal, top, dan side view harus memiliki:

- jumlah rosette yang konsisten;
- posisi rosette konsisten;
- warna chocolate konsisten;
- jumlah layer konsisten;
- tinggi cake konsisten;
- drip pattern tidak perlu pixel-perfect tetapi harus terasa berasal dari cake yang sama.

---

# 15. Cake Materials

Target material:

## Ganache top
- dark chocolate;
- smooth;
- glossy;
- roughness rendah-menengah;
- highlight lembut.

## Sponge
- porous;
- matte;
- dark brown;
- detail crumb terlihat di cut surface.

## Buttercream
- medium chocolate;
- softer;
- lebih terang dari sponge.

## Chocolate crumb base
- irregular;
- rough;
- small bump feeling.

## Rosette
- glossy chocolate frosting;
- smooth spiral ridges.

---

# 16. Cut Surface

Cut surface sangat penting.

Saat cake dipotong, bagian dalam harus memperlihatkan:

- chocolate sponge layers;
- buttercream layers;
- top ganache;
- realistic layered cross-section.

Cut surface tidak boleh:

- satu warna flat;
- terlihat seperti polygon tanpa texture;
- memiliki UV stretching ekstrem.

Untuk potongan horizontal, cut face dari layer harus tetap terlihat believable.

---

# 17. Cake Stand

Cake diletakkan di cake stand / pedestal.

Arah visual:

- warm ivory / cream;
- subtle marble / ceramic;
- rounded plate;
- pedestal sederhana;
- jangan terlalu dekoratif.

Stand harus menjadi actual 3D object jika camera dapat berputar.

Jangan menggunakan flat PNG cake stand yang hanya cocok dari satu sudut.

---

# 18. Room / Environment Art Direction

Environment mengikuti referensi ruangan yang sudah digenerate.

## Mood

- premium warm home bakery;
- modern rustic;
- cream / beige / walnut / brass;
- golden sunlight;
- calm;
- welcoming;
- photorealistic;
- tidak terlalu ramai.

## Background Elements

Boleh ada:

- large warm window;
- cream cabinetry;
- wood shelves;
- ceramic jars;
- cutting boards;
- hanging plants;
- brass pendant lamps;
- small herbs/plants;
- stove/range di salah satu sisi;
- sink di sisi lain.

Semua background harus lebih soft daripada cake.

---

# 19. Countertop / Table

Foreground menggunakan:

- warm ivory marble / quartz;
- subtle beige/golden veins;
- glossy-satin reflection;
- large empty working area di center.

Di sisi kiri/kanan boleh ada props ringan:

- bowl small chocolate chunks;
- folded linen;
- whisk / wooden utensils;
- small flowers.

Center harus kosong agar cake menjadi hero object.

---

# 20. Environment Views

Referensi ruangan tersedia dari beberapa sisi.

Gunakan sebagai basis spatial layout yang sama.

Views yang perlu direkonstruksi:

1. Front-ish / main gameplay view.
2. Left / sink + window side.
3. Right / stove + shelving side.
4. Opposite / range + door/window side.

Semua view harus terasa berada di dapur yang sama:

- countertop sama;
- cabinetry sama;
- marble sama;
- lighting direction konsisten;
- material wood sama;
- pendant design sama.

---

# 21. Recommended Environment Implementation

## Preferred

Buat lightweight 3D kitchen shell:

- marble countertop = actual 3D plane/box;
- background walls = simple planes;
- cabinetry = low-poly geometry;
- windows = emissive/light planes;
- shelves/props = low-detail meshes;
- reference images hanya menjadi art-direction / texture guide.

Keuntungan:

- camera rotation terasa benar;
- parallax konsisten;
- cake dan room lighting menyatu.

## Alternative 2.5D

Jika full room terlalu berat:

- gunakan curved/cylindrical backdrop;
- atau beberapa background planes mengelilingi scene;
- gunakan front/left/right reference images sebagai textures;
- crossfade berdasarkan camera azimuth.

Jika memakai 2.5D:

- countertop tetap harus 3D;
- seam antar-background jangan terlihat;
- cake tidak boleh terasa melayang dari environment.

---

# 22. Lighting

Lighting source utama:

- golden daylight dari window;
- warm pendant ambient;
- soft fill dari ruangan.

Cake lighting:

- key light dari kiri/depan;
- soft fill dari kanan;
- subtle rim/highlight dari belakang;
- contact shadow kuat tapi lembut.

Cake harus tetap readable dari semua angle.

Jangan membuat side view terlalu gelap.

---

# 23. Visual Hierarchy

Urutan fokus:

1. Cake
2. Player action / cutting plane
3. Remaining cuts + current pieces
4. Controls
5. Room atmosphere
6. Decorative props

Environment tidak boleh lebih kontras daripada cake.

---

# 24. UI Visual Language

Referensi visual UI yang sudah dibuat:

- **tantangan_potong_kue_banner_kue_lezat.png**
- **kartu_ui_pisau_dan_sisa_potong.png**
- **kartu_ui_kue_cokelat_berlapis.png**
- **kartu_timer_waktu_bergaya_manis.png**
- **kontrol_ui_potong_dan_putar.png**
- **tombol_undo_bergaya_cokelat_dan_karamel.png**
- **tombol_ui_pisahkan_berlapis_kahwa.png**
- **tombol_reset_cokelat_mengilap.png**
- **modal_tantangan_potong_kue_spatial.png**
- room references:
  - **dapur_pedesaan_hangat_dengan_meja_marmer.png**
  - **dapur_hangat_bermandikan_cahaya_matahari.png**
  - **dapur_hangat_dengan_marmer_dan_cokelat.png**
  - **dapur_pedesaan_hangat_bermandikan_cahaya_senja.png**

Catatan:

UI reference images adalah **art direction**, bukan berarti setiap card harus dimasukkan sebagai raster PNG.

Sebisa mungkin implementasikan UI dengan HTML/CSS agar:

- teks tetap tajam;
- angka counter dinamis;
- responsive;
- accessible;
- hover/active state bisa dianimasikan.

---

# 25. UI Palette

Suggested palette:

- Dark chocolate: `#3B1F14`
- Deep cocoa: `#5B2D1C`
- Caramel: `#A94E25`
- Warm accent: `#D47B45`
- Cream: `#FFF8F0`
- Soft cream: `#F6E7DA`
- Warm beige: `#E9CFB9`

Gunakan accent orange/caramel secara hemat.

Visual tidak boleh terasa kuno/orange-heavy.

Dominan:
- cream;
- chocolate;
- warm neutral.

---

# 26. Typography

Title:
- elegant bold serif atau refined display serif.

Body/UI:
- clean rounded sans-serif / friendly geometric sans.

Pastikan:

- high readability;
- angka counter sangat jelas;
- tidak terlalu childish;
- tidak memakai terlalu banyak font.

---

# 27. Dynamic UI States

## Sisa Potong

Initial:
`3`

After cut 1:
`2`

After cut 2:
`1`

After cut 3:
`0`

## Bagian Saat Ini

Initial:
`1`

Berubah berdasarkan actual geometry count.

Tidak hard-coded.

## Timer

Starts:
setelah **Mulai Tantangan**.

Stops:
ketika evaluasi akhir muncul.

Reset:
ketika pemain menekan Reset/Main Lagi.

---

# 28. Result Evaluation

Setelah cut ke-3, evaluasi otomatis.

## Case A — Success

Conditions:

- exactly 8 pieces;
- ukuran cukup seimbang.

Suggested threshold:

- max deviation dari ideal <= 10%.

Result:

**Challenge Completed**

Tampilkan:

- 8 / 8 pieces;
- balance score;
- time.

Animation:

- pieces sedikit explode;
- subtle camera orbit;
- celebratory but premium;
- tidak berlebihan.

Buttons:

- **Lihat Kue**
- **Main Lagi**

Tidak ada tombol solusi.

---

## Case B — 8 Pieces but Unequal

Message:

**8 bagian terbentuk, tapi ukurannya belum sama.**

Tampilkan:

- 8 / 8;
- balance score;
- distribution bars optional.

Buttons:

- **Lihat Kue**
- **Main Lagi**

Tidak memberikan arahan cara memperbaikinya.

---

## Case C — Less Than 8 Pieces

Message:

**Tantangan belum berhasil.**

Tampilkan:

- actual pieces / 8;
- time;
- optional balance jika relevan.

Buttons:

- **Lihat Kue**
- **Main Lagi**

Tidak memberikan hint.

---

# 29. Balance Metric

Ideal volume per piece:

`total_volume / 8`

Suggested metrics:

- mean absolute deviation;
- max deviation;
- balance score 0–100.

Example:

`balance = max(0, 100 - meanDeviationPercent)`

Success should depend on:

- piece count = 8;
- max deviation <= threshold.

Jangan memberi status success hanya karena jumlah potongan = 8.

---

# 30. Result Distribution Bars

Optional.

Hanya muncul di result modal.

Jangan tampil selama gameplay.

Setiap piece:

- percentage of total;
- ideal = 12.5%.

Tujuan:
- memberi feedback presisi setelah selesai;
- bukan menjadi alat bantu saat bermain.

---

# 31. Interaction Feedback

Allowed toast:

- "Potongan tidak mengenai kue."
- "2 bagian."
- "Sisa 2 potongan."
- "Undo berhasil."
- "Game direset."

Jangan menggunakan toast sebagai hint.

---

# 32. Audio — Optional

Jika audio ditambahkan:

- subtle knife slice;
- ceramic/stand movement;
- small success chime;
- soft UI click.

Audio harus optional dan tidak mengganggu.

---

# 33. Responsive Behavior

## Desktop

Primary target:
- 16:9;
- cake occupies ±35–45% viewport width;
- header full-width floating;
- controls bottom-center.

## Tablet

- UI cards lebih compact;
- cake tetap dominan.

## Mobile

- header boleh menjadi 2 rows;
- stats diperkecil;
- popup memenuhi ±90vw;
- controls bottom;
- touch interaction diprioritaskan;
- no horizontal page scroll.

---

# 34. Performance Requirements

Target:

- 60 FPS desktop modern;
- >= 30 FPS mobile mid-range.

Optimizations:

- pixel ratio max 2;
- texture compression jika memungkinkan;
- minimize geometry rebuild;
- dispose old BufferGeometry;
- reuse materials;
- limit shadow map resolution;
- avoid excessive transparent full-screen layers.

---

# 35. Technical State Model

Suggested global state:

```js
{
  started: false,
  gameOver: false,
  cutsUsed: 0,
  maxCuts: 3,
  pieces: [],
  history: [],
  exploded: false,
  interactionMode: "cut",
  elapsedMs: 0,
  camera: {
    theta: 0,
    phi: 0,
    radius: 0
  }
}
```

Do not include:

```js
hintLevel
gameMode
solutionReplay
guidedMode
precisionMode
speedMode
```

---

# 36. Piece Data Model

Each cake piece should conceptually contain:

```js
{
  id,
  polygons,
  constraints,
  volume,
  centroidCanonical,
  visualOffset,
  mesh,
  decorations
}
```

Critical:

`centroidCanonical` / geometry tetap terpisah dari `visualOffset`.

Visual offset must not permanently mutate puzzle coordinates.

---

# 37. Cut Data Model

Each cut:

```js
{
  normal,
  distance,
  timestamp
}
```

Optional history:

```js
{
  piecesSnapshot,
  cutsUsed,
  cameraState
}
```

Undo should restore deterministic state.

---

# 38. Input Requirements

## Desktop

- Left drag + Cut = cut.
- Left drag + Rotate = orbit.
- Right drag = orbit.
- Wheel = zoom.
- Undo/Reset buttons clickable.
- context menu disabled over canvas.

## Touch

- 1 finger in Cut = cut.
- 1 finger in Rotate = orbit.
- 2 finger = orbit/pinch.
- prevent browser scroll/zoom over canvas.

---

# 39. Cutting Plane Mapping

Drag from screen points `(x1,y1)` → `(x2,y2)`.

Convert screen coordinates into camera-space/world-space rays.

Construct a plane passing through camera-related drag rays.

Support:

- vertical cut;
- angled vertical cut;
- horizontal cut when player views cake sufficiently from side.

Snapping may exist only to stabilize near-horizontal/near-vertical intention.

Do not auto-correct an obviously wrong cut into the solution.

---

# 40. Failure Prevention

The game must not:

- register a cut outside the cake;
- consume a cut if plane intersects zero pieces;
- create micro sliver pieces below minimum volume threshold;
- let cut surface become open/non-manifold;
- duplicate rosette decoration after cuts;
- lose pieces after Undo.

---

# 41. Decoration Ownership

Top rosettes / decorative pieces need deterministic ownership.

When cake is split:

- each rosette belongs to the piece containing its canonical position;
- rosette should move with that piece;
- no duplicate rosettes.

If a plane passes exactly through rosette:
- assign consistently to one side;
- no duplication.

---

# 42. Visual Polish Priority

Implementation order:

### P0 — Must Work
1. 3D cake cutting.
2. 3-cut limit.
3. 8-piece evaluation.
4. immediate visual cut.
5. orbit camera.
6. Undo / Reset.
7. no hint / no solution.

### P1 — Must Look Good
8. realistic cake materials.
9. realistic cut surface.
10. premium UI.
11. marble counter.
12. warm kitchen environment.
13. contact shadows.

### P2 — Polish
14. cut preview plane.
15. subtle cake separation animation.
16. explode view.
17. success camera animation.
18. crumbs / sound.

---

# 43. Acceptance Criteria

Game dinyatakan selesai jika:

- [ ] Opening popup hanya menjelaskan objective dan controls.
- [ ] Tidak ada pilihan mode.
- [ ] Tidak ada hint.
- [ ] Tidak ada lihat solusi.
- [ ] Pemain hanya memiliki 3 cut.
- [ ] Invalid cut tidak menghabiskan kesempatan.
- [ ] Setiap valid cut langsung terlihat.
- [ ] Cut surface memiliki layered cake texture.
- [ ] Cake dapat diputar dari normal ke atas dan samping.
- [ ] Visual separation tidak merusak canonical cut logic.
- [ ] Horizontal cut dapat menghasilkan dua layer.
- [ ] Satu vertical plane dapat memotong semua layer yang beririsan.
- [ ] Dua vertical cuts setelah horizontal dapat menghasilkan 8 pieces.
- [ ] 8 unequal pieces tidak dianggap perfect success.
- [ ] Undo bekerja untuk setiap step.
- [ ] Reset mengembalikan state awal.
- [ ] Explode View tidak memengaruhi cutting calculation.
- [ ] Timer bekerja.
- [ ] UI responsive.
- [ ] Room dan marble counter konsisten dengan reference.
- [ ] Cake menjadi fokus visual utama.

---

# 44. QA Scenarios

## QA-01 — Perfect Intended Solution

1. Start.
2. Horizontal cut at 50% height.
3. Vertical cut through center.
4. Rotate ~90°.
5. Second vertical cut through center.

Expected:
- 8 pieces;
- equal volumes;
- Challenge Completed.

---

## QA-02 — Three Vertical Cuts

Perform all cuts from top.

Expected:
- result evaluated normally;
- likely not 8 equal pieces;
- no hint shown.

---

## QA-03 — Invalid Cut

Drag plane outside cake.

Expected:
- no cut consumed;
- toast says cut did not hit cake.

---

## QA-04 — Undo

1. Make cut.
2. Undo.

Expected:
- piece geometry restored;
- cuts remaining restored;
- decorations restored;
- no ghost mesh.

---

## QA-05 — Explode Then Cut

1. Make one valid cut.
2. Activate Pisahkan.
3. Make next cut.

Expected:
- logical cut uses canonical geometry;
- cosmetic explode must not change puzzle behavior.

---

## QA-06 — Reset

After two cuts:
- press Reset.

Expected:
- 1 whole cake;
- 3 cuts;
- timer reset;
- camera default;
- no stale meshes.

---

# 45. Visual Reference Notes

## Header Reference

Use `tantangan_potong_kue_banner_kue_lezat.png` as direction for:

- cream glassy card;
- chocolate typography;
- warm border;
- subtle depth.

Do not bake dynamic counters into header image.

---

## Counter Cards

Use:

- `kartu_ui_pisau_dan_sisa_potong.png`
- `kartu_ui_kue_cokelat_berlapis.png`
- `kartu_timer_waktu_bergaya_manis.png`

as visual direction.

Build dynamic values in HTML/CSS.

---

## Controls

Use:

- `kontrol_ui_potong_dan_putar.png`
- `tombol_undo_bergaya_cokelat_dan_karamel.png`
- `tombol_ui_pisahkan_berlapis_kahwa.png`
- `tombol_reset_cokelat_mengilap.png`

as art direction.

Maintain consistent radius, highlights, shadow and chocolate/cream palette.

---

## Intro Modal

Use:

`modal_tantangan_potong_kue_spatial.png`

as layout reference.

But final content must follow this PRD:
- one challenge;
- no mode selector;
- no hint;
- no solution.

---

# 46. Developer / Coding-Agent Prompt

Use the following prompt when implementing or regenerating the game:

---

## IMPLEMENTATION PROMPT

Build a polished browser-based 3D spatial puzzle called **"Tantangan Potong Kue"** using HTML, CSS, JavaScript and Three.js.

The entire implementation must follow this PRD as the source of truth.

Core challenge:

**1 cake. 3 cuts. 8 equal pieces.**

The player must discover the solution independently.

Do not add game modes, hints, solution buttons, walkthroughs, or contextual clues.

At the beginning, show one modal explaining only:

- target = 8 equal pieces;
- maximum = 3 cuts;
- drag to cut;
- rotate camera using rotate control/right mouse/touch gesture.

During play:

- render one realistic chocolate cake on a cream marble kitchen island;
- use a premium warm home-bakery environment consistent with the supplied room references;
- allow the player to orbit from normal three-quarter view to top and side views;
- show a subtle 3D cut-plane preview while dragging;
- on release, immediately cut all cake pieces intersected by that world-space plane;
- immediately reveal the cut surface;
- separate pieces slightly so the cut is readable;
- this separation must be cosmetic only and must never alter canonical cutting logic.

The cake needs:

- chocolate sponge layers;
- chocolate buttercream;
- glossy dark ganache;
- side drips;
- base crumbs;
- chocolate rosettes;
- believable layered interior texture on every generated cut face.

UI:

- cream/chocolate premium floating header;
- Sisa Potong;
- Bagian Saat Ini;
- Waktu;
- bottom controls: Potong, Putar, Undo, Pisahkan, Reset.

No hint button.
No solution button.
No mode selector.

After the third valid cut, evaluate:

- number of pieces;
- piece volumes;
- balance;
- time.

Success requires exactly 8 pieces and sufficiently equal volume.

Show a premium result modal with:

- pieces / 8;
- balance;
- time;
- Lihat Kue;
- Main Lagi.

Never reveal the solution.

Maintain smooth animation, responsive layout, deterministic Undo, correct resource disposal, and consistent interaction on desktop and touch devices.

Use the supplied UI, cake-angle and kitchen-room images as **visual art direction**, while keeping dynamic UI elements implemented with HTML/CSS and keeping cake/countertop/camera interaction truly 3D.

---

# 47. Final Design Principle

> **The puzzle must reward a change of perspective, not a hidden hint.**

Every system should support that principle:

- room gives spatial context;
- camera gives freedom;
- cake gives clear dimensionality;
- immediate cutting feedback builds understanding;
- UI stays quiet;
- the answer is never given away.

