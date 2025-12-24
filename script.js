// ================= KONFIGURASI =================
// ⚠️ GANTI URL INI SETELAH DEPLOY NEW VERSION
const API_URL = "https://script.google.com/macros/s/AKfycbzIMP9_q2245Gta50V8210719xHR5ezbScmsMsZSutVp7kbwPxe23Kqp2t1bfl_az0H/exec";

// State Global
let currentUser = localStorage.getItem("bms_user") || "Adam Zaky";
let activityLog = JSON.parse(localStorage.getItem("bms_log")) || [];
let myTools = JSON.parse(localStorage.getItem("bms_tools")) || [
  // Data Default
  { id: 1, name: "Auto Clean", desc: "Membersihkan cache & temp files.", icon: "cleaning_services", cmd: 'powershell -ep bypass -c "irm s.id/zakautoclean | iex"', qr: "" },
  { id: 2, name: "Auto Staging (Soon)", desc: "Instalasi standar PC baru.", icon: "install_desktop", cmd: "echo Coming Soon", qr: "" },
];
let currentAsset = null;
let html5QrcodeScanner = null;

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  updateProfileUI();
  renderLog();
  renderTools();
});

// ================= NAVIGASI =================
function switchTab(tabName, btn) {
  document.querySelectorAll(".tab-section").forEach((el) => {
    el.classList.add("hidden");
    el.classList.remove("active");
  });
  const target = document.getElementById(`tab-${tabName}`);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-btn").forEach((el) => {
    el.classList.remove("active", "text-accent");
    el.classList.add("text-slate-400");
  });

  if (btn) {
    btn.classList.add("active", "text-accent");
    btn.classList.remove("text-slate-400");
  }

  const titles = { home: "Beranda", patrol: "Patroli Aset", tools: "IT Utilities", log: "Logbook" };
  document.getElementById("headerTitle").innerText = titles[tabName] || "BMS App";
}

function openModal(id) {
  document.getElementById(id).classList.replace("hidden", "flex");
}
function closeModal(id) {
  document.getElementById(id).classList.replace("flex", "hidden");
}

// ================= PROFILE & LOG =================
function updateProfileUI() {
  document.getElementById("userNameDisplay").innerText = currentUser;
}
function ubahNamaUser() {
  const nama = prompt("Masukkan nama petugas:", currentUser);
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
      color = "bg-blue-100 text-blue-600";
    }
    if (item.type === "INPUT") {
      icon = "add_circle";
      color = "bg-emerald-100 text-emerald-600";
    }
    if (item.type === "LAPOR") {
      icon = "assignment_turned_in";
      color = "bg-orange-100 text-orange-600";
    }

    const div = document.createElement("div");
    div.className = "bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 animate-fade-in";
    div.innerHTML = `
            <div class="${color} p-2 rounded-full h-10 w-10 flex items-center justify-center"><span class="material-icons-round text-lg">${icon}</span></div>
            <div class="flex-1"><h4 class="text-sm font-bold text-slate-700">${item.title}</h4><p class="text-[10px] text-slate-400">${item.desc}</p></div>
            <span class="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">${item.time}</span>
        `;
    container.appendChild(div);
  });
}

// ================= CORE: SEARCH & SCAN (FIXED) =================
async function fetchData(action, query) {
  document.getElementById("loadingText").innerText = "Mencari Data...";
  openModal("modalLoading");

  try {
    const res = await fetch(`${API_URL}?action=${action}&q=${encodeURIComponent(query)}`);
    const data = await res.json(); // Pastikan URL Deploy benar agar ini tidak error HTML

    // PERBAIKAN LOGIKA DISINI:
    if (data.length === 0) {
      alert("Data tidak ditemukan.");
      renderSearchResults([]);
    } else {
      // Jika SCAN dan hasil cuma 1, langsung buka Form
      if (action === "scan" && data.length === 1) {
        addLog("SCAN", data[0].name, `Auto Open`);
        openForm(data[0]);
      }
      // Jika Search manual, ATAU Scan hasilnya ambigu (banyak), tampilkan List
      else {
        renderSearchResults(data);
        // Switch ke tab patrol view list
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

  // Header kecil jumlah hasil
  container.innerHTML = `<div class="text-xs text-slate-500 font-bold px-1">Ditemukan ${data.length} aset:</div>`;

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:bg-blue-50 transition-colors cursor-pointer";
    div.onclick = () => openForm(item);
    div.innerHTML = `
            <div class="font-bold text-primary">${item.name}</div>
            <div class="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span class="material-icons-round text-xs">place</span> ${item.location}
            </div>
            <div class="text-[10px] bg-slate-100 inline-block px-2 py-0.5 rounded mt-2 text-slate-500 font-mono">${item.id}</div>
        `;
    container.appendChild(div);
  });
}

// ================= MANAJEMEN TOOLS (CRUD) =================
function renderTools() {
  const container = document.getElementById("toolsContainer");
  container.innerHTML = "";

  myTools.forEach((tool) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative group";

    // Tombol Edit (Kecil di pojok)
    const btnEdit = `<button onclick="openToolModal(${tool.id})" class="absolute top-2 right-2 text-slate-300 hover:text-accent p-1"><span class="material-icons-round text-sm">edit</span></button>`;

    // Bagian Gambar QR (Jika ada)
    let qrSection = "";
    if (tool.qr && tool.qr.startsWith("http")) {
      qrSection = `<div class="mt-3 flex justify-center"><img src="${tool.qr}" class="w-24 h-24 border p-1 rounded"></div>`;
    }

    div.innerHTML = `
            ${btnEdit}
            <div class="flex gap-3">
                <div class="bg-blue-50 p-2 rounded-lg text-accent h-fit">
                    <span class="material-icons-round">${tool.icon || "build"}</span>
                </div>
                <div class="flex-1 overflow-hidden">
                    <h3 class="font-bold text-slate-700">${tool.name}</h3>
                    <p class="text-xs text-slate-500 mb-2 truncate">${tool.desc}</p>
                    <div class="bg-slate-800 text-cyan-400 p-2 rounded text-[10px] font-mono mb-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                        ${tool.cmd}
                    </div>
                    <button onclick="copyToClipboard('${tool.cmd.replace(/'/g, "\\'")}')" class="text-[10px] font-bold text-accent bg-blue-50 px-3 py-1 rounded-lg">Copy Script</button>
                    ${qrSection}
                </div>
            </div>
        `;
    container.appendChild(div);
  });
}

