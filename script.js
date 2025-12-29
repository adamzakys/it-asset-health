// ================= KONFIGURASI =================
// ⚠️ Pastikan URL ini benar
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

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  updateProfileUI();
  renderLog();
  renderTools();
  renderJurnal();
  // 1. Setup Tanggal Default
  if (document.getElementById("new_date")) {
    document.getElementById("new_date").valueAsDate = new Date();
  }

  // 2. SETUP LINK WA BANTUAN (Hybrid Mode)
  // Ini menangani jika elemen adalah <a> tag
  const _p = ["62", "831", "2993", "9682"];
  const _msg = "Halo Admin IT, saya butuh bantuan aplikasi BMS Asset Ops.";
  const _link = `https://wa.me/${_p.join("")}?text=${encodeURIComponent(_msg)}`;

  const btnHelp = document.getElementById("btnHelpWA");
  if (btnHelp) {
    btnHelp.href = _link; // Jika tag <a>
    // Jika tag <button>, kita paksa override onclick lewat JS juga biar aman
    btnHelp.onclick = () => {
      window.location.href = _link;
    };
  }
});

// 3. FUNGSI MANUAL TOMBOL BANTUAN (Wajib ada untuk backup)
function triggerHelpWA() {
  const _p = ["62", "831", "2993", "9682"];
  const _msg = "Halo Admin IT, saya butuh bantuan aplikasi BMS Asset Ops.";
  // Menggunakan location.href agar HP merespon pindah aplikasi
  window.location.href = `https://wa.me/${_p.join("")}?text=${encodeURIComponent(_msg)}`;
}

// ================= NAVIGASI =================
function switchTab(tabName, btn) {
  document.querySelectorAll(".tab-section").forEach((el) => el.classList.remove("active"));
  setTimeout(() => {
    document.querySelectorAll(".tab-section").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
      target.classList.remove("hidden");
      setTimeout(() => target.classList.add("active"), 10);
    }
  }, 100);

  document.querySelectorAll(".nav-btn").forEach((el) => {
    el.classList.remove("active", "text-primary");
    el.classList.add("text-slate-400");
  });

  if (btn) {
    btn.classList.add("active", "text-primary");
    btn.classList.remove("text-slate-400");
  }

  const titles = { home: "Beranda", patrol: "Patroli Asset", tools: "IT Utilities", log: "Logbook" };
  const headerEl = document.getElementById("headerTitle");
  if (headerEl) headerEl.innerText = titles[tabName] || "BMS Asset";

  // --- TRIGGER UPDATE OTOMATIS (BARU) ---
  if (tabName === "jurnal") {
    loadServerJurnal(); // Panggil data server
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.replace("hidden", "flex");
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.replace("flex", "hidden");
}

// ================= PROFILE & LOG =================
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

function addLog(type, title, desc) {
  const item = { type, title, desc, time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) };
  activityLog.unshift(item);
  if (activityLog.length > 20) activityLog.pop();
  localStorage.setItem("bms_log", JSON.stringify(activityLog));
  renderLog();
}

function clearLog() {
  if (confirm("Hapus riwayat?")) {
    activityLog = [];
    localStorage.removeItem("bms_log");
    renderLog();
  }
}

function renderLog() {
  const container = document.getElementById("unifiedActivityLog");
  if (!container) return;

  container.innerHTML = "";
  if (activityLog.length === 0) {
    container.innerHTML = `<div class="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">Belum ada aktivitas.</div>`;
    return;
  }
  activityLog.forEach((item) => {
    let icon = "history";
    let color = "bg-slate-100 text-slate-500";
    if (item.type === "SCAN") {
      icon = "qr_code_scanner";
      color = "bg-blue-50 text-primary";
    }
    if (item.type === "INPUT") {
      icon = "add_circle";
      color = "bg-emerald-50 text-emerald-600";
    }
    if (item.type === "LAPOR") {
      icon = "assignment_turned_in";
      color = "bg-orange-50 text-accent";
    }

    const div = document.createElement("div");
    div.className = "bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 animate-fade-in active:scale-[0.98] transition-transform";
    div.innerHTML = `
            <div class="${color} p-2 rounded-full h-10 w-10 flex items-center justify-center shadow-sm"><span class="material-icons-round text-lg">${icon}</span></div>
            <div class="flex-1"><h4 class="text-sm font-bold text-slate-700">${item.title}</h4><p class="text-[10px] text-slate-400">${item.desc}</p></div>
            <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">${item.time}</span>
        `;
    container.appendChild(div);
  });
}

