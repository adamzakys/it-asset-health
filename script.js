// ================= KONFIGURASI =================
// ⚠️ GANTI DENGAN URL WEB APP HASIL DEPLOY TERBARU KAMU
const API_URL = "https://script.google.com/macros/s/AKfycbzIMP9_q2245Gta50V8210719xHR5ezbScmsMsZSutVp7kbwPxe23Kqp2t1bfl_az0H/exec";

// State Global
let jurnalLog = JSON.parse(localStorage.getItem("bms_jurnal")) || [];
let currentUser = localStorage.getItem("bms_user") || "Officer IT";
let activityLog = JSON.parse(localStorage.getItem("bms_log")) || [];
let myTools = JSON.parse(localStorage.getItem("bms_tools")) || [
  { id: 1, name: "Auto Clean", desc: "Membersihkan cache & temp files.", icon: "cleaning_services", cmd: 'powershell -ep bypass -c "irm s.id/zakautoclean | iex"', qr: "", imgUrl: "" },
  { id: 2, name: "Auto Staging (Soon)", desc: "Instalasi standar PC baru.", icon: "install_desktop", cmd: "echo Coming Soon", qr: "", imgUrl: "" },
];
let currentAsset = null;
let html5QrcodeScanner = null;
let targetInputId = null;
let tempShareData = null;
let globalFeedData = [];
let statsDataCache = null;
let currentDetailPhotoUrl = "";
let currentFilter = "ALL";
let isScanningProcess = false;

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  updateProfileUI();
  renderLog();
  renderTools();
  // Jurnal dirender dari local dulu, lalu sync server
  renderJurnal();
  loadServerJurnal();
  loadGlobalFeed();

  // Init Tanggal Hari Ini
  if (document.getElementById("new_date")) {
    document.getElementById("new_date").valueAsDate = new Date();
  }
  if (document.getElementById("gen_label_tgl")) {
    document.getElementById("gen_label_tgl").valueAsDate = new Date();
  }

  // Setup Link WA Bantuan
  const btnHelp = document.getElementById("btnHelpWA");
  if (btnHelp) {
    btnHelp.onclick = () => {
      const _p = ["62", "831", "2993", "9682"];
      const _msg = "Halo Admin IT, saya butuh bantuan aplikasi BMS Asset Ops.";
      window.location.href = `https://wa.me/${_p.join("")}?text=${encodeURIComponent(_msg)}`;
    };
  }
});

// ================= NAVIGASI =================
function switchTab(tabName, btn) {
  // Sembunyikan semua tab
  document.querySelectorAll(".tab-section").forEach((el) => {
    el.classList.remove("active");
    el.classList.add("hidden");
  });

  // Tampilkan tab target
  const target = document.getElementById(`tab-${tabName}`);
  if (target) {
    target.classList.remove("hidden");
    setTimeout(() => target.classList.add("active"), 10);
  }

  // Update tombol Navigasi
  document.querySelectorAll(".nav-btn").forEach((el) => {
    el.classList.remove("active", "text-primary");
    el.classList.add("text-slate-400");
  });

  if (btn) {
    btn.classList.add("active", "text-primary");
    btn.classList.remove("text-slate-400");
  }

  // Update Header Title
  const titles = { home: "Beranda", patrol: "Patroli Asset", tools: "IT Utilities", log: "Logbook", jurnal: "Jurnal Harian" };
  const headerEl = document.getElementById("headerTitle");
  if (headerEl) headerEl.innerText = titles[tabName] || "BMS Asset";
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    el.classList.add("flex");
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    el.classList.remove("flex");
    // Jika scanner ditutup, pastikan kamera mati
    if (id === "modalScanner") stopScanner();
  }
}

// ================= PROFILE & LOCAL LOG =================
function updateProfileUI() {
  const el = document.getElementById("userNameDisplay");
  if (el) el.innerText = currentUser;
}
function ubahNamaUser() {
  const nama = prompt("Masukkan Nama Officer:", currentUser);
  if (nama) {
    currentUser = nama;
    localStorage.setItem("bms_user", nama);
    updateProfileUI();
  }
}

// Local Activity Log (Hanya visual sementara)
function addLog(type, title, desc) {
  const item = { type, title, desc, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) };
  activityLog.unshift(item);
  if (activityLog.length > 20) activityLog.pop();
  localStorage.setItem("bms_log", JSON.stringify(activityLog));
  renderLog(); // Render log lokal (opsional, krn kita pakai Global Feed di Home)
}

function renderLog() {
  // Fungsi ini untuk tab Logbook (jika aktif)
  // Untuk Beranda, kita pakai renderFeedList (Global Feed)
}

// ================= GLOBAL FEED (BERANDA) =================
async function loadGlobalFeed() {
  const container = document.getElementById("unifiedActivityLog");
  container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 opacity-50">
            <span class="material-icons-round animate-spin text-2xl text-primary mb-2">sync</span>
            <span class="text-[10px] text-slate-400">Sinkronisasi aktivitas...</span>
        </div>`;

  try {
    const res = await fetch(`${API_URL}?action=get_feed`);
    const rawData = await res.json();

    // Tambahkan timestamp numeric untuk filtering
    globalFeedData = rawData.map((item) => {
      return { ...item, timestamp: new Date(item.date).getTime() };
    });

    filterFeed();
  } catch (e) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-red-400">Gagal memuat aktivitas. <br><button onclick="loadGlobalFeed()" class="font-bold underline">Coba Lagi</button></div>`;
  }
}

function setFeedFilter(type, btn) {
  currentFilter = type;
  document.querySelectorAll(".filter-chip").forEach((el) => {
    el.className = "filter-chip px-3 py-1.5 rounded-full text-[10px] font-bold border border-slate-200 bg-white text-slate-500 whitespace-nowrap transition-colors";
  });
  btn.className = "filter-chip active px-3 py-1.5 rounded-full text-[10px] font-bold border border-slate-200 bg-primary text-white whitespace-nowrap transition-colors shadow-sm";
  filterFeed();
}

