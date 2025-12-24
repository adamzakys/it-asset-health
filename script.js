// ================= KONFIGURASI =================
const API_URL = "https://script.google.com/macros/s/AKfycbzIMP9_q2245Gta50V8210719xHR5ezbScmsMsZSutVp7kbwPxe23Kqp2t1bfl_az0H/exec";

// State Global
let currentUser = localStorage.getItem("bms_user") || "Officer IT";
let activityLog = JSON.parse(localStorage.getItem("bms_log")) || [];
// Menambahkan field imgUrl di struktur Tools
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
  document.getElementById("new_date").valueAsDate = new Date();
});

// ================= LOGIC TOMBOL BANTUAN (OBFUSCATED) =================
// ================= LOGIC TOMBOL BANTUAN (FIXED MOBILE) =================
function triggerHelpWA() {
    // 1. Obfuscate Nomor (Tetap tersembunyi/dipecah)
    const _p = ['62', '831', '2993', '9682'];
    
    // 2. Pesan Default
    const _msg = "Halo Admin IT, saya butuh bantuan aplikasi BMS Asset Ops.";
    
    // 3. Format URL Standar API WhatsApp
    const _url = `https://api.whatsapp.com/send?phone=${_p.join('')}&text=${encodeURIComponent(_msg)}`;
    
    // 4. METODE BARU: 
    // Jangan pakai window.open() karena sering diblokir pop-up blocker di HP.
    // Pakai window.location.href agar dianggap "Navigasi Langsung" ke Aplikasi WA.
    window.location.href = _url;
}

// ================= NAVIGASI =================
function switchTab(tabName, btn) {
  document.querySelectorAll(".tab-section").forEach((el) => el.classList.remove("active"));
  setTimeout(() => {
    document.querySelectorAll(".tab-section").forEach((el) => el.classList.add("hidden"));
    const target = document.getElementById(`tab-${tabName}`);
    target.classList.remove("hidden");
    setTimeout(() => target.classList.add("active"), 10);
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
  document.getElementById("headerTitle").innerText = titles[tabName] || "BMS Asset";
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

// ================= TOOLS (FIXED COPY & IMAGE) =================
function renderTools() {
  const container = document.getElementById("toolsContainer");
  container.innerHTML = "";
  myTools.forEach((tool) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative group transition-all hover:shadow-md";

    const btnEdit = `<button onclick="openToolModal(${tool.id})" class="absolute top-2 right-2 text-slate-300 hover:text-accent p-2 rounded-full hover:bg-slate-50 transition-colors"><span class="material-icons-round text-sm">edit</span></button>`;

    let extraMedia = "";
    // QR Code
    if (tool.qr && tool.qr.startsWith("http")) {
      extraMedia += `<div class="mt-2 text-center"><img src="${tool.qr}" class="h-24 mx-auto border p-1 rounded bg-white shadow-sm"></div>`;
    }
    // Image Tampilan Tool (Fitur Baru)
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

// FIX COPY SCRIPT
function copyScript(text) {
  // Coba API modern dulu
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
  // Metode lama yang lebih kompatibel di HTTP
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
    alert("Gagal copy. Silakan select manual.");
  }
  document.body.removeChild(textArea);
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
    document.getElementById("tool_img").value = tool.imgUrl || ""; // Load existing img
  } else {
    document.getElementById("tool_id").value = "";
    document.getElementById("tool_name").value = "";
    document.getElementById("tool_desc").value = "";
    document.getElementById("tool_icon").value = "";
    document.getElementById("tool_cmd").value = "";
    document.getElementById("tool_qr").value = "";
    document.getElementById("tool_img").value = "";
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

// ================= FORM & SUBMIT (WA UPDATE) =================
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
    alert("Wajib isi catatan!");
    return;
  }

  document.getElementById("loadingText").innerText = "MENYIMPAN DATA...";
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
    document.getElementById("btnShareWA").onclick = () => executeShareWA();
  } catch (e) {
    closeModal("modalLoading");
    alert("Gagal: " + e.message);
  }
}

async function executeShareWA() {
  if (!tempShareData) return;
  const { nama, id, loc, status, catatan, img1, img2 } = tempShareData;

  // FORMAT WA DIPERJELAS & DIPERLENGKAP
  const caption =
    `*LAPORAN OPERASIONAL IT*\n` +
    `🏢 PT Berlian Manyar Sejahtera\n\n` +
    `📦 *PERANGKAT:* ${nama}\n` +
    `🆔 *ID:* ${id}\n` +
    `📍 *LOKASI:* ${loc}\n` +
    `🔧 *STATUS:* ${status.toUpperCase()}\n` +
    `📝 *CATATAN:* ${catatan || "-"}\n\n` +
    `👮 *OFFICER:* ${currentUser}`;

  const filesArray = [];
  if (img1) filesArray.push(new File([img1], "kondisi.jpg", { type: img1.type }));
  if (img2) filesArray.push(new File([img2], "label.jpg", { type: img2.type }));

  if (navigator.canShare && navigator.canShare({ files: filesArray })) {
    try {
      await navigator.share({ text: caption, files: filesArray });
    } catch (err) {
      console.log("Share cancelled");
    }
  } else {
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