// ================= CORE: SEARCH & SCAN =================
async function fetchData(action, query) {
  // Mode Scan untuk Input ID
  if (action === "scan" && targetInputId) {
    document.getElementById(targetInputId).value = query;
    targetInputId = null;
    return;
  }

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
        addLog("SCAN", data[0].name, `ID: ${data[0].id}`);
        openForm(data[0]);
      } else {
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
            <div class="text-[10px] bg-slate-100 inline-block px-2 py-0.5 rounded mt-2 text-slate-400 font-mono border border-slate-200">${item.id}</div>
        `;
    container.appendChild(div);
  });
}

// ================= SCANNER LOGIC =================
function startScanner() {
  targetInputId = null;
  openModal("modalScanner");
  startHtml5Scanner();
}

function scanForInput(inputId) {
  targetInputId = inputId;
  openModal("modalScanner");
  startHtml5Scanner();
}

function startHtml5Scanner() {
  html5QrcodeScanner = new Html5Qrcode("reader");
  html5QrcodeScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (txt) => {
        stopScanner();
        fetchData("scan", txt);
      },
      () => {}
    )
    .catch((err) => {
      alert("Camera Error: " + err);
      closeModal("modalScanner");
    });
}

function stopScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      closeModal("modalScanner");
    });
  } else closeModal("modalScanner");
}

// ================= TOOLS =================
function renderTools() {
  const container = document.getElementById("toolsContainer");
  if (!container) return;
  container.innerHTML = "";
  myTools.forEach((tool) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative group transition-all hover:shadow-md";

    const btnEdit = `<button onclick="openToolModal(${tool.id})" class="absolute top-2 right-2 text-slate-300 hover:text-accent p-2 rounded-full hover:bg-slate-50 transition-colors"><span class="material-icons-round text-sm">edit</span></button>`;

    let extraMedia = "";
    if (tool.qr && tool.qr.startsWith("http")) {
      extraMedia += `<div class="mt-2 text-center"><img src="${tool.qr}" class="h-24 mx-auto border p-1 rounded bg-white shadow-sm"></div>`;
    }
    if (tool.imgUrl && tool.imgUrl.startsWith("http")) {
      extraMedia += `<div class="mt-2 text-center"><img src="${tool.imgUrl}" class="w-full h-auto rounded-lg border border-slate-200 shadow-sm object-cover max-h-40"></div>`;
    }

    div.innerHTML = `
            ${btnEdit}
            <div class="flex gap-3">
                <div class="bg-primary/10 p-2.5 rounded-xl text-primary h-fit shadow-sm border border-blue-100">
                    <span class="material-icons-round">${tool.icon || "build"}</span>
                </div>
                <div class="flex-1 overflow-hidden">
                    <h3 class="font-bold text-primary text-sm">${tool.name}</h3>
                    <p class="text-xs text-slate-500 mb-2">${tool.desc}</p>
                    
                    <div class="bg-slate-800 text-green-400 p-2.5 rounded-lg text-[10px] font-mono mb-2 overflow-x-auto whitespace-nowrap scrollbar-hide shadow-inner border border-slate-700">
                        ${tool.cmd}
                    </div>
                    
                    <button onclick="copyScript('${tool.cmd.replace(
                      /'/g,
                      "\\'"
                    )}')" class="text-[10px] font-bold text-accent bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-lg active:scale-90 transition-transform flex items-center gap-1">
                        <span class="material-icons-round text-[10px]">content_copy</span> Copy Script
                    </button>
                    ${extraMedia}
                </div>
            </div>
        `;
    container.appendChild(div);
  });
}

function copyScript(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => alert("✅ Script Copied!"))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
    alert("✅ Script Copied (Fallback)!");
  } catch (err) {
    alert("Gagal copy manual.");
  }
  document.body.removeChild(textArea);
}

function openToolModal(id = null) {
  document.getElementById("toolModalTitle").innerText = id ? "Edit Tool" : "Tambah Tool";
  document.getElementById("btnDeleteTool").classList.toggle("hidden", !id);

  // Helper reset value
  const setValue = (elId, val) => {
    if (document.getElementById(elId)) document.getElementById(elId).value = val;
  };

  if (id) {
    const tool = myTools.find((t) => t.id === id);
    setValue("tool_id", tool.id);
    setValue("tool_name", tool.name);
    setValue("tool_desc", tool.desc);
    setValue("tool_icon", tool.icon);
    setValue("tool_cmd", tool.cmd);
    setValue("tool_qr", tool.qr);
    setValue("tool_img", tool.imgUrl || "");
  } else {
    setValue("tool_id", "");
    setValue("tool_name", "");
    setValue("tool_desc", "");
    setValue("tool_icon", "");
    setValue("tool_cmd", "");
    setValue("tool_qr", "");
    setValue("tool_img", "");
  }
  openModal("modalTool");
}

function saveTool() {
  const id = document.getElementById("tool_id").value;
  const name = document.getElementById("tool_name").value;
  const desc = document.getElementById("tool_desc").value;
  const icon = document.getElementById("tool_icon").value;
  const cmd = document.getElementById("tool_cmd").value;
  const qr = document.getElementById("tool_qr").value;
  const imgUrl = document.getElementById("tool_img").value;

  if (!name || !cmd) {
    alert("Nama dan Command wajib diisi!");
    return;
  }

  const toolObj = { id: id ? parseInt(id) : Date.now(), name, desc, icon, cmd, qr, imgUrl };

  if (id) {
    const index = myTools.findIndex((t) => t.id == id);
    if (index !== -1) myTools[index] = toolObj;
  } else {
    myTools.push(toolObj);
  }
  localStorage.setItem("bms_tools", JSON.stringify(myTools));
  renderTools();
  closeModal("modalTool");
}

function deleteTool() {
  const id = document.getElementById("tool_id").value;
  if (confirm("Hapus tool ini?")) {
    myTools = myTools.filter((t) => t.id != id);
    localStorage.setItem("bms_tools", JSON.stringify(myTools));
    renderTools();
    closeModal("modalTool");
  }
}

// ================= FORM, HISTORY & FIX BUG FOTO =================

function openForm(item) {
  currentAsset = item;

  // 1. Reset Form Total (FIX BUG FOTO DISINI)
  resetFormUI();

  // 2. Buka Tampilan Form
  document.getElementById("patrol-list-view").classList.add("hidden");
  document.getElementById("patrol-form-view").classList.remove("hidden");

  // 3. Isi Data Aset
  document.getElementById("formAssetName").innerText = item.name;
  document.getElementById("formAssetLoc").innerText = item.location;
  document.getElementById("formAssetId").innerText = item.id;

  // 4. Ambil History dari Server
  loadAssetHistory(item.name);
}

// FUNGSI BARU: MEMBERSIHKAN SISA INPUT SEBELUMNYA
function resetFormUI() {
  document.getElementById("catatanInput").value = "";
  document.getElementById("statusInput").value = "Normal";

  // Reset Status Button UI
  setStatus("Normal", document.querySelector(".status-btn"));

  // Reset Input File & Preview Gambar (PENTING!)
  document.getElementById("file_img1").value = "";
  document.getElementById("file_img2").value = "";

  document.getElementById("prev_img1").src = "";
  document.getElementById("prev_img1").classList.add("hidden");

  document.getElementById("prev_img2").src = "";
  document.getElementById("prev_img2").classList.add("hidden");

  // Reset History UI
  document.getElementById("assetHistoryList").innerHTML = "";
  document.getElementById("assetHistoryList").classList.add("hidden");
  document.getElementById("histIcon").innerText = "expand_more";
}

// FUNGSI BARU: LOAD HISTORY
async function loadAssetHistory(assetName) {
  const listContainer = document.getElementById("assetHistoryList");
  const loading = document.getElementById("histLoading");

  // Tampilkan Accordion default tertutup, user klik kalau mau lihat
  // Atau mau otomatis terbuka? Kita buat tertutup dulu biar rapi.

  loading.classList.remove("hidden");

  try {
    const res = await fetch(`${API_URL}?action=history&q=${encodeURIComponent(assetName)}`);
    const data = await res.json();

    loading.classList.add("hidden");
    listContainer.innerHTML = ""; // Bersihkan

    if (data.length === 0) {
      listContainer.innerHTML = '<div class="text-xs text-center text-slate-400 py-2">Belum ada riwayat perbaikan.</div>';
    } else {
      data.forEach((h) => {
        // Formatting Status Color
        let statusColor = "text-slate-500";
        if (h.status === "Rusak") statusColor = "text-red-500 font-bold";
        if (h.status === "Maintenance") statusColor = "text-yellow-600 font-bold";
        if (h.status === "Normal") statusColor = "text-emerald-600";

        // Format Tanggal Singkat
        const dateObj = new Date(h.date);
        const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

        const div = document.createElement("div");
        div.className = "bg-white p-2 rounded-lg border border-slate-200 text-xs shadow-sm";
        div.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-mono text-[10px] bg-slate-100 px-1 rounded">${dateStr}</span>
                        <span class="${statusColor} text-[10px] uppercase">${h.status}</span>
                    </div>
                    <div class="text-slate-600 truncate">${h.catatan || "-"}</div>
                    <div class="text-[9px] text-slate-400 mt-1 text-right">Officer: ${h.petugas}</div>
                `;
        listContainer.appendChild(div);
      });
    }
  } catch (e) {
    loading.classList.add("hidden");
    listContainer.innerHTML = '<div class="text-xs text-red-400 text-center">Gagal memuat history.</div>';
  }
}

