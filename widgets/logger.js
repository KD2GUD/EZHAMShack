/* =====================================================================
   EZSHACK WIDGET: QuickLog & ADIF Logger (widgets/logger.js)
   UTC logger, live Auto-RST, Callook grid resolution, and ADIF 3.1 exporter
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  let lastLookedUpCall = '';

  function formatDisplayTime(t) {
    if (!t) return '--:--';
    const str = String(t).trim();
    if (str.includes(':')) return str;
    const clean = str.replace(/[^\d]/g, '');
    if (clean.length >= 4) {
      return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
    }
    return str;
  }

  const qsoLoggerWidget = {
    id: 'qso_logger',
    title: 'Native QuickLog & ADIF Exporter',
    category: 'Native Operations',
    description: 'Lightning-fast in-shack scratch logger with automatic UTC timestamping & ADIF file generation.',
    isNative: true,
    defaultW: 5,
    defaultH: 8,

    render(containerOrId, pane) {
      const wrapper = document.createElement('div');
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text';
      
      const isAutoRst = Boolean(window.appState && window.appState.autoRst);
      const isSync = window.getPanelSync ? window.getPanelSync('logger') : true;
      const defaultRst = window.getQuickRstReport ? window.getQuickRstReport() : '59';
      const defaultRcvd = ['USB', 'LSB', 'AM', 'FM', 'C4FM'].includes((window.appState?.vfo?.mode || 'USB').toUpperCase()) ? '59' : '599';

      wrapper.innerHTML = `
        <div class="h-full flex flex-col space-y-2">
          
          <!-- Sub-header Toolbar: Title, SYNC & Auto-RST Mode Toggles -->
          <div class="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
            <span class="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Station Log</span>
              <span id="logLookupStatus" class="text-amber-400 normal-case font-normal"></span>
            </span>
            <div class="flex items-center gap-1.5">
              <button 
                type="button"
                id="btnSync-logger" 
                data-sync-panel="logger"
                onclick="window.togglePanelSync('logger', this)" 
                title="Toggle auto-sync with Lookup & Great Circle" 
                class="px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition ${isSync ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300'}"
              >
                SYNC: ${isSync ? 'ON' : 'OFF'}
              </button>
              <button 
                type="button"
                id="btnToggleAutoRst" 
                onclick="window.toggleAutoRst()" 
                title="Toggle live S-meter RST signal reporting" 
                class="px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition ${isAutoRst ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300'}"
              >
                AUTO-RST: ${isAutoRst ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-6 gap-1.5 bg-shack-850 p-2 rounded border border-shack-border shrink-0">
            <div class="col-span-2 sm:col-span-2">
              <input type="text" id="logCall" placeholder="CALLSIGN" 
                onblur="window.handleCallsignBlur(this.value)"
                onkeydown="if(event.key==='Enter'){ window.handleCallsignBlur(this.value); window.commitQuickQso(); }" 
                class="w-full bg-shack-950 border border-shack-700 rounded px-2 py-1 text-amber-400 font-bold uppercase text-xs focus:outline-none focus:border-amber-500">
            </div>
            <div>
              <input type="text" id="logRstSent" value="${defaultRst}" placeholder="RST S" title="RST Sent (Your signal report to them)" class="w-full bg-shack-950 border border-shack-700 rounded px-1.5 py-1 text-center text-xs font-bold text-cyan-400">
            </div>
            <div>
              <input type="text" id="logRstRcvd" value="${defaultRcvd}" placeholder="RST R" title="RST Received (Their report to you)" class="w-full bg-shack-950 border border-shack-700 rounded px-1.5 py-1 text-center text-xs text-slate-300">
            </div>
            <div class="col-span-2 sm:col-span-2 flex gap-1">
              <button onclick="window.commitQuickQso()" class="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-1 px-2 rounded text-xs transition">
                + LOG QSO
              </button>
              <button onclick="window.exportAdifLog()" title="Download ADIF Log file for LoTW / QRZ / eQSL" class="bg-shack-800 hover:bg-shack-700 border border-shack-700 text-slate-300 px-2 py-1 rounded text-[11px]">
                ADIF
              </button>
              
            </div>
          </div>

          <div class="flex-1 bg-shack-950 border border-shack-border rounded overflow-y-auto">
            <table class="w-full text-left text-[11px] font-mono">
              <thead class="bg-shack-850 text-slate-400 border-b border-shack-border sticky top-0">
                <tr>
                  <th class="p-1.5">TIME (Z)</th>
                  <th class="p-1.5">CALL</th>
                  <th class="p-1.5">BAND</th>
                  <th class="p-1.5">MODE</th>
                  <th class="p-1.5">RST</th>
                  <th class="p-1.5 text-center">ACT</th>
                </tr>
              </thead>
              <tbody id="qsoLogTableBody" class="divide-y divide-shack-850 text-slate-300">
                ${window.renderQsoRows ? window.renderQsoRows() : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return wrapper;
    }
  };

  window.EZWidgets.qsoLogger = qsoLoggerWidget;
  window.EZWidgets.qso_logger = qsoLoggerWidget;

  /* =====================================================================
     AUTO-RST CALCULATOR & TOGGLE
     ===================================================================== */
  window.getQuickRstReport = function() {
    const mode = (window.appState && window.appState.vfo && window.appState.vfo.mode ? window.appState.vfo.mode : 'USB').toUpperCase();
    const isPhone = ['USB', 'LSB', 'AM', 'FM', 'C4FM'].includes(mode);

    if (!window.appState || !window.appState.autoRst) {
      return isPhone ? '59' : '599';
    }

    const sVal = (window.appState && window.appState.telemetry && window.appState.telemetry.smeterVal !== undefined) 
      ? window.appState.telemetry.smeterVal 
      : 0;

    let sNum = 9;
    if (typeof window.calculateSmeter === 'function') {
      const res = window.calculateSmeter(sVal);
      sNum = Math.min(9, Math.max(1, res.segments || 9));
    }
    return isPhone ? `5${sNum}` : `5${sNum}9`;
  };

  window.toggleAutoRst = function() {
    if (!window.appState) window.appState = {};
    window.appState.autoRst = !window.appState.autoRst;
    if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();

    const btn = document.getElementById('btnToggleAutoRst');
    if (btn) {
      if (window.appState.autoRst) {
        btn.className = 'px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition bg-cyan-950 text-cyan-400 border-cyan-800';
        btn.innerText = 'AUTO-RST: ON';
      } else {
        btn.className = 'px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300';
        btn.innerText = 'AUTO-RST: OFF';
      }
    }

    const rstSent = document.getElementById('logRstSent');
    if (rstSent) {
      rstSent.value = window.getQuickRstReport();
    }

    if (typeof window.showToast === 'function') {
      window.showToast(window.appState.autoRst ? 'Auto-RST Enabled (pulls live S-Meter)' : 'Auto-RST Disabled (standard 59/599)');
    }
  };

  /* =====================================================================
     LOGGER BLUR DISPATCHER
     ===================================================================== */
  window.handleCallsignBlur = async function(callVal) {
    const call = (callVal || '').trim().toUpperCase();

    if (window.appState && window.appState.autoRst) {
      const rstSent = document.getElementById('logRstSent');
      if (rstSent) rstSent.value = window.getQuickRstReport();
    }

    if (!call || call.length < 3) return;

    if (window.syncShackTarget) {
      window.syncShackTarget('logger', { call });
    }

    if (call === lastLookedUpCall) return;
    lastLookedUpCall = call;
  };

  /* =====================================================================
     GLOBAL LOGBOOK HANDLERS & TABLE RENDERER
     ===================================================================== */
  window.renderQsoRows = function() {
    if (!window.appState || !window.appState.qsos || window.appState.qsos.length === 0) {
      return `<tr><td colspan="6" class="p-3 text-center text-slate-500">No QSOs recorded yet. Enter a callsign above.</td></tr>`;
    }

    return window.appState.qsos.slice(0, 50).map((q, idx) => {
      const timeVal = formatDisplayTime(q.time || q.time_on);
      const callVal = q.call || '';
      const bandVal = q.band || '';
      const modeVal = q.mode || '';
      const sSent = q.rstS || q.rst_sent || '59';
      const sRcvd = q.rstR || q.rst_rcvd || '59';

      return `
        <tr class="hover:bg-shack-800/50">
          <td class="p-1.5 text-slate-400">${timeVal}</td>
          <td class="p-1.5 font-bold text-amber-400">${callVal}</td>
          <td class="p-1.5 text-cyan-400">${bandVal}</td>
          <td class="p-1.5 text-slate-300">${modeVal}</td>
          <td class="p-1.5 text-slate-400">${sSent} / ${sRcvd}</td>
          <td class="p-1.5 text-center">
            <button onclick="window.deleteQso(${idx})" class="text-red-400 hover:text-red-300 font-bold px-1" title="Delete QSO">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  };

  window.renderQsoTable = function() {
    const tbody = document.getElementById('qsoLogTableBody');
    if (tbody) {
      tbody.innerHTML = window.renderQsoRows();
    }
  };

  qsoLoggerWidget.renderTable = window.renderQsoTable;

  // Re-render when backend pushes fresh ADIF records over WebSocket
  window.addEventListener('ezshack:qsos_updated', () => {
    window.renderQsoTable();
  });

  /* =====================================================================
     QSO COMMIT (NEW CONTACT)
     ===================================================================== */
  window.commitQuickQso = function() {
    const callInput = document.getElementById('logCall');
    const rstSInput = document.getElementById('logRstSent');
    const rstRInput = document.getElementById('logRstRcvd');
    if (!callInput || !callInput.value.trim()) {
      if (typeof window.showToast === 'function') window.showToast('Please enter a target Call Sign');
      return;
    }

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const timeOn = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
    const dateStr = `${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}`;
    const freqMhz = (window.appState && window.appState.vfo && window.appState.vfo.frequency)
      ? (window.appState.vfo.frequency / 1000000.0).toFixed(6)
      : "14.074000";

    const qsoId = Date.now();
    const call = callInput.value.trim().toUpperCase();
    const rstS = (rstSInput && rstSInput.value.trim()) ? rstSInput.value.trim() : window.getQuickRstReport();
    const isPhone = ['USB', 'LSB', 'AM', 'FM', 'C4FM'].includes((window.appState?.vfo?.mode || 'USB').toUpperCase());
    const rstR = (rstRInput && rstRInput.value.trim()) ? rstRInput.value.trim() : (isPhone ? '59' : '599');

    const newQso = {
      id: qsoId,
      call: call,
      rstS: rstS,
      rstR: rstR,
      rst_sent: rstS,
      rst_rcvd: rstR,
      band: (window.appState && window.appState.vfo && window.appState.vfo.band) ? window.appState.vfo.band : '20m',
      mode: (window.appState && window.appState.vfo && window.appState.vfo.mode) ? window.appState.vfo.mode : 'USB',
      freq: freqMhz,
      time: timeStr,
      time_on: timeOn,
      date: dateStr
    };

    if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
      window.bridgeSocket.send(JSON.stringify({
        action: "log_qso",
        qso: newQso,
        station: window.appState.profile
      }));
    }

    if (!window.appState.qsos) window.appState.qsos = [];
    window.appState.qsos.unshift(newQso);
    callInput.value = '';
    lastLookedUpCall = '';

    const statusEl = document.getElementById('logLookupStatus');
    if (statusEl) statusEl.innerText = '';

    if (rstSInput) rstSInput.value = window.getQuickRstReport();
    if (rstRInput) rstRInput.value = isPhone ? '59' : '599';

    if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
    window.renderQsoTable();

    if (typeof window.showToast === 'function') window.showToast(`Logged QSO with ${newQso.call} on ${newQso.band}!`);
  };

  /* =====================================================================
     QSO LOG DELETION ENGINE (Confirmation + ADIF Disk Removal)
     ===================================================================== */
  window.deleteQso = function(target) {
    let index = -1;
    let qso = null;

    if (typeof target === 'number') {
      index = target;
      qso = window.appState.qsos[index];
    } else if (typeof target === 'object' && target !== null) {
      qso = target;
      index = window.appState.qsos.indexOf(target);
    }

    if (!qso) return;

    const stationCall = qso.call || 'this entry';
    const confirmMsg = `Warning: This will permanently delete the QSO with ${stationCall} from your log file (shack_log.adi).\n\nDo you want to proceed?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    // 1. Remove from local array
    if (index > -1) {
      window.appState.qsos.splice(index, 1);
    } else {
      window.appState.qsos = window.appState.qsos.filter(item => item !== qso);
    }

    if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();

    // 2. Dispatch delete action to bridge daemon
    if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
      window.bridgeSocket.send(JSON.stringify({
        action: "delete_qso",
        qso: qso
      }));
    }

    // 3. Re-render UI table
    window.renderQsoTable();

    if (typeof window.showToast === 'function') {
      window.showToast(`Deleted ${stationCall} from log file.`);
    }
  };

  window.clearAllQsos = function() {
    if (confirm('Clear all logged QSOs from dashboard view?')) {
      if (!window.appState) window.appState = {};
      window.appState.qsos = [];
      if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
      window.renderQsoTable();
      if (typeof window.showToast === 'function') window.showToast('Cleared all local QSOs.');
    }
  };

  /* =====================================================================
     ADIF EXPORTER
     ===================================================================== */
  window.exportAdifLog = function() {
    if (!window.appState || !window.appState.qsos || window.appState.qsos.length === 0) {
      if (typeof window.showToast === 'function') window.showToast('Logbook is currently empty.');
      return;
    }

    const opCall = (window.appState.profile?.callsign || 'N0CALL').toUpperCase();
    const opGrid = (window.appState.profile?.grid || '').toUpperCase();
    const opCity = window.appState.profile?.city || '';
    const opState = window.appState.profile?.state || '';
    const opCountry = window.appState.profile?.country || 'USA';
    const opCqz = (window.appState.profile?.cqz || '').toString();
    const opPwr = (window.appState.profile?.power || '100').toString();

    let adif = "<ADIF_VER:5>3.1.4\n<PROGRAMID:7>EZShack\n<PROGRAMVERSION:5>1.0.0\n<EOH>\n";

    window.appState.qsos.forEach(q => {
      const d = (q.date || "").replace(/[^\d]/g, '').slice(0, 8);
      const t = (q.time_on || q.time || "").replace(/[^\d]/g, '').padEnd(6, '0').slice(0, 6);
      const f = (q.freq || "14.074000").toString();
      const b = q.band || "20m";
      const m = (q.mode || "USB").toUpperCase();
      const rs = (q.rstS || q.rst_sent || "599").toString();
      const rr = (q.rstR || q.rst_rcvd || "599").toString();
      const targetCall = (q.call || '').toUpperCase();
      const comment = q.notes || q.comment || "";

      let record = 
        `<FREQ:${f.length}>${f}` +
        `<CALL:${targetCall.length}>${targetCall}` +
        `<MODE:${m.length}>${m}` +
        `<QSO_DATE:8>${d}` +
        `<QSO_DATE_OFF:8>${d}` +
        `<TIME_OFF:6>${t}` +
        `<TIME_ON:6>${t}` +
        `<RST_RCVD:${rr.length}>${rr}` +
        `<RST_SENT:${rs.length}>${rs}` +
        `<BAND:${b.length}>${b}` +
        `<OPERATOR:${opCall.length}>${opCall}` +
        `<STATION_CALLSIGN:${opCall.length}>${opCall}`;

      if (opCountry) record += `<COUNTRY:${opCountry.length}>${opCountry}`;
      if (opCqz) record += `<CQZ:${opCqz.length}>${opCqz}`;
      if (opPwr) record += `<TX_PWR:${opPwr.length}>${opPwr}`;
      if (opGrid) record += `<MY_GRIDSQUARE:${opGrid.length}>${opGrid}`;
      if (opCity) record += `<MY_CITY:${opCity.length}>${opCity}`;
      if (opState) record += `<MY_STATE:${opState.length}>${opState}`;
      if (comment) record += `<COMMENT:${comment.length}>${comment}`;
      record += `<EOR>\n`;
      adif += record;
    });

    const blob = new Blob([adif], { type: 'text/plain;charset=ascii' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EZShack_Log_${opCall}_${new Date().toISOString().slice(0,10)}.adi`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof window.showToast === 'function') window.showToast(`Exported ${window.appState.qsos.length} QSOs to standard ADIF.`);
  };
})();