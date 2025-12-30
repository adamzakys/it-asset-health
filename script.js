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
    if (item.type === "LAPOR") {
      icon = "build";
      color = "bg-orange-50 text-accent";
    }
    if (item.type === "JURNAL") {
      icon = "assignment";
      color = "bg-blue-50 text-primary";
    }
    if (item.type === "INPUT") {
      icon = "add_circle";
      color = "bg-emerald-50 text-emerald-600";
    }

    const itemDate = new Date(item.timestamp);
    const today = new Date();
    const isToday = itemDate.getDate() === today.getDate();
    const timeLabel = isToday ? itemDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Kemarin";

    const div = document.createElement("div");
    div.className = "bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 animate-fade-in";
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
  // 1. Bersihkan elemen reader
  const readerElem = document.getElementById("reader");
  if (!readerElem) return;
  readerElem.innerHTML = "";

  // 2. Clear instance lama jika ada
  if (html5QrcodeScanner) {
    try {
      html5QrcodeScanner.clear();
    } catch (e) {}
  }

  // 3. Init baru
  const html5QrCode = new Html5Qrcode("reader");
  html5QrcodeScanner = html5QrCode;

  const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

  html5QrCode
    .start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        // -- SUKSES SCAN --
        console.log("QR Code:", decodedText);

        // Matikan kamera segera
        html5QrCode
          .stop()
          .then(() => {
            closeModal("modalScanner");

            // Cek Mode: Input ID atau Cari Data
            if (targetInputId) {
              document.getElementById(targetInputId).value = decodedText;
              targetInputId = null;
            } else {
              fetchData("scan", decodedText);
            }
          })
          .catch((err) => console.error("Stop failed", err));
      },
      (errorMessage) => {
        // Ignore frame errors
      }
    )
    .catch((err) => {
      alert("Gagal membuka kamera. Izinkan akses kamera di browser.");
      closeModal("modalScanner");
    });
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
async function fetchData(action, query) {
  document.getElementById("loadingText").innerText = "MENCARI DATA...";
  openModal("modalLoading");

  try {
    const res = await fetch(`${API_URL}?action=${action}&q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.length === 0) {
      if (action === "scan") {
        if (confirm(`ID: ${query}\nData tidak ditemukan.\n\nTambah ke Master Aset?`)) {
          openModal("modalAddAsset");
          document.getElementById("new_id").value = query;
        }
      } else {
        alert("Data tidak ditemukan.");
        renderSearchResults([]);
      }
    } else {
      if (action === "scan" && data.length === 1) {
        // Jika hasil scan cuma 1 (pasti ID unik), langsung buka form
        openForm(data[0]);
      } else {
        // Jika hasil search banyak
        renderSearchResults(data);
        switchTab("patrol", document.querySelectorAll(".nav-btn")[1]);
      }
    }
  } catch (e) {
    alert("Gagal koneksi: " + e.message);
  } finally {
    closeModal("modalLoading");
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
  currentAsset = item;
  resetFormUI();

  document.getElementById("patrol-list-view").classList.add("hidden");
  document.getElementById("patrol-form-view").classList.remove("hidden");

  document.getElementById("formAssetName").innerText = item.name;
  document.getElementById("formAssetLoc").innerText = item.location;
  document.getElementById("formAssetId").innerText = item.id;

  loadAssetHistory(item.name);
}

function resetFormUI() {
  document.getElementById("catatanInput").value = "";
  setStatus("Normal", document.querySelector(".status-btn")); // Reset ke Normal

  // Reset File Inputs
  document.getElementById("file_img1").value = "";
  document.getElementById("file_img2").value = "";
  document.getElementById("prev_img1").classList.add("hidden");
  document.getElementById("prev_img2").classList.add("hidden");

  // Reset History UI
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

  document.getElementById("loadingText").innerText = "MENYIMPAN...";
  openModal("modalLoading");

  try {
    const img1 = document.getElementById("file_img1").files[0];
    const img2 = document.getElementById("file_img2").files[0];

    const payload = {
      type: "laporan",
      namaAset: currentAsset.name,
      lokasi: currentAsset.location,
      status: status,
      catatan: catatan,
      petugas: currentUser,
      fotoKondisi: img1 ? await toBase64(img1) : "",
      fotoQR: img2 ? await toBase64(img2) : "",
    };

    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });

    // Siapkan Share WA Data
    tempShareData = {
      nama: currentAsset.name,
      id: currentAsset.id,
      loc: currentAsset.location,
      status: status,
      catatan: catatan,
      img1: img1,
      img2: img2,
    };

    closeModal("modalLoading");
    openModal("modalSuccess");

    // Setup tombol WA
    document.getElementById("btnShareWA").onclick = executeShareWA;
  } catch (e) {
    closeModal("modalLoading");
    alert("Gagal kirim: " + e.message);
  }
}

async function executeShareWA() {
  if (!tempShareData) return;
  const { nama, id, loc, status, catatan, img1, img2 } = tempShareData;

  const caption = `*LAPORAN IT OPERASIONAL*\n🏢 PT Berlian Manyar Sejahtera\n\n📦 *ASET:* ${nama}\n🆔 *ID:* ${id}\n📍 *LOKASI:* ${loc}\n🔧 *STATUS:* ${status}\n📝 *NOTE:* ${catatan}\n👮 *OFFICER:* ${currentUser}`;

  const filesArray = [];
  if (img1) filesArray.push(new File([img1], "kondisi.jpg", { type: img1.type }));

  if (navigator.canShare && navigator.canShare({ files: filesArray })) {
    try {
      await navigator.share({ text: caption, files: filesArray });
    } catch (err) {
      console.log("Share canceled");
    }
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

// ================= QR CODE GENERATOR (CENTERED & LABEL) =================
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

  canvasContainer.innerHTML = '<span class="material-icons-round animate-spin text-slate-300">sync</span>';
  resultArea.classList.remove("hidden");
  tempContainer.innerHTML = "";

  const qrSize = isLabelMode ? 200 : 300;
  const options = {
    text: id,
    width: qrSize,
    height: qrSize,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
    logo: "Berlian-Manyar-Sejahtera-New-Thumbnail.jpg", // FILE LOGO WAJIB ADA
    logoWidth: 50,
    logoHeight: 50,
    logoBackgroundColor: "#ffffff",
    logoBackgroundTransparent: false,
    quietZone: 5,
    quietZoneColor: "#ffffff",
  };

  try {
    new QRCode(tempContainer, options);
    await new Promise((r) => setTimeout(r, 600)); // Tunggu render

    const qrCanvasMentah = tempContainer.querySelector("canvas");
    if (!qrCanvasMentah) throw new Error("Gagal render QR Base");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (isLabelMode) {
      // -- MODE LABEL STIKER --
      const labelWidth = 600;
      const labelHeight = 350;
      canvas.width = labelWidth;
      canvas.height = labelHeight;

      // Background & Decor
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, labelWidth, labelHeight);
      ctx.fillStyle = "#2596be";
      ctx.fillRect(0, 0, 15, labelHeight); // Blue Strip

      // Text Data
      const nama = document.getElementById("gen_label_nama").value || "ASSET ITEM";
      const lokasi = document.getElementById("gen_label_divisi").value || "-";
      const tgl = document.getElementById("gen_label_tgl").value || "-";

      ctx.fillStyle = "#000000";
      ctx.font = "bold 18px Arial";
      ctx.fillText("PT BERLIAN MANYAR SEJAHTERA", 35, 40);

      ctx.beginPath();
      ctx.moveTo(35, 55);
      ctx.lineTo(labelWidth - 20, 55);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "bold 36px Arial";
      ctx.fillText(id, 35, 110);
      ctx.font = "20px Arial";
      ctx.fillStyle = "#475569";
      ctx.fillText(nama, 35, 150);
      ctx.font = "14px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Lokasi: ${lokasi}`, 35, 180);
      ctx.fillText(`Tgl: ${tgl}`, 35, 200);

      // Draw QR on Right Center
      const qrX = labelWidth - qrSize - 20;
      const qrY = (labelHeight - qrSize) / 2 + 10;
      ctx.drawImage(qrCanvasMentah, qrX, qrY, qrSize, qrSize);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, labelWidth, labelHeight); // Border
    } else {
      // -- MODE ONLY QR (CENTERED) --
      const padding = 20;
      canvas.width = qrSize + padding * 2;
      canvas.height = qrSize + padding * 2 + 40;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrCanvasMentah, padding, padding);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 20px Courier New";
      ctx.textAlign = "center";
      ctx.fillText(id, canvas.width / 2, canvas.height - 15);
    }

    canvasContainer.innerHTML = "";
    canvas.id = "finalLabelCanvas";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.className = "shadow-sm rounded border border-slate-200";
    canvasContainer.appendChild(canvas);
  } catch (e) {
    alert("Error: " + e.message);
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
async function loadServerJurnal() {
  const container = document.getElementById("jurnalContainer");
  container.innerHTML = `<div class="text-center py-4"><span class="material-icons-round animate-spin text-primary">sync</span></div>`;
  try {
    const res = await fetch(`${API_URL}?action=get_jurnal`);
    const data = await res.json();
    jurnalLog = data; // Sync global var
    renderJurnal();
  } catch (e) {
    console.log(e);
  }
}

function renderJurnal() {
  const container = document.getElementById("jurnalContainer");
  container.innerHTML = "";
  jurnalLog.forEach((item) => {
    const timeDisplay = item.time ? `• ${item.time}` : "";
    const imgHtml = item.foto && item.foto.length > 10 ? `<img src="${item.foto}" class="w-full h-32 object-cover rounded-lg mt-2 border" loading="lazy">` : "";

    const html = `
        <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in">
            <div class="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-accent text-white shadow-sm shrink-0 z-10">
                <span class="material-icons-round text-sm">work</span>
            </div>
            <div class="w-[calc(100%-3.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative ml-4">
                <div class="flex justify-between items-start mb-1">
                     <span class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">${item.date}</span>
                     <span class="text-[9px] font-bold text-primary uppercase bg-blue-50 px-2 py-1 rounded-full">${item.petugas}</span>
                </div>
                <h4 class="font-bold text-slate-700 text-sm">${item.judul}</h4>
                <p class="text-xs text-slate-500 mb-2 flex items-center gap-1"><span class="material-icons-round text-[10px]">place</span> ${item.lokasi}</p>
                <p class="text-xs text-slate-600 border-t pt-2">${item.desc}</p>
                ${imgHtml}
            </div>
        </div>`;
    container.innerHTML += html;
  });
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
  container.innerHTML = '<div class="text-center py-4"><span class="material-icons-round animate-spin">sync</span></div>';

  try {
    const res = await fetch(`${API_URL}?action=get_stats`);
    const data = await res.json();
    statsDataCache = data.details;

    renderChart(data.counts);
    document.getElementById("countNormal").innerText = data.counts.Normal;
    document.getElementById("countMaint").innerText = data.counts.Maintenance;
    document.getElementById("countRusak").innerText = data.counts.Rusak;

    renderCategoryList("Normal");
  } catch (e) {
    console.log(e);
  }
}

function renderCategoryList(category) {
  // UI Tab Active State
  document.querySelectorAll(".stat-tab").forEach((el) => {
    el.className = "stat-tab py-2 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center transition-all opacity-60 scale-95";
  });
  let btnId = "btnCatNormal";
  if (category === "Maintenance") btnId = "btnCatMaint";
  if (category === "Rusak") btnId = "btnCatRusak";
  document.getElementById(btnId).className = "stat-tab active py-2 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-md flex flex-col items-center justify-center transition-all scale-100";

  const container = document.getElementById("categoryListContainer");
  container.innerHTML = "";
  const list = statsDataCache ? statsDataCache[category] || [] : [];

  if (list.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">Kosong.</div>`;
    return;
  }

  list.forEach((item) => {
    let border = "border-emerald-400";
    if (category === "Maintenance") border = "border-amber-400";
    if (category === "Rusak") border = "border-red-500";

    const div = document.createElement("div");
    div.className = `bg-white p-3 rounded-xl border-l-4 ${border} shadow-sm mb-2`;
    div.innerHTML = `
            <h4 class="text-xs font-bold text-slate-700">${item.name}</h4>
            <p class="text-[9px] font-mono text-slate-400">${item.id}</p>
        `;
    container.appendChild(div);
  });
}

function renderChart(stats) {
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
        },
      ],
    },
    options: { responsive: true, cutout: "75%", plugins: { legend: { display: false } } },
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
    alert("ID & Nama wajib!");
    return;
  }

  document.getElementById("loadingText").innerText = "INPUT DATA...";
  openModal("modalLoading");

  try {
    const payload = { type: "new_asset", id, name, location: loc, date };
    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    alert("Aset Berhasil Ditambahkan!");
    closeModal("modalAddAsset");
    document.getElementById("new_id").value = "";
    document.getElementById("new_name").value = "";
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    closeModal("modalLoading");
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