// FUNGSI BARU: TOGGLE ACCORDION HISTORY
function toggleHistory() {
  const list = document.getElementById("assetHistoryList");
  const icon = document.getElementById("histIcon");

  if (list.classList.contains("hidden")) {
    list.classList.remove("hidden");
    icon.innerText = "expand_less";
  } else {
    list.classList.add("hidden");
    icon.innerText = "expand_more";
  }
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

function previewImg(input, imgId) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById(imgId).src = e.target.result;
      document.getElementById(imgId).classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function submitLaporan() {
  const status = document.getElementById("statusInput").value;
  const catatan = document.getElementById("catatanInput").value;

  if (status !== "Normal" && !catatan) {
    alert("Wajib isi catatan jika kondisi tidak normal!");
    return;
  }

  document.getElementById("loadingText").innerText = "MENYIMPAN DATA...";
  openModal("modalLoading");

  try {
    const img1 = document.getElementById("file_img1").files[0];
    const img2 = document.getElementById("file_img2").files[0];

    // Payload ke Backend
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

    // Kirim ke Google Sheet
    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });

    addLog("LAPOR", currentAsset.name, status);

    // --- SIAPKAN DATA SHARE WA ---
    tempShareData = {
      nama: currentAsset.name,
      id: currentAsset.id, // Mengambil dari currentAsset (yang diset saat openForm)
      loc: currentAsset.location,
      status: status,
      catatan: catatan,
      img1: img1,
      img2: img2,
    };

    closeModal("modalLoading");
    openModal("modalSuccess");

    // BINDING TOMBOL WA DI MODAL SUKSES
    const btnShare = document.getElementById("btnShareWA");
    if (btnShare) btnShare.onclick = () => executeShareWA();
  } catch (e) {
    closeModal("modalLoading");
    alert("Gagal kirim: " + e.message);
  }
}

