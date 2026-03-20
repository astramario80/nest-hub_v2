/* NEST™ Inventory Lookup
   - Pulls scrubbed CSV data from Device Assignments_Public
   - Renders device tables
   - Provides sub-navigation for Laptops (period subviews + lookup)
   - Provides sub-navigation for USBs (ranges of 30 + search)
*/

(function () {
  const CSV_URLS = {
    EEkits: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn-hwFgBcaX6QbjC6fx7pBUuYGfOF7OzeVAIVvnSLJeljNXBwzvXJLB1Y2gbqCNC6NSSF7fluIAKv0/pub?gid=210028041&single=true&output=csv",
    Drones: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn-hwFgBcaX6QbjC6fx7pBUuYGfOF7OzeVAIVvnSLJeljNXBwzvXJLB1Y2gbqCNC6NSSF7fluIAKv0/pub?gid=1729521119&single=true&output=csv",
    USBs: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn-hwFgBcaX6QbjC6fx7pBUuYGfOF7OzeVAIVvnSLJeljNXBwzvXJLB1Y2gbqCNC6NSSF7fluIAKv0/pub?gid=1980128822&single=true&output=csv",
    Laptops: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn-hwFgBcaX6QbjC6fx7pBUuYGfOF7OzeVAIVvnSLJeljNXBwzvXJLB1Y2gbqCNC6NSSF7fluIAKv0/pub?gid=800976620&single=true&output=csv",
    Radios: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQn-hwFgBcaX6QbjC6fx7pBUuYGfOF7OzeVAIVvnSLJeljNXBwzvXJLB1Y2gbqCNC6NSSF7fluIAKv0/pub?gid=664356793&single=true&output=csv"
  };

  const state = {
    data: {
      kits: null,
      drones: null,
      radios: null,
      usbs: null,
      laptops: null
    },
    usb: {
      rangeSize: 30,
      ranges: [],
      currentRangeIndex: 0
    },
    laptops: {
      periodCols: [
        { key: "P1", label: "Period 1", colIndex: 1 },
        { key: "P2", label: "Period 2", colIndex: 2 },
        { key: "P3", label: "Period 3", colIndex: 3 },
        { key: "P4", label: "Period 4", colIndex: 4 },
        { key: "P5", label: "Period 5", colIndex: 5 },
        { key: "P7", label: "Period 7", colIndex: 6 },
        { key: "ROBOTICS", label: "NEST™ Robotics", colIndex: 7 },
        { key: "GUEST", label: "Guests", colIndex: 8 }
      ]
    }
  };

  // ---------- DOM helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showToast(msg) {
    const el = $("#inv-toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      el.classList.remove("show");
      el.hidden = true;
    }, 2400);
  }

  // ---------- CSV parsing ----------
  // Robust enough for standard Google Sheets CSV export (quotes, commas, newlines)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          cell += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }

      if (char === ",") {
        row.push(cell);
        cell = "";
        continue;
      }

      if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      if (char === "\r") {
        continue;
      }

      cell += char;
    }

    // final cell
    row.push(cell);
    rows.push(row);

    // trim trailing empty rows
    while (rows.length && rows[rows.length - 1].every(c => (c || "").trim() === "")) rows.pop();

    return rows;
  }

  async function fetchCSV(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
    const text = await res.text();
    const rows = parseCSV(text);

    // If the sheet export includes header rows above row 3, we'll just take everything.
    // We'll also drop fully empty rows.
    const cleaned = rows.filter(r => r.some(c => (c || "").trim() !== ""));

    // Drop a header row if it looks like one (ex: contains words like Status / Notes)
    if (cleaned.length) {
      const h = cleaned[0].map(c => (c || "").toString().trim().toLowerCase());
      const headerHints = ["status", "notes", "note", "student", "assigned", "equipment", "kit", "drone", "radio", "usb", "laptop", "number", "#"];
      const looksLikeHeader = h.some(cell => headerHints.some(hh => cell === hh || cell.includes(hh)));
      if (looksLikeHeader) cleaned.shift();
    }

    return cleaned;
  }

  function toTableModel(rows, expectedMinCols) {
    // If row 1 looks like a header (contains non-empty text and not typical status values), keep it.
    // Otherwise, we'll synthesize a header.
    const maxCols = Math.max(...rows.map(r => r.length));
    const cols = Math.max(maxCols, expectedMinCols || 0);

    const normalized = rows.map(r => {
      const rr = r.slice(0);
      while (rr.length < cols) rr.push("");
      return rr;
    });

    return {
      cols,
      rows: normalized
    };
  }

  // ---------- Table rendering + filtering ----------
  function renderTable(el, model, options = {}) {
    const { header = null } = options;

    el.innerHTML = "";

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    const headerRow = header || Array.from({ length: model.cols }).map((_, i) => `Col ${i + 1}`);
    headerRow.forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      trh.appendChild(th);
    });

    thead.appendChild(trh);

    const tbody = document.createElement("tbody");
    model.rows.forEach(r => {
      const tr = document.createElement("tr");
      r.forEach(c => {
        const td = document.createElement("td");
        td.textContent = (c || "").toString();
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    el.appendChild(thead);
    el.appendChild(tbody);
  }

  function applyFilterToTable(el, query) {
    const q = (query || "").trim().toLowerCase();
    const rows = $$("tbody tr", el);
    if (!q) {
      rows.forEach(tr => (tr.hidden = false));
      return;
    }
    rows.forEach(tr => {
      const text = tr.textContent.toLowerCase();
      tr.hidden = !text.includes(q);
    });
  }

  // ---------- View switching ----------
  function showPanel(panelKey) {
    $(".inventory-panel").forEach(p => {
      const isMatch = p.getAttribute("data-panel") === panelKey;
      p.hidden = !isMatch;
      if (isMatch) {
        p.classList.remove("panel-pop");
        // trigger reflow to restart animation
        void p.offsetWidth;
        p.classList.add("panel-pop");
      }
    });

    // default each panel to its home subview
    if (panelKey === "laptops") {
      showSubview("laptops", "laptops-home");
    }
    if (panelKey === "usbs") {
      showSubview("usbs", "usbs-home");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function hideAllPanels() {
    $$(".inventory-panel").forEach(p => (p.hidden = true));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSubview(panelKey, subviewKey) {
    const panel = $(`.inventory-panel[data-panel="${panelKey}"]`);
    if (!panel) return;

    $$(".subview", panel).forEach(sv => {
      sv.hidden = sv.getAttribute("data-subview") !== subviewKey;
    });
  }

  // ---------- Device-specific logic ----------
  function buildUsbRanges(usbsRows) {
    // usbsRows are table rows including status, id, student, note
    // Build ranges based on numeric USB ID values found in column B (index 1)
    const ids = usbsRows
      .map(r => (r[1] || "").toString().trim())
      .map(x => (x.match(/\d+/) ? parseInt(x.match(/\d+/)[0], 10) : NaN))
      .filter(n => Number.isFinite(n));

    const max = ids.length ? Math.max(...ids) : 150;
    const min = ids.length ? Math.min(...ids) : 1;

    const size = state.usb.rangeSize;
    const ranges = [];
    for (let start = Math.floor((min - 1) / size) * size + 1; start <= max; start += size) {
      const end = start + size - 1;
      ranges.push({ start, end, label: `${pad3(start)}–${pad3(end)}` });
    }
    return ranges;
  }

  function pad3(n) {
    const s = String(n);
    return s.length >= 3 ? s : "0".repeat(3 - s.length) + s;
  }

  function normalizeUsbId(val) {
    const m = (val || "").toString().match(/\d+/);
    if (!m) return null;
    return parseInt(m[0], 10);
  }

  function usbRowForId(usbsRows, id) {
    const target = parseInt(id, 10);
    if (!Number.isFinite(target)) return null;

    // Match exact numeric id from column B
    for (const r of usbsRows) {
      const rid = normalizeUsbId(r[1]);
      if (rid === target) return r;
    }
    return null;
  }

  function laptopLookup(laptopRows, laptopNumber) {
    // laptopRows is matrix, col 0 is laptop #
    const target = (laptopNumber || "").toString().trim();
    if (!target) return null;

    const row = laptopRows.find(r => (r[0] || "").toString().trim() === target);
    if (!row) return null;

    // Scan B..I; first non-empty is the assignment group
    const cols = state.laptops.periodCols;
    for (const col of cols) {
      const val = (row[col.colIndex] || "").toString().trim();
      if (val) {
        return {
          laptop: target,
          group: col.label,
          student: val
        };
      }
    }

    return {
      laptop: target,
      group: "Unassigned",
      student: ""
    };
  }

  function laptopRowsForPeriod(laptopRows, periodKey) {
    const col = state.laptops.periodCols.find(c => c.key === periodKey);
    if (!col) return [];

    // Return two-column table: Laptop # | Student
    const out = [];
    for (const r of laptopRows) {
      const laptop = (r[0] || "").toString().trim();
      if (!laptop) continue;
      const student = (r[col.colIndex] || "").toString().trim();
      // include all laptops so it's a complete matrix
      out.push([laptop, student]);
    }
    return out;
  }

  // ---------- Initialization + rendering ----------
  async function refreshAll() {
    showToast("Refreshing inventory…");

    const [kitsRows, dronesRows, radiosRows, usbsRows, laptopsRows] = await Promise.all([
      fetchCSV(CSV_URLS.EEkits),
      fetchCSV(CSV_URLS.Drones),
      fetchCSV(CSV_URLS.Radios),
      fetchCSV(CSV_URLS.USBs),
      fetchCSV(CSV_URLS.Laptops)
    ]);

    state.data.kits = toTableModel(kitsRows, 4);
    state.data.drones = toTableModel(dronesRows, 5);
    state.data.radios = toTableModel(radiosRows, 4);
    state.data.usbs = toTableModel(usbsRows, 4);
    state.data.laptops = toTableModel(laptopsRows, 9);

    // Render primary tables
    renderTable($("#kits-table"), state.data.kits, {
      header: ["Status", "Kit #", "Student (Period)", "Notes"]
    });

    renderTable($("#drones-table"), state.data.drones, {
      header: ["Status", "Drone #", "Student (Period)", "Equipment", "Notes"]
    });

    renderTable($("#radios-table"), state.data.radios, {
      header: ["Status", "Radio #", "Student (Period)", "Notes"]
    });

    // Setup laptops home
    buildLaptopUI();

    // Setup USBs home
    buildUsbUI();

    showToast("Inventory updated.");
  }

  function buildLaptopUI() {
    const laptopSelect = $("#laptop-select");
    const pills = $("#laptop-period-pills");

    if (!laptopSelect || !pills) return;

    // Populate select with laptop numbers (col A)
    const rows = state.data.laptops.rows;
    const nums = rows
      .map(r => (r[0] || "").toString().trim())
      .filter(Boolean);

    laptopSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select laptop #…";
    placeholder.disabled = true;
    placeholder.selected = true;
    laptopSelect.appendChild(placeholder);

    nums.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      laptopSelect.appendChild(opt);
    });

    // Period pills
    pills.innerHTML = "";
    state.laptops.periodCols.forEach(col => {
      const btn = document.createElement("button");
      btn.className = "pill";
      btn.type = "button";
      btn.textContent = col.label;
      btn.addEventListener("click", () => openLaptopPeriod(col.key));
      pills.appendChild(btn);
    });

    // Lookup
    const lookupBtn = $("#laptop-lookup-btn");
    if (lookupBtn) {
      lookupBtn.onclick = () => {
        const val = laptopSelect.value;
        const res = laptopLookup(state.data.laptops.rows, val);
        const card = $("#laptop-lookup-result");
        const body = $("#laptop-lookup-body");

        if (!res) {
          card.hidden = true;
          showToast("Laptop not found.");
          return;
        }

        const studentText = res.student ? res.student : "—";
        body.innerHTML = `
          <div class="kv">
            <div class="kv-row"><span class="k">Laptop #</span><span class="v">${escapeHTML(res.laptop)}</span></div>
            <div class="kv-row"><span class="k">Assigned Group</span><span class="v">${escapeHTML(res.group)}</span></div>
            <div class="kv-row"><span class="k">Student</span><span class="v">${escapeHTML(studentText)}</span></div>
          </div>
        `;
        card.hidden = false;
      };
    }

    const backHomeBtn = $("#laptops-back-home");
    if (backHomeBtn) {
      backHomeBtn.onclick = () => {
        showSubview("laptops", "laptops-home");
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }
  }

  function openLaptopPeriod(periodKey) {
    const col = state.laptops.periodCols.find(c => c.key === periodKey);
    if (!col) return;

    const rows = laptopRowsForPeriod(state.data.laptops.rows, periodKey);
    const model = toTableModel(rows, 2);

    $("#laptops-period-title").textContent = col.label;
    renderTable($("#laptops-period-table"), model, { header: ["Laptop #", "Student"] });

    showSubview("laptops", "laptops-period");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildUsbUI() {
    const pills = $("#usb-range-pills");
    const rows = state.data.usbs.rows;

    state.usb.ranges = buildUsbRanges(rows);

    if (pills) {
      pills.innerHTML = "";
      state.usb.ranges.forEach((r, idx) => {
        const btn = document.createElement("button");
        btn.className = "pill";
        btn.type = "button";
        btn.textContent = r.label;
        btn.addEventListener("click", () => openUsbRange(idx));
        pills.appendChild(btn);
      });
    }

    const searchBtn = $("#usb-search-btn");
    const searchInput = $("#usb-search");
    const backHomeBtn = $("#usbs-back-home");

    if (searchInput) {
      searchInput.addEventListener("keydown", e => {
        if (e.key === "Enter") usbSearch();
      });
    }

    if (searchBtn) {
      searchBtn.onclick = usbSearch;
    }

    if (backHomeBtn) {
      backHomeBtn.onclick = () => {
        showSubview("usbs", "usbs-home");
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }
  }

  function usbSearch() {
    const input = $("#usb-search");
    const card = $("#usb-search-result");
    const body = $("#usb-search-body");

    const id = normalizeUsbId(input.value);
    if (!id) {
      showToast("Enter a USB number.");
      card.hidden = true;
      return;
    }

    const row = usbRowForId(state.data.usbs.rows, id);
    if (!row) {
      showToast("USB not found.");
      card.hidden = true;
      return;
    }

    const status = (row[0] || "").toString().trim() || "—";
    const usbId = (row[1] || "").toString().trim() || pad3(id);
    const student = (row[2] || "").toString().trim() || "—";
    const note = (row[3] || "").toString().trim() || "—";

    body.innerHTML = `
      <div class="kv">
        <div class="kv-row"><span class="k">USB #</span><span class="v">${escapeHTML(usbId)}</span></div>
        <div class="kv-row"><span class="k">Status</span><span class="v">${escapeHTML(status)}</span></div>
        <div class="kv-row"><span class="k">Assigned To</span><span class="v">${escapeHTML(student)}</span></div>
        <div class="kv-row"><span class="k">Notes</span><span class="v">${escapeHTML(note)}</span></div>
      </div>
    `;
    card.hidden = false;
  }

  function openUsbRange(rangeIndex) {
    state.usb.currentRangeIndex = rangeIndex;
    const range = state.usb.ranges[rangeIndex];
    if (!range) return;

    const rows = state.data.usbs.rows.filter(r => {
      const rid = normalizeUsbId(r[1]);
      if (!Number.isFinite(rid)) return false;
      return rid >= range.start && rid <= range.end;
    });

    const model = toTableModel(rows, 4);
    $("#usbs-range-title").textContent = `USBs ${range.label}`;

    renderTable($("#usbs-range-table"), model, {
      header: ["Status", "USB #", "Student (Period)", "Notes"]
    });

    // wire filter
    const filter = $("#usbs-filter");
    if (filter) {
      filter.value = "";
      filter.oninput = () => applyFilterToTable($("#usbs-range-table"), filter.value);
    }

    showSubview("usbs", "usbs-range");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function escapeHTML(str) {
    return (str || "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Wire up page interactions ----------
  function initPage() {
    const yearEl = document.getElementById("current-year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    // Route from inventory navigation (supports both new nav + legacy cards)
    const navTargets = $(".inv-nav-item, .inv-device-card");
    navTargets.forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        if (view) showPanel(view);

        // active state for the horizontal nav
        $(".inv-nav-item").forEach(x => x.classList.remove("active"));
        if (btn.classList.contains("inv-nav-item")) btn.classList.add("active");
      });
    });

    if (!navTargets.length) {
      showToast("Inventory nav not found — check HTML/JS sync.");
    }

    // Back buttons for panels
    $$('[data-back]').forEach(btn => {
      btn.addEventListener("click", hideAllPanels);
    });

    // Filters for standard tables
    const kitsFilter = $("#kits-filter");
    if (kitsFilter) kitsFilter.oninput = () => applyFilterToTable($("#kits-table"), kitsFilter.value);

    const dronesFilter = $("#drones-filter");
    if (dronesFilter) dronesFilter.oninput = () => applyFilterToTable($("#drones-table"), dronesFilter.value);

    const radiosFilter = $("#radios-filter");
    if (radiosFilter) radiosFilter.oninput = () => applyFilterToTable($("#radios-table"), radiosFilter.value);

    // Refresh
    const refreshBtn = $("#refresh-all");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        refreshAll().catch(err => {
          console.error(err);
          showToast("Refresh failed. Check connection.");
        });
      });
    }

    // Start hidden: landing only
    hideAllPanels();

    // Initial load
    refreshAll().catch(err => {
      console.error(err);
      showToast("Could not load inventory data.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage);
  } else {
    initPage();
  }
})();
