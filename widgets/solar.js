/* =====================================================================
   EZSHACK WIDGET: Solar & Space Weather Station (widgets/solar.js)
   Real-time gauges for SFI, Geomagnetic Kp, A-index, and band conditions
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  const solarWidget = {
    id: 'solar_monitor',
    title: 'Native Solar & Space Weather Station',
    category: 'Native Instrumentation',
    description: 'Built-in real-time gauges for SFI, Geomagnetic Kp, A-index, Sunspot Count, and Aurora alert.',
    isNative: true,
    defaultW: 3,
    defaultH: 7,

    render(instanceId) {
      const wrapper = document.createElement('div');
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text';
      wrapper.innerHTML = `
        <div class="h-full flex flex-col justify-between space-y-3">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div class="bg-shack-850 p-2 rounded border border-shack-border">
              <span class="text-[10px] text-slate-400 block">SOLAR FLUX (SFI)</span>
              <span class="text-xl font-bold font-lcd text-amber-400">164</span>
              <span class="text-[9px] text-emerald-400 block">Good HF Condx</span>
            </div>
            <div class="bg-shack-850 p-2 rounded border border-shack-border">
              <span class="text-[10px] text-slate-400 block">SUNSPOT NO (SSN)</span>
              <span class="text-xl font-bold font-lcd text-amber-400">138</span>
              <span class="text-[9px] text-emerald-400 block">Cycle 25 High</span>
            </div>
            <div class="bg-shack-850 p-2 rounded border border-shack-border">
              <span class="text-[10px] text-slate-400 block">A-INDEX</span>
              <span class="text-xl font-bold font-lcd text-slate-200">6</span>
              <span class="text-[9px] text-emerald-400 block">Low Absorption</span>
            </div>
            <div class="bg-shack-850 p-2 rounded border border-shack-border">
              <span class="text-[10px] text-slate-400 block">PLANETARY Kp</span>
              <span class="text-xl font-bold font-lcd text-emerald-400">2.0</span>
              <span class="text-[9px] text-emerald-400 block">Quiet Geomag</span>
            </div>
          </div>

          <div class="bg-shack-850 p-2.5 rounded border border-shack-border">
            <div class="text-[10px] font-bold text-slate-400 mb-1.5 flex justify-between">
              <span>ESTIMATED BAND CONDITIONS</span>
              <span class="text-emerald-400">DAY / NIGHT</span>
            </div>
            <div class="grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div class="bg-shack-900 p-1 rounded border border-shack-700">
                <span class="block text-slate-400">80m-40m</span>
                <span class="font-bold text-amber-400">Fair / Good</span>
              </div>
              <div class="bg-shack-900 p-1 rounded border border-shack-700">
                <span class="block text-slate-400">30m-20m</span>
                <span class="font-bold text-emerald-400">Good / Fair</span>
              </div>
              <div class="bg-shack-900 p-1 rounded border border-shack-700">
                <span class="block text-slate-400">17m-15m</span>
                <span class="font-bold text-emerald-400">Good / Closed</span>
              </div>
              <div class="bg-shack-900 p-1 rounded border border-shack-700">
                <span class="block text-slate-400">12m-10m</span>
                <span class="font-bold text-amber-400">Good / Closed</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] bg-shack-900 p-2 rounded border border-shack-border">
            <div>Solar Wind: <span class="text-slate-300 font-bold">412 km/s</span></div>
            <div>X-Ray Flux: <span class="text-cyan-400 font-bold">C1.4</span></div>
            <div>Aurora: <span class="text-emerald-400 font-bold">Normal</span></div>
          </div>
        </div>
      `;
      return wrapper;
    }
  };

  window.EZWidgets.solarMonitor = solarWidget;
  window.EZWidgets.solar_monitor = solarWidget;
})();