async function executeShareWA() {
  if (!tempShareData) return;

  const { nama, id, loc, status, catatan, img1, img2 } = tempShareData;

  // FORMAT TEXT WA
  const caption =
    `*LAPORAN OPERASIONAL IT*\n` +
    `🏢 PT Berlian Manyar Sejahtera\n\n` +
    `📦 *PERANGKAT:* ${nama}\n` +
    `🆔 *ID:* ${id || "-"}\n` +
    `📍 *LOKASI:* ${loc || "-"}\n` +
    `🔧 *STATUS:* ${status.toUpperCase()}\n` +
    `📝 *CATATAN:* ${catatan || "-"}\n\n` +
    `👮 *OFFICER:* ${currentUser}`;

  const filesArray = [];
  if (img1) filesArray.push(new File([img1], "kondisi.jpg", { type: img1.type }));
  if (img2) filesArray.push(new File([img2], "label.jpg", { type: img2.type }));

  // Coba Share Native (Mobile App)
  if (navigator.canShare && navigator.canShare({ files: filesArray })) {
    try {
      await navigator.share({
        text: caption,
        files: filesArray,
      });
    } catch (err) {
      console.log("Share dibatalkan user");
    }
  } else {
    // Fallback (WA Web)
    const waUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;
    window.open(waUrl, "_blank");
  }
}

function closeSuccessModal() {
  closeModal("modalSuccess");
  closeForm();
  switchTab("home", document.querySelectorAll(".nav-btn")[0]);
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

  document.getElementById("loadingText").innerText = "REGISTRASI ASET...";
  openModal("modalLoading");

  try {
    const d = new Date(date);
    const fmtDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const payload = { type: "new_asset", id, name, location: loc, date: fmtDate };
    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
    addLog("INPUT", name, "Master Data Baru");
    alert("Berhasil!");
    closeModal("modalAddAsset");
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    closeModal("modalLoading");
  }
}

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

// ================= JURNAL KEGIATAN LOGIC =================