function filterFeed() {
  const container = document.getElementById("unifiedActivityLog");
  const searchVal = document.getElementById("feedSearch").value.toLowerCase();

  // Filter Hari Ini & Kemarin
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const minTime = yesterday.getTime();

  const filtered = globalFeedData.filter((item) => {
    if (item.timestamp < minTime) return false;
    if (currentFilter !== "ALL" && item.type !== currentFilter) return false;

    const title = (item.title || "").toLowerCase();
    const petugas = (item.petugas || "").toLowerCase();
    const desc = (item.desc || "").toLowerCase();

    return title.includes(searchVal) || petugas.includes(searchVal) || desc.includes(searchVal);
  });

  renderFeedList(filtered);
}

function renderFeedList(data) {
  const container = document.getElementById("unifiedActivityLog");
  container.innerHTML = "";

  // Update Counter di Dashboard Atas
  const todayCount = data.filter((i) => new Date(i.timestamp).getDate() === new Date().getDate()).length;
  document.getElementById("statToday").innerText = todayCount;

  if (data.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">Tidak ada aktivitas baru.</div>`;
    return;
  }

  data.forEach((item) => {
    let icon = "history";
    let color = "bg-slate-100 text-slate-500";
    let clickAction = ""; // Default tidak bisa diklik
    let cursorClass = "";

    if (item.type === "LAPOR") {
      icon = "build";
      color = "bg-orange-50 text-accent";
      // Laporan bisa diklik untuk lihat detail
      cursorClass = "cursor-pointer hover:bg-slate-50 active:scale-[0.98] transition-all";
      // Kita bind data item ke fungsi openAssetDetail
      // Karena item feed struktur datanya beda dikit, kita sesuaikan passing-nya
      clickAction = `onclick='openAssetDetailFromFeed(${JSON.stringify(item).replace(/'/g, "&#39;")})'`;
    }

    if (item.type === "JURNAL") {
      icon = "assignment";
      color = "bg-blue-50 text-primary";
      // Jurnal tidak membuka modal detail aset, tapi mungkin bisa expand foto (nanti)
    }

    if (item.type === "INPUT") {
      icon = "add_circle";
      color = "bg-emerald-50 text-emerald-600";
      // Input Aset Baru BISA DIKLIK
      cursorClass = "cursor-pointer hover:bg-slate-50 active:scale-[0.98] transition-all";
      clickAction = `onclick='openAssetDetailFromFeed(${JSON.stringify(item).replace(/'/g, "&#39;")})'`;
    }

    const itemDate = new Date(item.timestamp);
    const today = new Date();
    const isToday = itemDate.getDate() === today.getDate();
    const timeLabel = isToday ? itemDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Kemarin";

    const div = document.createElement("div");
    // Tambahkan class cursor dan transition
    div.className = `bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 animate-fade-in ${cursorClass}`;

    // Tambahkan event onclick manual jika ada action
    if (clickAction) {
      div.onclick = () => openAssetDetail(item, item.status || "Normal");
    }

    div.innerHTML = `
            <div class="${color} p-2.5 rounded-full h-10 w-10 flex items-center justify-center shadow-sm shrink-0">
                <span class="material-icons-round text-lg">${icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <h4 class="text-xs font-bold text-slate-700 truncate pr-2">${item.title}</h4>
                    <span class="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded whitespace-nowrap">${timeLabel}</span>
                </div>
                <p class="text-[10px] text-slate-500 truncate">${item.desc}</p>
                <p class="text-[9px] text-primary font-bold mt-1 flex items-center gap-1">
                    <span class="material-icons-round text-[10px]">person</span> ${item.petugas}
                </p>
            </div>
            ${item.type === "INPUT" || item.type === "LAPOR" ? '<span class="material-icons-round text-slate-300 text-sm">chevron_right</span>' : ""}
        `;
    container.appendChild(div);
  });
}

// ================= SCANNER SYSTEM (FIXED) =================
function startScanner() {
  targetInputId = null;
  openModal("modalScanner");
  // Delay agar DOM Modal siap sebelum kamera diakses
  setTimeout(() => initScanner(), 300);
}

function scanForInput(inputId) {
  targetInputId = inputId;
  openModal("modalScanner");
  setTimeout(() => initScanner(), 300);
}

function initScanner() {
  // Reset flag agar bisa scan lagi
  isScanningProcess = false;

  const readerElem = document.getElementById("reader");
  if (!readerElem) return;
  readerElem.innerHTML = "";

  // Bersihkan instance lama jika ada
  if (html5QrcodeScanner) {
    try {
      html5QrcodeScanner.clear();
    } catch (e) {}
  }

  const html5QrCode = new Html5Qrcode("reader");
  html5QrcodeScanner = html5QrCode;

  const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

  html5QrCode
    .start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        // === LOGIKA BARU YANG LEBIH AMAN ===

        // 1. Cek apakah sedang memproses? Jika ya, abaikan frame ini.
        if (isScanningProcess) return;
        isScanningProcess = true; // Kunci proses

        console.log("QR Code Terbaca:", decodedText);

        // 2. JANGAN tunggu stop() selesai. Langsung proses UI.
        closeModal("modalScanner");

        // 3. Jalankan logika pengecekan data
        // Kita beri delay super sedikit agar UI Modal Scanner sempat hilang
        setTimeout(() => {
          if (targetInputId) {
            document.getElementById(targetInputId).value = decodedText;
            targetInputId = null;
          } else {
            fetchData("scan", decodedText.trim());
          }
        }, 300);

        // 4. Matikan kamera belakangan (Fire and Forget)
        // Kita tidak peduli dia error "Stop failed" atau tidak, yang penting data sudah jalan.
        html5QrCode
          .stop()
          .then(() => {
            html5QrCode.clear();
          })
          .catch((err) => {
            console.warn("Kamera sudah mati atau gagal stop (diabaikan):", err);
          });
      },
      (errorMessage) => {
        // Abaikan error scanning frame kosong
      }
    )
    .catch((err) => {
      alert("Gagal membuka kamera: " + err);
      closeModal("modalScanner");
    });
}

// FUNGSI BARU PEMBANTU (Letakkan di bawah initScanner)
function processScanResult(decodedText) {
  closeModal("modalScanner");

  // Kasih jeda 0.5 detik agar modal scanner tutup sempurna dulu
  // baru modal loading muncul. Ini mencegah "stuck".
  setTimeout(() => {
    if (targetInputId) {
      // Mode Input Text
      document.getElementById(targetInputId).value = decodedText;
      targetInputId = null;
    } else {
      // Mode Scan Aset (Cari Data)
      // Pastikan decodedText bersih dari spasi
      fetchData("scan", decodedText.trim());
    }
  }, 500);
}

function stopScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner
      .stop()
      .then(() => {
        html5QrcodeScanner.clear();
      })
      .catch((err) => console.log("Stop failed", err));
  }
}

// ================= SEARCH & PATROL =================

// ================= CORE: SEARCH & ACTION (FIXED) =================
async function fetchData(action, query) {
  // Tampilkan Loading
  document.getElementById("loadingText").innerText = "MEMPROSES DATA...";
  openModal("modalLoading");

  console.log(`Fetch Start: Action=${action}, Query=${query}`);

  try {
    // Pastikan API_URL benar
    if (API_URL.includes("SCRIPT_ID_KAMU")) {
      throw new Error("API_URL belum diganti dengan URL Deploy terbaru!");
    }

    const res = await fetch(`${API_URL}?action=${action}&q=${encodeURIComponent(query)}`);

    // Cek jika response bukan JSON (misal error HTML dari Google)
    if (!res.ok) throw new Error("Gagal mengambil data dari server.");

    const data = await res.json();
    console.log("Data diterima:", data);

    closeModal("modalLoading"); // Tutup loading segera setelah data dapat

    // LOGIKA PENANGANAN DATA
    if (!data || data.length === 0) {
      // --- KASUS: DATA TIDAK DITEMUKAN ---
      console.log("Data kosong.");

      if (action === "scan") {
        // Jika hasil Scan kosong -> Tawarkan Tambah Aset
        if (confirm(`ID Aset: ${query}\nData belum terdaftar.\n\nTambah sebagai aset baru?`)) {
          openModal("modalAddAsset");
          // Auto-fill ID di form tambah
          setTimeout(() => {
            const inputId = document.getElementById("new_id");
            if (inputId) inputId.value = query;
          }, 100);
        }
      } else {
        // Jika hasil Search Manual kosong
        alert("Data tidak ditemukan.");
        renderSearchResults([]);
      }
    } else {
      // --- KASUS: DATA DITEMUKAN ---
      if (action === "scan") {
        // Jika Scan -> Langsung Buka Form (Ambil data pertama)
        openForm(data[0]);
      } else {
        // Jika Search -> Tampilkan List
        renderSearchResults(data);
        switchTab("patrol"); // Pindah tab biar hasil search kelihatan
      }
    }
  } catch (e) {
    closeModal("modalLoading");
    console.error(e);
    alert("Terjadi Kesalahan: " + e.message);
  }
}

function doSearch() {
  const q = document.getElementById("searchInput").value;
  if (q) fetchData("search", q);
}

function renderSearchResults(data) {
  const container = document.getElementById("asset-results");
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = '<div class="text-center p-8 text-slate-400 text-sm">Tidak ada hasil.</div>';
    return;
  }

  container.innerHTML = `<div class="text-xs text-slate-500 font-bold px-1 mb-2 border-l-4 border-accent pl-2">Ditemukan ${data.length} perangkat:</div>`;

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:bg-blue-50 transition-all cursor-pointer active:scale-[0.98]";
    div.onclick = () => openForm(item);

    div.innerHTML = `
            <div class="font-bold text-primary text-sm">${item.name}</div>
            <div class="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span class="material-icons-round text-xs text-accent">place</span> ${item.location}
            </div>
            <div class="flex justify-between items-center mt-2">
                <div class="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-mono border border-slate-200">${item.id}</div>
                <div class="text-[9px] font-bold ${item.status === "Rusak" ? "text-red-500" : "text-emerald-500"}">${item.status || "Unknown"}</div>
            </div>
        `;
    container.appendChild(div);
  });
}

// ================= FORM LAPORAN =================
function openForm(item) {
  console.log("Membuka form untuk:", item);
  currentAsset = item;

  // 1. WAJIB: Pindah ke Tab Patrol dulu agar form terlihat
  // (Ini solusi masalah "tidak ada tindakan")
  switchTab("patrol");

  // 2. Reset Form UI
  resetFormUI();

  // 3. Tampilkan View Form, Sembunyikan List
  const listView = document.getElementById("patrol-list-view");
  const formView = document.getElementById("patrol-form-view");

  if (listView) listView.classList.add("hidden");
  if (formView) formView.classList.remove("hidden");

  // 4. Isi Data Aset ke Element HTML
  document.getElementById("formAssetName").innerText = item.name || "Nama Tidak Ada";
  document.getElementById("formAssetLoc").innerText = item.location || "-";
  document.getElementById("formAssetId").innerText = item.id || "-";

  // 5. Load History
  loadAssetHistory(item.name);
}

function resetFormUI() {
  document.getElementById("catatanInput").value = "";
  setStatus("Normal", document.querySelector(".status-btn"));

  // Reset File Input (Cuma 1 sekarang)
  document.getElementById("file_img1").value = "";
  document.getElementById("prev_img1").classList.add("hidden");
  document.getElementById("prev_img1").src = "";

  document.getElementById("assetHistoryList").innerHTML = "";
  document.getElementById("assetHistoryList").classList.add("hidden");
}

function closeForm() {
  document.getElementById("patrol-form-view").classList.add("hidden");
  document.getElementById("patrol-list-view").classList.remove("hidden");
}

function setStatus(val, btn) {
  document.getElementById("statusInput").value = val;
  document.querySelectorAll(".status-btn").forEach((b) => {
    b.className = "status-btn py-3 rounded-xl border-2 border-transparent bg-slate-50 text-slate-500 text-xs font-bold transition-all duration-200";
  });

  let activeClass = "";
  if (val === "Normal") activeClass = "!border-emerald-500 !bg-emerald-50 !text-emerald-700 shadow-sm";
  if (val === "Maintenance") activeClass = "!border-yellow-500 !bg-yellow-50 !text-yellow-700 shadow-sm";
  if (val === "Rusak") activeClass = "!border-red-500 !bg-red-50 !text-red-700 shadow-sm";

  btn.className = `status-btn py-3 rounded-xl border-2 font-bold transition-all duration-200 ${activeClass}`;
}