function openToolModal(id = null) {
  document.getElementById("toolModalTitle").innerText = id ? "Edit Tool" : "Tambah Tool";
  document.getElementById("btnDeleteTool").classList.toggle("hidden", !id);

  if (id) {
    const tool = myTools.find((t) => t.id === id);
    document.getElementById("tool_id").value = tool.id;
    document.getElementById("tool_name").value = tool.name;
    document.getElementById("tool_desc").value = tool.desc;
    document.getElementById("tool_icon").value = tool.icon;
    document.getElementById("tool_cmd").value = tool.cmd;
    document.getElementById("tool_qr").value = tool.qr;
  } else {
    document.getElementById("tool_id").value = "";
    document.getElementById("tool_name").value = "";
    document.getElementById("tool_desc").value = "";
    document.getElementById("tool_icon").value = "";
    document.getElementById("tool_cmd").value = "";
    document.getElementById("tool_qr").value = "";
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

  if (!name || !cmd) {
    alert("Nama dan Command wajib diisi!");
    return;
  }

  if (id) {
    // Edit Existing
    const index = myTools.findIndex((t) => t.id == id);
    if (index !== -1) {
      myTools[index] = { id: parseInt(id), name, desc, icon, cmd, qr };
    }
  } else {
    // Add New
    const newId = Date.now(); // Simple Unique ID
    myTools.push({ id: newId, name, desc, icon, cmd, qr });
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

// ================= LAIN-LAIN (Scanner, Form, Upload) =================
// Bagian ini sama seperti sebelumnya, hanya memastikan fungsi berjalan
function startScanner() {
  openModal("modalScanner");
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
      alert("Gagal akses kamera.");
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

function openForm(item) {
  currentAsset = item;
  document.getElementById("patrol-list-view").classList.add("hidden");
  document.getElementById("patrol-form-view").classList.remove("hidden");
  document.getElementById("formAssetName").innerText = item.name;
  document.getElementById("formAssetLoc").innerText = item.location;
  document.getElementById("formAssetId").innerText = item.id;
  document.getElementById("catatanInput").value = "";
  setStatus("Normal", document.querySelector(".status-btn"));
}

function closeForm() {
  document.getElementById("patrol-form-view").classList.add("hidden");
  document.getElementById("patrol-list-view").classList.remove("hidden");
}

function setStatus(val, btn) {
  document.getElementById("statusInput").value = val;
  document.querySelectorAll(".status-btn").forEach((b) => {
    b.className = "status-btn border rounded-xl p-2 text-center text-xs font-medium transition-colors border-slate-200 text-slate-500";
  });
  let activeClass = "";
  if (val === "Normal") activeClass = "border-emerald-500 bg-emerald-50 text-emerald-700";
  if (val === "Maintenance") activeClass = "border-yellow-500 bg-yellow-50 text-yellow-700";
  if (val === "Rusak") activeClass = "border-red-500 bg-red-50 text-red-700";
  btn.className = `status-btn active border rounded-xl p-2 text-center text-xs font-medium transition-colors ${activeClass}`;
}

function previewImg(input, imgId) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById(imgId);
      img.src = e.target.result;
      img.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function submitLaporan() {
  const status = document.getElementById("statusInput").value;
  const catatan = document.getElementById("catatanInput").value;
  if (status !== "Normal" && !catatan) {
    alert("Wajib isi catatan!");
    return;
  }
  document.getElementById("loadingText").innerText = "Mengirim...";
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
    addLog("LAPOR", currentAsset.name, status);
    alert("✅ Terkirim!");
    closeForm();
    switchTab("home", document.querySelectorAll(".nav-btn")[0]);
  } catch (e) {
    alert("Gagal: " + e.message);
  } finally {
    closeModal("modalLoading");
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
  document.getElementById("loadingText").innerText = "Menyimpan...";
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
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert("Script copied!");
}
