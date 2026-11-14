/* =====================================================================
   EZSHACK WIDGET: PSK Reporter Live Spot Map (widgets/pskreporter.js)
   Standalone widget renderer with dynamic callsign resolution & footer
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const pskReporterWidget = {
    id: 'psk_reporter',
    title: 'PSK Reporter (Live FT8/Digital Map)',
    category: 'Propagation & Reception',
    description: 'Global real-time map of automatic digital reception spots filtered to your callsign.',
    // Must be true so panes.js invokes this widget's custom render() instead of an empty generic embed
    isNative: true,
    defaultW: 10,
    defaultH: 9,

    render: function(container, pane) {
      const rawCall = (window.appState && window.appState.profile && window.appState.profile.callsign)
        ? window.appState.profile.callsign.trim().toUpperCase()
        : '';
      const call = (rawCall && rawCall !== 'N0CALL') ? rawCall : '';

      const targetUrl = call
        ? `https://pskreporter.info/pskmap.html?${encodeURIComponent(call)}`
        : 'https://pskreporter.info/pskmap.html';

      const safeUrl = escapeAttr(targetUrl);
      const instId = (pane && pane.instanceId) ? pane.instanceId : Math.random().toString(36).slice(2, 9);

      container.innerHTML = `
        <div class="flex flex-col w-full h-full bg-slate-900 overflow-hidden">
          <div class="flex-1 w-full h-full relative bg-shack-950">
            <div id="psk-loader-${instId}" class="absolute inset-0 bg-shack-950 flex flex-col items-center justify-center gap-2 text-xs font-mono text-slate-400 z-10 pointer-events-none">
              <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading PSK Reporter Live Spot Map...</span>
            </div>
            <iframe
              id="psk-iframe-${instId}"
              src="${safeUrl}"
              onload="const l=document.getElementById('psk-loader-${instId}'); if(l) l.style.display='none';"
              class="w-full h-full border-0 absolute inset-0 bg-slate-900"
              allow="geolocation"
              referrerpolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
          <div class="shrink-0 px-3 py-1 bg-shack-900 border-t border-shack-800 text-[10px] font-mono text-slate-400 flex justify-between items-center select-none">
            <span class="truncate pr-2" title="${safeUrl}">SRC: <span class="text-cyan-400">${safeUrl}</span></span>
            <button
              type="button"
              onclick="window.open('${safeUrl}', '_blank', 'noopener,noreferrer')"
              class="ml-2 px-2 py-0.5 bg-shack-800 hover:bg-shack-700 text-slate-300 rounded border border-shack-700 text-[10px] shrink-0 transition"
            >
              Pop Out ↗
            </button>
          </div>
        </div>
      `;
    }
  };

  // Self-heal any legacy saved psk_reporter panes stored with isNative: false
  window.addEventListener('DOMContentLoaded', () => {
    if (window.appState && Array.isArray(window.appState.panes)) {
      let repaired = false;
      window.appState.panes.forEach(p => {
        if (p && (p.catalogId === 'psk_reporter' || p.widgetType === 'psk_reporter' || p.widgetType === 'pskreporter') && p.isNative === false) {
          p.isNative = true;
          repaired = true;
        }
      });
      if (repaired && typeof window.saveStateToStorage === 'function') {
        window.saveStateToStorage();
      }
    }
  });

  window.EZWidgets.psk_reporter = pskReporterWidget;
  window.EZWidgets.pskreporter = pskReporterWidget;
})();