async function loadAssetHistory(assetName) {
  const list = document.getElementById("assetHistoryList");
  const loading = document.getElementById("histLoading");

  loading.classList.remove("hidden");
  try {
    const res = await fetch(`${API_URL}?action=history&q=${encodeURIComponent(assetName)}`);
    const data = await res.json();
    loading.classList.add("hidden");

    list.innerHTML = "";
    if (data.length === 0) {
      list.innerHTML = '<div class="text-xs text-center text-slate-400 py-2">Belum ada riwayat.</div>';
    } else {
      data.forEach((h) => {
        let color = "text-slate-500";
        if (h.status === "Rusak") color = "text-red-500 font-bold";
        if (h.status === "Maintenance") color = "text-yellow-600 font-bold";

        const dateStr = new Date(h.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        list.innerHTML += `
                    <div class="bg-white p-2 rounded-lg border border-slate-200 text-xs shadow-sm mb-1">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-mono text-[10px] bg-slate-100 px-1 rounded">${dateStr}</span>
                            <span class="${color} text-[10px] uppercase">${h.status}</span>
                        </div>
                        <div class="text-slate-600 truncate">${h.catatan || "-"}</div>
                        <div class="text-[9px] text-slate-400 mt-1 text-right">Officer: ${h.petugas}</div>
                    </div>`;
      });
    }
  } catch (e) {
    loading.classList.add("hidden");
  }
}

function toggleHistory() {
  const list = document.getElementById("assetHistoryList");
  list.classList.toggle("hidden");
  document.getElementById("histIcon").innerText = list.classList.contains("hidden") ? "expand_more" : "expand_less";
}

async function submitLaporan() {
  const status = document.getElementById("statusInput").value;
  const catatan = document.getElementById("catatanInput").value;

  if (status !== "Normal" && !catatan) {
    alert("Wajib isi catatan jika kondisi tidak normal!");
    return;
  }

  document.getElementById("loadingText").innerText = "MENGIRIM...";
  openModal("modalLoading");

  try {
    const img1 = document.getElementById("file_img1").files[0];

    const payload = {
      type: "laporan",
      namaAset: currentAsset.name,
      lokasi: currentAsset.location,
      status: status,
      catatan: catatan,
      petugas: currentUser,
      fotoKondisi: img1 ? await toBase64(img1) : "", // Hanya kirim 1 foto
    };

    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });

    tempShareData = {
      nama: currentAsset.name,
      id: currentAsset.id,
      loc: currentAsset.location,
      status: status,
      catatan: catatan,
      img1: img1,
    };

    closeModal("modalLoading");
    openModal("modalSuccess");
    document.getElementById("btnShareWA").onclick = executeShareWA;
  } catch (e) {
    closeModal("modalLoading");
    alert("Gagal kirim: " + e.message);
  }
}

async function executeShareWA() {
  if (!tempShareData) return;
  const { nama, id, loc, status, catatan, img1 } = tempShareData; // Hapus img2

  const caption = `*LAPORAN IT OPERASIONAL*\n🏢 PT Berlian Manyar Sejahtera\n\n📦 *ASET:* ${nama}\n🆔 *ID:* ${id}\n📍 *LOKASI:* ${loc}\n🔧 *STATUS:* ${status}\n📝 *NOTE:* ${catatan}\n👮 *OFFICER:* ${currentUser}`;

  const filesArray = [];
  if (img1) filesArray.push(new File([img1], "kondisi.jpg", { type: img1.type }));

  if (navigator.canShare && navigator.canShare({ files: filesArray })) {
    try {
      await navigator.share({ text: caption, files: filesArray });
    } catch (err) {}
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
  }
}

function closeSuccessModal() {
  closeModal("modalSuccess");
  closeForm();
  switchTab("home", document.querySelectorAll(".nav-btn")[0]);
  loadGlobalFeed(); // Refresh feed
}

// ================= QR CODE GENERATOR (MANUAL LOGO DRAWING & CUSTOM LAYOUT) =================

// Helper untuk memuat gambar logo secara manual (PASTI MUNCUL)
function loadLogoImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Mencegah error tainted canvas
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Logo gagal dimuat, lanjut tanpa logo.");
      resolve(null); // Jangan error, lanjut aja tanpa logo
    };
    img.src = src;
  });
}

function toggleLabelInputs() {
  const isLabelMode = document.getElementById("toggleLabelMode").checked;
  const extraInputs = document.getElementById("extraLabelInputs");
  const labelText = document.getElementById("labelModeText");

  if (isLabelMode) {
    extraInputs.classList.remove("hidden");
    labelText.innerText = "Label Lengkap";
    labelText.classList.replace("text-slate-400", "text-primary");
  } else {
    extraInputs.classList.add("hidden");
    labelText.innerText = "Hanya QR Code";
    labelText.classList.replace("text-primary", "text-slate-400");
  }
}

