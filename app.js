(() => {
  "use strict";
  const STORAGE_KEY = "ga3-pwa-v1";
  const $ = (id) => document.getElementById(id);
  const rowsEl = $("rows");
  const locationInput = $("location");
  const personInput = $("defaultPerson");
  const saveStatus = $("saveStatus");
  const canvas = $("signaturePad");
  const ctx = canvas.getContext("2d");
  let saveTimer = null;
  let toastTimer = null;
  let drawing = false;
  let hasSignature = false;
  let signaturePoints = [];
  let currentSignatureStroke = [];

  const pad2 = n => String(n).padStart(2, "0");
  function nowParts() {
    const d = new Date();
    return { date: `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)}`, time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
  }
  function makeRow(data = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="cell-input" data-field="item" aria-label="Item" placeholder="Equipment item" value=""></td>
      <td><input class="cell-input" data-field="serial" aria-label="Serial number" placeholder="Serial number" value=""></td>
      <td><input class="cell-input" data-field="issues" aria-label="Issues" placeholder="No / Yes" value=""></td>
      <td><input class="cell-input" data-field="action" aria-label="Action taken" placeholder="Action taken" value=""></td>
      <td><button class="cell-input date-cell date-button" data-field="datetime" type="button" title="Tap to set this row's date and time to now"></button></td>
      <td><input class="cell-input" data-field="person" aria-label="Name and position" placeholder="Name / position" value=""></td>
      <td class="screen-only"><button type="button" class="remove-row" aria-label="Remove row" title="Remove row">×</button></td>`;
    for (const [key, value] of Object.entries(data)) {
      const el = tr.querySelector(`[data-field="${key}"]`);
      if (!el) continue;
      if (key === "datetime") el.dataset.value = value || "";
      else el.value = value || "";
    }
    if (!tr.querySelector('[data-field="datetime"]').dataset.value) {
      const p = nowParts(); tr.querySelector('[data-field="datetime"]').dataset.value = `${p.date} ${p.time}`;
    }
    updateDateButton(tr);
    tr.querySelector(".remove-row").addEventListener("click", () => {
      if (rowsEl.children.length <= 1) {
        tr.querySelectorAll("input").forEach(input => input.value = "");
        const p = nowParts(); tr.querySelector('[data-field="datetime"]').dataset.value = `${p.date} ${p.time}`;
        updateDateButton(tr);
      } else tr.remove();
      updateCount(); scheduleSave();
    });
    tr.querySelector(".date-button").addEventListener("click", () => {
      const p = nowParts(); tr.querySelector('[data-field="datetime"]').dataset.value = `${p.date} ${p.time}`;
      updateDateButton(tr); scheduleSave(); showToast("Date and time updated.");
    });
    tr.querySelectorAll("input").forEach(input => input.addEventListener("input", () => {
      scheduleSave();
      if (input.dataset.field === "person" && input.value.trim()) personInput.value = input.value;
    }));
    return tr;
  }
  function updateDateButton(tr) {
    const btn = tr.querySelector('[data-field="datetime"]');
    const value = btn.dataset.value || "";
    btn.textContent = value.replace(" ", "\n");
    btn.style.whiteSpace = "pre-line";
  }
  function addRow(data = {}, prefill = true) {
    if (prefill && rowsEl.lastElementChild) {
      const last = rowsEl.lastElementChild;
      if (!data.person) data.person = last.querySelector('[data-field="person"]').value || personInput.value;
      if (!data.datetime) { const p = nowParts(); data.datetime = `${p.date} ${p.time}`; }
    } else if (!data.person) data.person = personInput.value;
    rowsEl.appendChild(makeRow(data));
    updateCount();
    scheduleSave();
  }
  function updateCount() {
    const n = rowsEl.children.length;
    $("rowCount").textContent = `${n} ${n === 1 ? "item row" : "item rows"}`;
  }
  function getState() {
    return {
      location: locationInput.value,
      defaultPerson: personInput.value,
      rows: Array.from(rowsEl.children, tr => {
        const obj = {};
        tr.querySelectorAll("[data-field]").forEach(el => obj[el.dataset.field] = el.dataset.field === "datetime" ? el.dataset.value : el.value);
        return obj;
      })
    };
  }
  function scheduleSave() {
    saveStatus.textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 180);
  }
  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
      saveStatus.textContent = "Saved on this device";
    } catch (err) {
      saveStatus.textContent = "Could not save";
      showToast("Storage is full or unavailable. Export a PDF to keep a copy.");
    }
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw);
      locationInput.value = state.location || "";
      personInput.value = state.defaultPerson || "";
      rowsEl.innerHTML = "";
      (Array.isArray(state.rows) && state.rows.length ? state.rows : [{}]).forEach(row => addRow(row, false));
      updateCount();
      return true;
    } catch (e) { return false; }
  }
  function showToast(message) {
    const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  locationInput.addEventListener("input", scheduleSave);
  personInput.addEventListener("input", () => {
    scheduleSave();
    // Keep newly added rows prefilled with the current default, but don't overwrite existing entries.
  });
  $("addRowBtn").addEventListener("click", () => { addRow(); rowsEl.lastElementChild?.querySelector('[data-field="item"]')?.focus(); });
  $("refreshDates").addEventListener("click", () => {
    const p = nowParts(); rowsEl.querySelectorAll('[data-field="datetime"]').forEach(btn => { btn.dataset.value = `${p.date} ${p.time}`; updateDateButton(btn.closest("tr")); });
    scheduleSave(); showToast("All row dates and times updated.");
  });
  $("newFormBtn").addEventListener("click", () => $("newFormDialog").showModal());
  $("confirmNewForm").addEventListener("click", (event) => {
    event.preventDefault();
    locationInput.value = ""; personInput.value = ""; rowsEl.innerHTML = "";
    addRow({}, false); clearSignature(); saveNow(); $("newFormDialog").close(); showToast("New GA3 form started.");
  });

  // Signature canvas: store strokes only in memory; deliberately not in localStorage.
  function resizeCanvas(preserve = true) {
    const old = preserve && hasSignature ? canvas.toDataURL() : null;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#172033";
    if (old) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height); image.src = old; }
  }
  function pointerPos(event) { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault(); drawing = true; currentSignatureStroke = [];
    const p = pointerPos(event); currentSignatureStroke.push(p); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    canvas.setPointerCapture?.(event.pointerId); $("signatureHint").hidden = true;
  });
  canvas.addEventListener("pointermove", event => {
    if (!drawing) return; event.preventDefault(); const p = pointerPos(event); currentSignatureStroke.push(p);
    ctx.lineTo(p.x, p.y); ctx.stroke(); hasSignature = true;
  });
  function endStroke() { if (!drawing) return; drawing = false; if (currentSignatureStroke.length) signaturePoints.push(currentSignatureStroke); currentSignatureStroke = []; hasSignature = signaturePoints.length > 0; }
  canvas.addEventListener("pointerup", endStroke); canvas.addEventListener("pointercancel", endStroke); canvas.addEventListener("pointerleave", event => { if (event.buttons === 0) endStroke(); });
  function clearSignature() { ctx.clearRect(0, 0, canvas.width, canvas.height); hasSignature = false; signaturePoints = []; currentSignatureStroke = []; $("signatureHint").hidden = false; }
  $("clearSignature").addEventListener("click", clearSignature);
  window.addEventListener("resize", () => resizeCanvas(true));

  function hasContent() {
    return Boolean(locationInput.value.trim() || Array.from(rowsEl.querySelectorAll("input")).some(i => i.value.trim()));
  }
  $("exportBtn").addEventListener("click", () => {
    if (!hasContent()) { showToast("Add a location or at least one item before exporting."); return; }
    if (!hasSignature) { showToast("Please add your signature before exporting."); $("signaturePad").scrollIntoView({behavior:"smooth", block:"center"}); return; }
    saveNow();
    document.title = `GA3-${(locationInput.value.trim() || "Record").replace(/[^a-z0-9-_]+/gi, "-")}`;
    window.print();
    setTimeout(() => { document.title = "GA3 Form"; }, 1000);
  });

  // Restore the form on startup; signature is intentionally blank each time.
  if (!loadState()) addRow({}, false);
  locationInput.addEventListener("change", saveNow);
  personInput.addEventListener("change", saveNow);
  updateCount();
  requestAnimationFrame(() => resizeCanvas(false));
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
})();