function renderJurnal() {
  const container = document.getElementById("jurnalContainer");
  if (!container) return;
  container.innerHTML = "";

  if (jurnalLog.length === 0) {
    container.innerHTML = `
            <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-slate-300">
                    <span class="material-icons-round text-sm">info</span>
                </div>
                <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="text-xs text-slate-400">Belum ada dokumentasi kegiatan.</div>
                </div>
            </div>`;
    return;
  }

  jurnalLog.forEach((item) => {
    let imgHtml = "";
    // Cek apakah ada foto (bisa URL Drive atau Base64 lokal)
    if (item.foto && item.foto !== "-" && item.foto.length > 5) {
      imgHtml = `<img src="${item.foto}" class="w-full h-32 object-cover rounded-lg mt-3 mb-1 border border-slate-100 bg-slate-50" loading="lazy">`;
    }

    const html = `
        <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-fade-in">
            <div class="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-accent text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <span class="material-icons-round text-sm">work</span>
            </div>
            <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div class="flex justify-between items-start mb-1">
                    <time class="font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">${item.date} • ${item.time}</time>
                    <span class="text-[10px] font-bold text-primary uppercase tracking-wider">${item.petugas}</span>
                </div>
                <h4 class="font-bold text-slate-700 text-sm">${item.judul}</h4>
                <div class="text-xs text-slate-500 flex items-center gap-1 mt-0.5 mb-2">
                    <span class="material-icons-round text-[10px] text-accent">place</span> ${item.lokasi}
                </div>
                <p class="text-xs text-slate-600 leading-relaxed">${item.desc}</p>
                ${imgHtml}
            </div>
        </div>
        `;
    container.innerHTML += html;
  });
}
// ================= JURNAL SYNC (BARU) =================

async function loadServerJurnal() {
  const container = document.getElementById("jurnalContainer");

  // Tampilkan Skeleton Loading / Spinner kecil di pojok
  // Biar user tau lagi proses ambil data
  container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 opacity-50">
            <span class="material-icons-round animate-spin text-3xl text-primary mb-2">sync</span>
            <span class="text-xs text-slate-400">Sinkronisasi tim...</span>
        </div>
    `;

  try {
    // Minta data ke backend (Action: get_jurnal)
    const res = await fetch(`${API_URL}?action=get_jurnal`);
    const data = await res.json();

    // Update variable global jurnalLog dengan data baru dari server
    // Note: Data dari server menang (Source of Truth)
    jurnalLog = data;

    // Render ulang tampilan
    renderJurnal();
  } catch (e) {
    container.innerHTML = `<div class="text-center py-10 text-xs text-red-400">Gagal sinkronisasi. Cek koneksi.<br><button onclick="loadServerJurnal()" class="mt-2 underline">Coba Lagi</button></div>`;
  }
}
async function submitJurnal() {
  const judul = document.getElementById("jurnal_judul").value;
  const lokasi = document.getElementById("jurnal_lokasi").value;
  const desc = document.getElementById("jurnal_desc").value;
  const file = document.getElementById("file_jurnal").files[0];

  if (!judul || !desc) {
    alert("Judul & Deskripsi wajib diisi!");
    return;
  }

  document.getElementById("loadingText").innerText = "POSTING JURNAL...";
  openModal("modalLoading");

  try {
    const base64Foto = file ? await toBase64(file) : "";

    // 1. Simpan ke Server
    const payload = {
      type: "jurnal",
      judul: judul,
      lokasi: lokasi,
      deskripsi: desc,
      foto: base64Foto,
      petugas: currentUser,
    };
    await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });

    // 2. Simpan ke LocalStorage
    const newItem = {
      judul,
      lokasi,
      desc,
      foto: base64Foto,
      petugas: currentUser,
      date: new Date().toLocaleDateString("id-ID"),
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    if (file) {
      newItem.foto = URL.createObjectURL(file);
    }

    jurnalLog.unshift(newItem);
    if (jurnalLog.length > 10) jurnalLog.pop();
    localStorage.setItem("bms_jurnal", JSON.stringify(jurnalLog));

    addLog("JURNAL", judul, "Dokumentasi Baru");

    alert("✅ Jurnal Tersimpan!");
    closeModal("modalJurnal");
    renderJurnal();

    // Reset Form
    document.getElementById("jurnal_judul").value = "";
    document.getElementById("jurnal_lokasi").value = "";
    document.getElementById("jurnal_desc").value = "";
    document.getElementById("file_jurnal").value = "";
    document.getElementById("prev_jurnal").classList.add("hidden");
  } catch (e) {
    alert("Gagal posting: " + e.message);
  } finally {
    closeModal("modalLoading");
  }
}