async function generateQR() {
  const id = document.getElementById("gen_qr_id").value.toUpperCase();
  const isLabelMode = document.getElementById("toggleLabelMode").checked;
  const canvasContainer = document.getElementById("qrcode_canvas");
  const resultArea = document.getElementById("qrResultArea");
  const tempContainer = document.getElementById("temp_qr_holder");

  if (!id) {
    alert("ID Aset wajib diisi!");
    return;
  }

  // UI Loading
  canvasContainer.innerHTML = '<span class="material-icons-round animate-spin text-slate-300">sync</span>';
  resultArea.classList.remove("hidden");
  tempContainer.innerHTML = "";

  // 1. GENERATE QR CODE MENTAH (TANPA LOGO DULU)
  // Kita gambar logo secara manual nanti agar tidak gagal load
  const qrSize = isLabelMode ? 220 : 300;

  const options = {
    text: id,
    width: qrSize,
    height: qrSize,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H, // Level Tinggi (30%) agar logo di tengah aman
    quietZone: 5,
    quietZoneColor: "#ffffff",
  };

  try {
    // Render QR Base
    new QRCode(tempContainer, options);

    // Load Gambar Logo Secara Manual (Parallel)
    const logoPromise = loadLogoImage("Berlian-Manyar-Sejahtera-New-Thumbnail.jpg");

    // Tunggu QR selesai render
    await new Promise((r) => setTimeout(r, 500));

    const qrCanvasMentah = tempContainer.querySelector("canvas");
    if (!qrCanvasMentah) throw new Error("Gagal render QR Base");

    // Tunggu Logo Selesai Download
    const logoImg = await logoPromise;

    // 2. SIAPKAN CANVAS FINAL
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (isLabelMode) {
      // === MODE LABEL STIKER (LAYOUT CUSTOM HITAM/PUTIH) ===
      const labelWidth = 800;
      const labelHeight = 320;
      canvas.width = labelWidth;
      canvas.height = labelHeight;

      // Data Input
      const nama = document.getElementById("gen_label_nama").value || "-";
      let tglRaw = document.getElementById("gen_label_tgl").value;
      let tglStr = "-";
      if (tglRaw) {
        const d = new Date(tglRaw);
        tglStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
      }
      const divisi = document.getElementById("gen_label_divisi").value || "-";

      // A. Background Dasar Putih
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, labelWidth, labelHeight);

      // B. Header Bar (Putih)
      const headerHeight = 70;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, labelWidth, headerHeight);

      // Text Header
      ctx.fillStyle = "#000000";
      ctx.font = "bold 28px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("PT Berlian Manyar Sejahtera", 25, headerHeight / 2);

      // Garis Pembatas Header
      ctx.beginPath();
      ctx.moveTo(0, headerHeight);
      ctx.lineTo(labelWidth, headerHeight);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000000";
      ctx.stroke();

      // C. Area Data (Kiri: Blok Hitam, Kanan: Putih)
      const contentStartY = headerHeight;
      const contentHeight = labelHeight - headerHeight;
      const leftColWidth = 220; // Lebar blok hitam

      // Blok Hitam di Kiri
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, contentStartY, leftColWidth, contentHeight);

      // D. Frame Luar
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, labelWidth - 4, labelHeight - 4);

      // E. Menggambar Baris Data
      const labels = ["Nama aset", "Nomor aset", "Tanggal", "Divisi"];
      const values = [nama, id, tglStr, divisi];

      const startY = contentStartY + 45;
      const rowGap = 55;

      labels.forEach((lbl, i) => {
        const currentY = startY + i * rowGap;

        // Label (Di area Hitam -> Putih)
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(lbl, 25, currentY);

        // Value (Di area Putih -> Hitam)
        ctx.fillStyle = "#000000";
        if (lbl === "Nomor aset") {
          ctx.font = "bold 26px monospace";
        } else {
          ctx.font = "bold 22px Arial, sans-serif";
        }
        ctx.fillText(values[i], leftColWidth + 25, currentY);

        // Garis Pemisah (Kecuali baris terakhir)
        if (i < labels.length - 1) {
          const lineY = currentY + 15;
          // Garis Putih di blok Hitam
          ctx.beginPath();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.moveTo(0, lineY);
          ctx.lineTo(leftColWidth, lineY);
          ctx.stroke();

          // Garis Hitam di blok Putih (Stop sebelum QR)
          ctx.beginPath();
          ctx.strokeStyle = "#000000";
          ctx.moveTo(leftColWidth, lineY);
          ctx.lineTo(labelWidth - 290, lineY);
          ctx.stroke();
        }
      });

      // F. Tempel QR Code (Kanan)
      const qrAreaX = labelWidth - 280;
      const qrFinalX = qrAreaX + (280 - qrSize) / 2;
      const qrFinalY = contentStartY + (contentHeight - qrSize) / 2;

      ctx.drawImage(qrCanvasMentah, qrFinalX, qrFinalY, qrSize, qrSize);

      // G. GAMBAR LOGO MANUAL DI TENGAH QR (PASTI MUNCUL)
      if (logoImg) {
        const logoSize = qrSize * 0.22; // 22% dari ukuran QR
        const logoX = qrFinalX + (qrSize - logoSize) / 2;
        const logoY = qrFinalY + (qrSize - logoSize) / 2;

        // Kotak Putih di belakang logo (biar bersih)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);

        // Gambar Logo
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      }
    } else {
      // === MODE HANYA QR (CENTERED) ===
      const padding = 25;
      canvas.width = qrSize + padding * 2;
      canvas.height = qrSize + padding * 2 + 50;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(qrCanvasMentah, padding, padding);

      // Gambar Logo Manual
      if (logoImg) {
        const logoSize = qrSize * 0.22;
        const logoX = padding + (qrSize - logoSize) / 2;
        const logoY = padding + (qrSize - logoSize) / 2;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(logoX - 3, logoY - 3, logoSize + 6, logoSize + 6);
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      }

      ctx.fillStyle = "#000000";
      ctx.font = "bold 24px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(id, canvas.width / 2, canvas.height - 20);
    }

    // OUTPUT
    canvasContainer.innerHTML = "";
    canvas.id = "finalLabelCanvas";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.className = "shadow-lg rounded-lg border border-slate-300";
    canvasContainer.appendChild(canvas);
  } catch (e) {
    console.error(e);
    canvasContainer.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Gagal generate: ${e.message}</p>`;
  }
}

function downloadQRImage() {
  const canvas = document.getElementById("finalLabelCanvas");
  if (!canvas) {
    alert("Generate dulu!");
    return;
  }
  const link = document.createElement("a");
  link.download = `QR_BMS_${document.getElementById("gen_qr_id").value}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ================= JURNAL SYNC & TOOLS =================
let isShowingAllJurnal = false; // Status apakah sedang menampilkan semua data atau cuma Today/Yesterday

async function loadServerJurnal() {
  const container = document.getElementById("jurnalContainer");
  // Tampilkan loading jika data kosong
  if (jurnalLog.length === 0) {
    container.innerHTML = `<div class="text-center py-4"><span class="material-icons-round animate-spin text-primary">sync</span></div>`;
  }

  try {
    const res = await fetch(`${API_URL}?action=get_jurnal`);
    const data = await res.json();
    jurnalLog = data; // Simpan ke global variable

    isShowingAllJurnal = false; // Reset filter saat load baru
    renderJurnal();
  } catch (e) {
    console.log(e);
    container.innerHTML = `<div class="text-center py-4 text-xs text-red-400">Gagal memuat data.</div>`;
  }
}

function renderJurnal() {
  const container = document.getElementById("jurnalContainer");
  const searchVal = document.getElementById("jurnalSearchInput").value.toLowerCase();
  const btnLoadMore = document.getElementById("btnLoadMoreJurnal");

  container.innerHTML = "";

  if (jurnalLog.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-slate-400 text-xs">Belum ada jurnal.</div>`;
    btnLoadMore.classList.add("hidden");
    return;
  }

  // 1. Filter Pencarian
  let filteredData = jurnalLog.filter((item) => {
    const text = (item.judul + " " + item.lokasi + " " + item.desc).toLowerCase();
    return text.includes(searchVal);
  });

  // 2. Filter Tanggal (Jika tidak sedang Search & Belum klik Load More)
  let hasHiddenData = false;

  if (!searchVal && !isShowingAllJurnal) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Reset jam agar perbandingan tanggal akurat
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);

    const recentData = [];
    const olderData = [];

    filteredData.forEach((item) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate >= yesterday) {
        recentData.push(item);
      } else {
        olderData.push(item);
      }
    });

    // Tampilkan hanya data terbaru
    filteredData = recentData;

    // Jika ada data lama yang disembunyikan, nyalakan tombol Load More
    if (olderData.length > 0) hasHiddenData = true;
  }

  // 3. Render Data ke HTML
  if (filteredData.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Tidak ditemukan data yang cocok.</div>`;
  } else {
    filteredData.forEach((item) => {
      // Logika Foto
      let imgHtml = "";
      if (item.foto && item.foto.includes("http")) {
        imgHtml = `<div class="mt-3 rounded-lg overflow-hidden border border-slate-100">
                              <img src="${item.foto}" class="w-full h-40 object-cover bg-slate-50" loading="lazy" referrerpolicy="no-referrer" alt="Foto Kegiatan">
                            </div>`;
      }

      const dateObj = new Date(item.date);
      const dateDisplay = dateObj.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
      const isToday = new Date().toDateString() === dateObj.toDateString();
      const dateBadgeColor = isToday ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500";

      const html = `
            <div class="relative flex gap-4 animate-fade-in pb-6">
                <div class="absolute left-[19px] top-8 bottom-0 w-0.5 bg-slate-200 -z-10"></div>
                
                <div class="flex-none w-10 h-10 rounded-full border-4 border-slate-50 bg-primary text-white shadow-sm flex items-center justify-center z-10">
                    <span class="material-icons-round text-sm">assignment</span>
                </div>

                <div class="flex-1 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex justify-between items-start mb-1">
                         <span class="text-[10px] font-bold ${dateBadgeColor} px-2 py-0.5 rounded">${dateDisplay}</span>
                         <span class="text-[9px] font-bold text-primary uppercase border border-primary/20 px-2 py-0.5 rounded-full">${item.petugas}</span>
                    </div>
                    <h4 class="font-bold text-slate-700 text-sm leading-tight">${item.judul}</h4>
                    <p class="text-[10px] text-slate-500 mb-2 flex items-center gap-1 mt-1">
                        <span class="material-icons-round text-[10px]">place</span> ${item.lokasi}
                    </p>
                    <p class="text-xs text-slate-600 border-t border-dashed border-slate-200 pt-2 leading-relaxed">${item.desc}</p>
                    ${imgHtml}
                </div>
            </div>`;
      container.innerHTML += html;
    });
  }

  // Atur visibilitas tombol Load More
  if (hasHiddenData && !searchVal) {
    btnLoadMore.classList.remove("hidden");
    btnLoadMore.innerHTML = `<button onclick="showOlderJurnal()" class="bg-white border border-slate-200 text-slate-500 px-4 py-2 rounded-full text-xs font-bold shadow-sm active:scale-95 hover:bg-slate-50">Muat Aktivitas Sebelumnya...</button>`;
  } else {
    btnLoadMore.classList.add("hidden");
  }
}

function showOlderJurnal() {
  isShowingAllJurnal = true; // Set flag untuk tampilkan semua
  renderJurnal(); // Render ulang
}
// Event Listener Scroll
window.onscroll = function () {
  scrollFunction();
};

function scrollFunction() {
  const btn = document.getElementById("btnBackToTop");
  if (!btn) return;

  // Muncul jika scroll lebih dari 300px
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    btn.classList.remove("hidden");
    // Sedikit delay biar class 'hidden' hilang dulu baru animasi masuk
    setTimeout(() => btn.classList.add("show"), 10);
  } else {
    btn.classList.remove("show");
    // Tunggu animasi out selesai baru hide
    setTimeout(() => btn.classList.add("hidden"), 300);
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function submitJurnal() {
  const judul = document.getElementById("jurnal_judul").value;
  const lokasi = document.getElementById("jurnal_lokasi").value;
  const desc = document.getElementById("jurnal_desc").value;
  const file = document.getElementById("file_jurnal").files[0];

  if (!judul || !desc) {
    alert("Data tidak lengkap!");
    return;
  }

  document.getElementById("loadingText").innerText = "POSTING JURNAL...";
  openModal("modalLoading");

  try {
    const base64Foto = file ? await toBase64(file) : "";
    const payload = { type: "jurnal", judul, lokasi, deskripsi: desc, foto: base64Foto, petugas: currentUser };

    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });

    loadServerJurnal(); // Refresh data
    closeModal("modalLoading");
    closeModal("modalJurnal");
    alert("Jurnal Tersimpan!");

    // Reset form
    document.getElementById("jurnal_judul").value = "";
    document.getElementById("jurnal_desc").value = "";
  } catch (e) {
    closeModal("modalLoading");
    alert("Gagal: " + e.message);
  }
}

// ================= STATS DASHBOARD =================
function switchHomeSub(view) {
  const btnFeed = document.getElementById("btnSubFeed");
  const btnStats = document.getElementById("btnSubStats");
  const bg = document.getElementById("subTabBg");
  const viewFeed = document.getElementById("view-feed");
  const viewStats = document.getElementById("view-stats");

  if (view === "feed") {
    bg.style.transform = "translateX(0)";
    btnFeed.className = "flex-1 relative z-10 py-2 text-xs font-bold text-center text-primary transition-colors";
    btnStats.className = "flex-1 relative z-10 py-2 text-xs font-bold text-center text-slate-500 transition-colors";
    viewFeed.classList.remove("hidden");
    viewStats.classList.add("hidden");
  } else {
    bg.style.transform = "translateX(100%)";
    btnStats.className = "flex-1 relative z-10 py-2 text-xs font-bold text-center text-primary transition-colors";
    btnFeed.className = "flex-1 relative z-10 py-2 text-xs font-bold text-center text-slate-500 transition-colors";
    viewStats.classList.remove("hidden");
    viewFeed.classList.add("hidden");
    if (!statsDataCache) loadDashboardStats();
  }
}

async function loadDashboardStats() {
  const container = document.getElementById("categoryListContainer");

  // 1. UI LOADING STATE (PENTING: Biar user gak kaget liat angka 0)
  // Kita ganti angka dengan animasi titik-titik (...)
  const loadingIndicator = '<span class="animate-pulse tracking-widest">...</span>';

  document.getElementById("totalAssetStat").innerHTML = loadingIndicator;
  document.getElementById("countNormal").innerHTML = loadingIndicator;
  document.getElementById("countMaint").innerHTML = loadingIndicator;
  document.getElementById("countRusak").innerHTML = loadingIndicator;

  // Spinner di bagian list bawah
  container.innerHTML = '<div class="text-center py-8 flex flex-col items-center opacity-50"><span class="material-icons-round animate-spin text-2xl text-primary mb-2">sync</span><span class="text-xs">Mengambil data...</span></div>';

  try {
    const res = await fetch(`${API_URL}?action=get_stats`);
    const data = await res.json();
    statsDataCache = data.details;

    // Hitung Total untuk Persentase
    const total = data.counts.Total || 1; // Hindari pembagian 0

    // 2. UPDATE ANGKA & PERSENTASE (IMPROVEMENT)
    // Helper kecil untuk hitung %
    const getPct = (val) => Math.round((val / total) * 100) + "%";

    // Render Chart
    renderChart(data.counts);

    // Update Text Angka
    // Kita pakai innerHTML biar bisa styling ukuran font % nya lebih kecil
    document.getElementById("countNormal").innerHTML = `
            ${data.counts.Normal} 
            <span class="text-[9px] opacity-60 font-normal block">${getPct(data.counts.Normal)}</span>
        `;
    document.getElementById("countMaint").innerHTML = `
            ${data.counts.Maintenance}
            <span class="text-[9px] opacity-60 font-normal block">${getPct(data.counts.Maintenance)}</span>
        `;
    document.getElementById("countRusak").innerHTML = `
            ${data.counts.Rusak}
            <span class="text-[9px] opacity-60 font-normal block">${getPct(data.counts.Rusak)}</span>
        `;

    // Default tampilkan list Normal
    renderCategoryList("Normal");
  } catch (e) {
    console.log(e);
    container.innerHTML = `<div class="text-center py-4 text-xs text-red-400">Gagal memuat statistik. <br> Cek koneksi internet.</div>`;

    // Kembalikan ke 0 atau tanda strip jika gagal
    document.getElementById("totalAssetStat").innerText = "-";
    document.getElementById("countNormal").innerText = "-";
  }
}

function renderCategoryList(category) {
  // 1. Atur Tampilan Tombol Tab Aktif
  document.querySelectorAll(".stat-tab").forEach((el) => {
    el.className = "stat-tab py-2 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center transition-all opacity-60 scale-95";
  });
  let btnId = "btnCatNormal";
  if (category === "Maintenance") btnId = "btnCatMaint";
  if (category === "Rusak") btnId = "btnCatRusak";

  const activeBtn = document.getElementById(btnId);
  if (activeBtn) {
    activeBtn.className = "stat-tab active py-2 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-md flex flex-col items-center justify-center transition-all scale-100";
  }

  // 2. Render List Item
  const container = document.getElementById("categoryListContainer");
  container.innerHTML = "";

  // Ambil data dari cache (hasil fetch get_stats)
  const list = statsDataCache ? statsDataCache[category] || [] : [];

  if (list.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-4 border border-dashed border-slate-200 rounded-xl">Tidak ada aset ${category}.</div>`;
    return;
  }

  list.forEach((item) => {
    let borderClass = "border-emerald-400";
    if (category === "Maintenance") borderClass = "border-amber-400";
    if (category === "Rusak") borderClass = "border-red-500";

    const div = document.createElement("div");
    div.className = `bg-white p-3 rounded-xl border-l-4 ${borderClass} shadow-sm mb-2 active:scale-[0.98] transition-transform cursor-pointer flex justify-between items-center`;

    // --- TAMBAHAN PENTING: ONCLICK ---
    // Saat diklik, panggil fungsi buka detail
    div.onclick = () => openAssetDetail(item, category);

    div.innerHTML = `
            <div>
                <h4 class="text-xs font-bold text-slate-700">${item.name}</h4>
                <p class="text-[9px] font-mono text-slate-400">${item.id} • ${item.location}</p>
            </div>
            <span class="material-icons-round text-slate-300 text-sm">chevron_right</span>
        `;
    container.appendChild(div);
  });
}

