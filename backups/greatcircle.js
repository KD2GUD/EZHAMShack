/* =====================================================================
   EZSHACK WIDGET: Bearing & Great Circle Calculator (widgets/greatcircle.js)
   Antenna beam headings, true azimuth, distance, and Maidenhead math
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  if (!window.appState) window.appState = {};
  if (!window.appState.sync) window.appState.sync = { lookup: true, logger: true, greatCircle: true };

  const greatCircleWidget = {
    id: 'great_circle',
    title: 'Native Bearing & Great Circle Calc',
    category: 'Native Instrumentation',
    description: 'Calculate antenna beam heading, true azimuth, and distance in km/miles between Maidenhead squares.',
    isNative: true,
    defaultW: 3,
    defaultH: 8,

    render(instanceId) {
      const wrapper = document.createElement('div');
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text';
      const opGrid = (window.appState && window.appState.profile && window.appState.profile.grid) ? window.appState.profile.grid : 'AA00aa';
      const isSync = Boolean(window.appState.sync?.greatCircle);

      wrapper.innerHTML = `
        <div class="h-full flex flex-col justify-between space-y-2">
          
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span class="font-bold uppercase tracking-wider text-slate-300">Beam Heading</span>
            <button id="btnToggleGcSync" type="button" onclick="window.togglePanelSync('greatCircle')" class="px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition ${isSync ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300'}">
              SYNC: ${isSync ? 'ON' : 'OFF'}
            </button>
          </div>

          <div class="flex gap-2">
            <div class="flex-1">
              <label class="text-[10px] text-slate-400 block mb-0.5">TARGET GRID</label>
              <input 
                type="text" 
                id="calcTargetGrid" 
                placeholder="e.g. JA1 or PM95" 
                value="PM95" 
                oninput="window.runBearingCalculation()" 
                onblur="window.handleGreatCircleBlur(this.value)"
                class="w-full bg-shack-950 border border-shack-700 rounded px-2 py-1 text-xs text-amber-400 uppercase font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div class="w-28 text-right">
              <label class="text-[10px] text-slate-400 block mb-0.5">OPERATOR GRID</label>
              <div class="text-xs font-bold text-cyan-400 py-1" id="bearingOpGrid">${opGrid}</div>
            </div>
          </div>

          <div class="bg-shack-850 p-3 rounded border border-shack-border flex items-center justify-around">
            <div class="relative w-24 h-24 flex items-center justify-center">
              <svg class="w-full h-full text-shack-700" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="50" cy="50" r="2" fill="#f59e0b"/>
                <text x="50" y="14" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">N</text>
                <text x="88" y="53" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">E</text>
                <text x="50" y="92" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">S</text>
                <text x="12" y="53" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">W</text>
              </svg>
              <div id="bearingNeedle" class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-500" style="transform: rotate(330deg);">
                <div class="w-1 h-16 bg-gradient-to-t from-transparent via-amber-400 to-amber-500 rounded"></div>
              </div>
            </div>

            <div class="space-y-1">
              <div>
                <span class="text-[10px] text-slate-400 block">BEARING (TRUE AZIMUTH)</span>
                <span id="calcBearingValue" class="text-2xl font-lcd font-bold text-amber-400">330°</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block">GREAT CIRCLE DISTANCE</span>
                <span id="calcDistanceValue" class="text-sm font-bold text-cyan-400">10,845 km (6,738 mi)</span>
              </div>
              <div class="text-[9px] text-slate-500">Short Path (SP) Calculation</div>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 text-center">
            Antenna Rotator: Turn beam to <span id="calcBearingEcho" class="text-amber-400 font-bold">330°</span> for optimum gain.
          </div>
        </div>
      `;
      setTimeout(window.runBearingCalculation, 50);
      return wrapper;
    }
  };

  window.EZWidgets.greatCircle = greatCircleWidget;
  window.EZWidgets.great_circle = greatCircleWidget;

  window.handleGreatCircleBlur = function(gridVal) {
    const grid = (gridVal || '').trim().toUpperCase();
    if (grid.length >= 4 && window.appState.sync?.greatCircle) {
      window.broadcastShackSync('greatCircle', { grid });
    }
  };

  // Listener for sync broadcasts from Lookup or Logger
  window.addEventListener('ezshack:sync', (e) => {
    if (e.detail?.origin === 'greatCircle') return;
    if (!window.appState.sync?.greatCircle) return;

    const { grid } = e.detail;
    if (grid && grid.length >= 4) {
      const input = document.getElementById('calcTargetGrid');
      if (input && input.value.toUpperCase() !== grid.toUpperCase()) {
        input.value = grid;
        window.runBearingCalculation();
      }
    }
  });
})();

/* =====================================================================
   BEARING & GREAT CIRCLE MATH HELPERS
   ===================================================================== */
window.maidenheadToLatLon = function(grid) {
  if (!grid || grid.length < 4) return null;
  grid = grid.toUpperCase().trim();
  const l1 = grid.charCodeAt(0) - 65;
  const l2 = grid.charCodeAt(1) - 65;
  const d1 = parseInt(grid.charAt(2), 10);
  const d2 = parseInt(grid.charAt(3), 10);

  let lon = -180 + l1 * 20 + d1 * 2;
  let lat = -90 + l2 * 10 + d2 * 1;

  if (grid.length >= 6) {
    const s1 = grid.charCodeAt(4) - 65;
    const s2 = grid.charCodeAt(5) - 65;
    lon += (s1 + 0.5) * (2 / 24);
    lat += (s2 + 0.5) * (1 / 24);
  } else {
    lon += 1;
    lat += 0.5;
  }
  return { lat, lon };
};

window.calculateGreatCircle = function(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;
  const distMi = distKm * 0.621371;

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;

  return {
    distKm: Math.round(distKm),
    distMi: Math.round(distMi),
    bearing: Math.round(bearing)
  };
};

window.runBearingCalculation = function() {
  const targetInput = document.getElementById('calcTargetGrid');
  if (!targetInput) return;
  const targetVal = targetInput.value.trim().toUpperCase();
  if (targetVal.length < 4) return;

  const grid = (window.appState && window.appState.profile && window.appState.profile.grid) ? window.appState.profile.grid : 'AA00aa';
  const p1 = window.maidenheadToLatLon(grid);
  const p2 = window.maidenheadToLatLon(targetVal);

  if (p1 && p2) {
    const result = window.calculateGreatCircle(p1.lat, p1.lon, p2.lat, p2.lon);
    const bearingElem = document.getElementById('calcBearingValue');
    const distElem = document.getElementById('calcDistanceValue');
    const needle = document.getElementById('bearingNeedle');
    const echoElem = document.getElementById('calcBearingEcho');

    if (bearingElem) bearingElem.innerText = `${result.bearing}°`;
    if (distElem) distElem.innerText = `${result.distKm.toLocaleString()} km (${result.distMi.toLocaleString()} mi)`;
    if (needle) needle.style.transform = `rotate(${result.bearing}deg)`;
    if (echoElem) echoElem.innerText = `${result.bearing}°`;

    if (window.appState) {
      window.appState.targetBearing = result.bearing;
      window.appState.rotatorBearing = result.bearing;
    }
  }
};