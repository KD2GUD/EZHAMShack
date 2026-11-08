/* =====================================================================
   EZSHACK WIDGET: Shack Scratchpad & Notes (widgets/scratchpad.js)
   Self-contained native notes widget with auto-save & TXT exporter
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  const scratchpadWidget = {
    id: 'shack_scratchpad',
    title: 'Native Shack Scratchpad & Notes',
    category: 'Native Operations',
    description: 'Instant local notes for schedules, net controls, contest frequencies, and skeds.',
    isNative: true,
    defaultW: 3,
    defaultH: 6,

    render(instanceId) {
      const wrapper = document.createElement('div');
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text';
      const textVal = (window.appState && window.appState.scratchpadText) ? window.appState.scratchpadText : '';
      
      wrapper.innerHTML = `
        <div class="h-full flex flex-col space-y-2">
          <textarea id="scratchpadInput" oninput="window.saveScratchpad(this.value)" placeholder="Enter frequencies, contest serials, nets, and skeds here..." class="w-full flex-1 bg-shack-950 border border-shack-border rounded p-2.5 text-xs text-amber-300 font-mono resize-none focus:outline-none focus:border-amber-500 leading-relaxed">${textVal}</textarea>
          <div class="flex justify-between items-center text-[10px] text-slate-500">
            <span>Auto-saved to localStorage</span>
            <div class="flex gap-2">
              <button onclick="window.exportScratchpad()" title="Export notes to a plain text file" class="text-cyan-400 hover:text-cyan-300 underline font-bold">Export TXT</button>
              <button onclick="window.clearScratchpad()" class="text-slate-500 hover:text-red-400">Clear</button>
            </div>
          </div>
        </div>
      `;
      return wrapper;
    }
  };

  // Register under both camelCase and snake_case keys
  window.EZWidgets.scratchpad = scratchpadWidget;
  window.EZWidgets.shack_scratchpad = scratchpadWidget;
})();

/* =====================================================================
   SCRATCHPAD PERSISTENCE & TXT EXPORT
   ===================================================================== */
window.saveScratchpad = function(val) {
  if (!window.appState) return;
  window.appState.scratchpadText = val;
  if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
};

window.clearScratchpad = function() {
  if (!window.appState) return;
  window.appState.scratchpadText = '';
  const ta = document.getElementById('scratchpadInput');
  if (ta) ta.value = '';
  if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
};

window.exportScratchpad = function() {
  const text = (window.appState && window.appState.scratchpadText) ? window.appState.scratchpadText : '';
  if (!text.trim()) {
    if (typeof window.showToast === 'function') window.showToast('Scratchpad is empty.');
    return;
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date().toISOString().slice(0, 10);
  const call = (window.appState && window.appState.profile && window.appState.profile.callsign) ? window.appState.profile.callsign.toUpperCase() : 'SHACK';
  a.download = `EZShack_Notes_${call}_${d}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  if (typeof window.showToast === 'function') window.showToast('Exported scratchpad to TXT file.');
};