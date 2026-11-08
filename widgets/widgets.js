/* =====================================================================
   EZSHACK - CENTRAL WIDGET DISPATCHER & SHACK SYNC HUB (widgets/widgets.js)
   Central registry, native factory router, and inter-panel sync coordinator
   ===================================================================== */

if (!window.EZWidgets) window.EZWidgets = {};

/* =====================================================================
   SHACK SYNC COORDINATOR
   ===================================================================== */
function canonicalPanel(name) {
  if (!name) return '';
  const n = String(name).toLowerCase();
  if (n.includes('circle')) return 'greatCircle';
  if (n.includes('lookup')) return 'lookup';
  if (n.includes('log')) return 'logger';
  return name;
}

function getSyncConfig() {
  try {
    const saved = localStorage.getItem('EZSHACK_PANEL_SYNC');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { lookup: true, logger: true, greatCircle: true };
}

function saveSyncConfig(cfg) {
  try {
    localStorage.setItem('EZSHACK_PANEL_SYNC', JSON.stringify(cfg));
  } catch (e) {}
}

window.getPanelSync = function(panel) {
  const canon = canonicalPanel(panel);
  const cfg = getSyncConfig();
  return cfg[canon] !== false;
};

window.togglePanelSync = function(panel, btnEl) {
  const canon = canonicalPanel(panel);
  const cfg = getSyncConfig();
  cfg[canon] = !cfg[canon];
  saveSyncConfig(cfg);

  const isEnabled = cfg[canon];

  // 1. Direct update if element passed from onclick
  if (btnEl && btnEl instanceof HTMLElement) {
    btnEl.className = isEnabled 
      ? 'px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition bg-cyan-950 text-cyan-400 border-cyan-800' 
      : 'px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300';
    btnEl.innerText = `SYNC: ${isEnabled ? 'ON' : 'OFF'}`;
  }

  // 2. Broadcast class update to all matching buttons across dashboard
  const btns = document.querySelectorAll(`[data-sync-panel="${canon}"], [id*="btnSync-${canon}" i], [id*="btnSync_${canon}" i]`);
  btns.forEach(b => {
    b.className = isEnabled 
      ? 'px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition bg-cyan-950 text-cyan-400 border-cyan-800' 
      : 'px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300';
    b.innerText = `SYNC: ${isEnabled ? 'ON' : 'OFF'}`;
  });

  if (typeof window.showToast === 'function') {
    window.showToast(`${canon.toUpperCase()} Sync: ${isEnabled ? 'ON' : 'OFF'}`);
  }
};

window.syncShackTarget = function(source, data) {
  const canonSource = canonicalPanel(source);
  if (!window.getPanelSync(canonSource)) return;

  const call = (data && data.call) ? String(data.call).trim().toUpperCase() : '';
  const grid = (data && data.grid) ? String(data.grid).trim().toUpperCase() : '';

  try {
    // 1. From Logger blur -> trigger Lookup (never send raw call to Great Circle)
    if (canonSource === 'logger') {
      if (window.getPanelSync('lookup') && call) {
        const lookupInputs = document.querySelectorAll('[id^="lookupCallInput-"]');
        lookupInputs.forEach(inp => {
          if (inp.value.trim().toUpperCase() !== call) {
            inp.value = call;
            const instId = inp.id.replace('lookupCallInput-', '');
            if (typeof window.executeCallsignLookup === 'function') {
              window.executeCallsignLookup(instId);
            }
          }
        });
      }
    }

    // 2. From Lookup -> sync callsign to Logger & Maidenhead grid to Great Circle
    if (canonSource === 'lookup') {
      // Stage call in Station Log
      if (window.getPanelSync('logger') && call) {
        const logCall = document.getElementById('logCall');
        if (logCall && logCall.value.trim().toUpperCase() !== call) {
          logCall.value = call;
          logCall.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      // Stage grid in Great Circle & calculate bearing
      if (window.getPanelSync('greatCircle') && grid) {
        const targetInput = document.getElementById('calcTargetGrid');
        if (targetInput && targetInput.value.trim().toUpperCase() !== grid) {
          targetInput.value = grid;
          if (typeof window.runBearingCalculation === 'function') {
            window.runBearingCalculation();
          }
        }
      }
    }
  } catch (err) {
    console.error('[EZShack Sync] Error during broadcast:', err);
  }
};

/* =====================================================================
   DISPATCHER
   ===================================================================== */
window.buildNativeWidget = function(type, instanceId) {
  if (window.EZWidgets && window.EZWidgets[type]) {
    try {
      return window.EZWidgets[type].render(instanceId);
    } catch (err) {
      console.error(`[EZWidgets] Error rendering widget ${type}:`, err);
    }
  }
  const fallback = document.createElement('div');
  fallback.className = 'p-4 text-slate-400 text-xs font-mono';
  fallback.innerText = `Widget [${type}] not found in EZWidgets.`;
  return fallback;
};