function renderChart(stats) {
  // Animasi angka total naik (Optional Polish)
  document.getElementById("totalAssetStat").innerText = stats.Total;

  const ctx = document.getElementById("chartStatus").getContext("2d");
  if (window.myChart) window.myChart.destroy();

  window.myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Normal", "Maint.", "Rusak"],
      datasets: [
        {
          data: [stats.Normal, stats.Maintenance, stats.Rusak],
          backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
          borderWidth: 0,
          hoverOffset: 10, // Efek saat hover lebih menonjol
        },
      ],
    },
    options: {
      responsive: true,
      cutout: "75%",
      animation: {
        animateScale: true,
        animateRotate: true,
      },
      plugins: { legend: { display: false } },
    },
  });
}

// ================= UTILS (TOOLS, IMG, NEW ASSET) =================
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const cvs = document.createElement("canvas");
        const scale = 800 / img.width;
        cvs.width = 800;
        cvs.height = img.height * scale;
        cvs.getContext("2d").drawImage(img, 0, 0, cvs.width, cvs.height);
        resolve(cvs.toDataURL("image/jpeg", 0.6));
      };
    };
    reader.onerror = reject;
  });
}

function previewImg(input, imgId) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const el = document.getElementById(imgId);
      el.src = e.target.result;
      el.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function submitNewAsset() {
  const id = document.getElementById("new_id").value;
  const name = document.getElementById("new_name").value;
  const loc = document.getElementById("new_loc").value;
  const date = document.getElementById("new_date").value;

  if (!id || !name) {
    alert("ID & Nama wajib diisi!");
    return;
  }

  // Tampilkan Loading
  document.getElementById("loadingText").innerText = "MENYIMPAN DATA...";
  openModal("modalLoading");

  try {
    // 1. Kirim Data ke Google Sheet
    const payload = { type: "new_asset", id, name, location: loc, date };
    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });

    // 2. Tutup Loading & Modal Tambah Aset
    closeModal("modalLoading");
    closeModal("modalAddAsset");

    // 3. --- ALUR BARU: AUTO-GENERATE LABEL ---
    // Pindahkan data yang barusan diketik ke form QR Generator
    document.getElementById("gen_qr_id").value = id;
    document.getElementById("gen_label_nama").value = name;
    document.getElementById("gen_label_divisi").value = loc;
    document.getElementById("gen_label_tgl").value = date;

    // Paksa Mode "Label Lengkap" (Toggle ON)
    const toggle = document.getElementById("toggleLabelMode");
    if (!toggle.checked) {
      toggle.checked = true;
      toggleLabelInputs(); // Panggil fungsi ini agar form input label muncul
    }

    // Buka Modal Generator
    openModal("modalQRGenerator");

    // Jalankan Generate Otomatis (Kasih jeda dikit biar modal render dulu)
    setTimeout(() => {
      generateQR(); // Fungsi sakti yang tadi kita buat
    }, 300);

    // 4. Bersihkan Form Tambah Aset (Reset)
    document.getElementById("new_id").value = "";
    document.getElementById("new_name").value = "";
    document.getElementById("new_loc").value = "";
  } catch (e) {
    closeModal("modalLoading");
    alert("Gagal menyimpan: " + e.message);
  }
}

