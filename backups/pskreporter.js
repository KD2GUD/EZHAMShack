/* =====================================================================
   EZSHACK WIDGET: PSK Reporter Live Spot Map (widgets/pskreporter.js)
   Standalone embed with dynamic callsign resolution and status footer
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  const pskReporterWidget = {
    id: 'psk_reporter',
    title: 'PSK Reporter (Live FT8/Digital Map)',
    category: 'Propagation & Reception',
    description: 'Global real-time map of automatic digital reception spots filtered to your callsign.',
    isNative: false,
    defaultW: 10,
    defaultH: 9,

    render: function(container, pane) {
      const call = (window.appState && window.appState.profile && window.appState.profile.callsign && window.appState.profile.callsign !== 'N0CALL')
        ? window.appState.profile.callsign.trim().toUpperCase()
        : '';

      const targetUrl = call 
        ? `https://pskreporter.info/pskmap.html?${encodeURIComponent(call)}`
        : 'https://pskreporter.info/pskmap.html';

      container.innerHTML = `
        <div class="flex flex-col w-full h-full bg-slate-900 overflow-hidden">
          <div class="flex-1 w-full h-full relative">
            <iframe 
              src="${targetUrl}" 
              class="w-full h-full border-0 absolute inset-0 bg-slate-900"
              allow="geolocation"
            ></iframe>
          </div>
          <div class="px-3 py-1 bg-shack-900 border-t border-shack-800 text-[10px] font-mono text-slate-400 flex justify-between items-center select-none">
            <span class="truncate pr-2">URL: <span class="text-cyan-400">${targetUrl}</span></span>
            <button 
              type="button" 
              onclick="window.open('${targetUrl}', '_blank')" 
              class="ml-2 px-2 py-0.5 bg-shack-800 hover:bg-shack-700 text-slate-300 rounded border border-shack-700 text-[10px]"
            >
              Pop Out ↗
            </button>
          </div>
        </div>
      `;
    }
  };

  window.EZWidgets.psk_reporter = pskReporterWidget;
  window.EZWidgets.pskreporter = pskReporterWidget;
})();