// Render Tools (Utility)
function renderTools() {
  const container = document.getElementById("toolsContainer");
  if (!container) return;
  container.innerHTML = "";
  myTools.forEach((tool) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex gap-3 mb-2";
    div.innerHTML = `
            <div class="bg-blue-50 p-2 rounded-lg text-primary h-fit"><span class="material-icons-round">${tool.icon || "build"}</span></div>
            <div class="flex-1 overflow-hidden">
                <h3 class="font-bold text-sm text-slate-700">${tool.name}</h3>
                <p class="text-xs text-slate-500 mb-2">${tool.desc}</p>
                <div class="bg-slate-800 text-green-400 p-2 rounded text-[10px] font-mono overflow-x-auto whitespace-nowrap scrollbar-hide">${tool.cmd}</div>
                <button onclick="copyScript('${tool.cmd.replace(/'/g, "\\'")}')" class="mt-2 text-[10px] font-bold text-accent bg-orange-50 px-3 py-1 rounded">COPY SCRIPT</button>
            </div>`;
    container.appendChild(div);
  });
}

function copyScript(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => alert("Script Copied!"))
    .catch(() => alert("Copy Manual!"));
}

// Tambahkan logika Open/Save/Delete Tool Modal dari kode lamamu di sini jika sering dipakai edit tool
function openToolModal() {
  openModal("modalTool");
} // Sederhana
function saveTool() {
  alert("Simpan Tool hanya lokal sementara.");
  closeModal("modalTool");
}

function openAssetDetail(item, status) {
  // Isi Data Teks
  document.getElementById("detailName").innerText = item.name;
  document.getElementById("detailDate").innerText = "Terakhir dicek: " + new Date(item.date).toLocaleDateString("id-ID");
  document.getElementById("detailNote").innerText = item.note || "-";

  const badge = document.getElementById("detailStatusBadge");
  badge.innerText = status;
  badge.className = `px-2 py-1 rounded text-[10px] font-bold uppercase mb-1 inline-block ${status === "Rusak" ? "bg-red-100 text-red-600" : status === "Maintenance" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`;

  // --- LOGIKA FOTO ---
  const btn = document.getElementById("btnLoadImg");
  const wrapper = document.getElementById("imgWrapper");
  const img = document.getElementById("detailImgDisplay");

  wrapper.classList.add("hidden");
  img.src = "";

  // Cek URL foto dari Backend (Sekarang Code.gs sudah kirim data 'photo')
  if (item.photo && item.photo.length > 10) {
    currentDetailPhotoUrl = item.photo;
    btn.classList.remove("hidden");
    btn.innerText = "LIHAT FOTO TERAKHIR";
    btn.disabled = false;
    btn.onclick = loadDetailImage; // Re-bind onclick
  } else {
    currentDetailPhotoUrl = "";
    btn.classList.add("hidden");
  }
  openModal("modalAssetDetail");
}

function loadDetailImage() {
  const btn = document.getElementById("btnLoadImg");
  const wrapper = document.getElementById("imgWrapper");
  const img = document.getElementById("detailImgDisplay");

  if (!currentDetailPhotoUrl) return;

  btn.innerHTML = `<span class="material-icons-round animate-spin">sync</span> MEMUAT...`;
  btn.disabled = true;

  img.src = currentDetailPhotoUrl;
  img.onload = () => {
    wrapper.classList.remove("hidden");
    btn.classList.add("hidden");
  };
  img.onerror = () => {
    btn.innerText = "FOTO TIDAK DITEMUKAN / ERROR";
    btn.className = "w-full bg-red-50 text-red-500 py-3 rounded-xl font-bold text-xs";
  };
}

// ================= INSTALL GUIDE LOGIC =================

// Cek saat aplikasi pertama kali dimuat
document.addEventListener("DOMContentLoaded", () => {
  // Panggil pengecekan Full Screen
  setTimeout(checkInstallation, 2000); // Delay 2 detik biar gak kaget pas baru buka
});

function checkInstallation() {
  // Cek apakah sudah Full Screen (Standalone Mode)
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  // Cek apakah user pernah menutup permanen
  const hasSeenGuide = localStorage.getItem("bms_install_guide_seen");

  // Jika BUKAN standalone DAN Belum pernah ditutup permanen -> Tampilkan Modal
  if (!isStandalone && !hasSeenGuide) {
    openModal("modalInstall");
  }
}

function closeInstallGuide(permanent = false) {
  closeModal("modalInstall");
  if (permanent) {
    localStorage.setItem("bms_install_guide_seen", "true");
  }
}
