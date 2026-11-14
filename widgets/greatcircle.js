/* =====================================================================
   EZSHACK WIDGET: Bearing & Great Circle Calculator (widgets/greatcircle.js)
   Antenna beam headings, true azimuth, distance, Maidenhead & Zone math
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  const greatCircleWidget = {
    id: 'great_circle',
    title: 'Native Bearing & Great Circle Calc',
    category: 'Native Instrumentation',
    description: 'Calculate antenna beam heading, true azimuth, and distance in km/miles between Maidenhead squares.',
    isNative: true,
    defaultW: 3,
    defaultH: 8,

    render(containerOrId, pane) {
      const wrapper = document.createElement('div');
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text';
      const opGrid = (window.appState && window.appState.profile && window.appState.profile.grid) ? window.appState.profile.grid : 'AA00aa';
      const isSync = window.getPanelSync ? window.getPanelSync('greatCircle') : true;

      wrapper.innerHTML = `
        <div class="h-full flex flex-col justify-between space-y-2">
          
          <!-- Top Row: Target Input & Sync Toggle -->
          <div class="flex gap-2 items-end">
            <div class="flex-1">
              <div class="flex items-center justify-between mb-0.5">
                <label class="text-[10px] text-slate-400 block">TARGET GRID</label>
                <button 
                  type="button" 
                  id="btnSync-greatCircle" 
                  data-sync-panel="greatCircle"
                  onclick="window.togglePanelSync('greatCircle', this)" 
                  title="Toggle auto-sync with Lookup & QuickLog"
                  class="px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${isSync ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300'}"
                >
                  SYNC: ${isSync ? 'ON' : 'OFF'}
                </button>
              </div>
              <input 
                type="text" 
                id="calcTargetGrid" 
                placeholder="e.g. PM86 or FN31" 
                value="PM95" 
                oninput="window.runBearingCalculation()" 
                onblur="window.runBearingCalculation()"
                class="w-full bg-shack-950 border border-shack-700 rounded px-2 py-1 text-xs text-amber-400 uppercase font-bold focus:outline-none focus:border-amber-500"
              >
            </div>
            <div class="w-24 text-right">
              <label class="text-[10px] text-slate-400 block mb-0.5">STATION GRID</label>
              <div class="text-xs font-bold text-cyan-400 py-1" id="bearingOpGrid">${opGrid}</div>
            </div>
          </div>

          <!-- Compass & Readout -->
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
})();

/* =====================================================================
   BEARING, MAIDENHEAD & CQ / ITU ZONE MATH HELPERS
   ===================================================================== */
window.maidenheadToLatLon = function(grid) {
  if (!grid || typeof grid !== 'string') return null;
  grid = grid.toUpperCase().trim();
  if (grid.length < 4) return null;

  const l1 = grid.charCodeAt(0) - 65;
  const l2 = grid.charCodeAt(1) - 65;
  const d1 = parseInt(grid.charAt(2), 10);
  const d2 = parseInt(grid.charAt(3), 10);

  if (l1 < 0 || l1 > 17 || l2 < 0 || l2 > 17 || isNaN(d1) || isNaN(d2)) return null;

  let lon = -180 + l1 * 20 + d1 * 2;
  let lat = -90 + l2 * 10 + d2 * 1;

  if (grid.length >= 6) {
    const s1 = grid.charCodeAt(4) - 65;
    const s2 = grid.charCodeAt(5) - 65;
    if (s1 >= 0 && s1 <= 23 && s2 >= 0 && s2 <= 23) {
      lon += (s1 + 0.5) * (2 / 24);
      lat += (s2 + 0.5) * (1 / 24);
      return { lat, lon };
    }
  }
  lon += 1;
  lat += 0.5;
  return { lat, lon };
};

window.latLonToMaidenhead = function(lat, lon) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return null;
  }

  const adjLon = lonNum + 180.0;
  const adjLat = latNum + 90.0;

  const fieldLon = Math.min(17, Math.max(0, Math.floor(adjLon / 20)));
  const fieldLat = Math.min(17, Math.max(0, Math.floor(adjLat / 10)));

  const sqLon = Math.min(9, Math.max(0, Math.floor((adjLon % 20) / 2)));
  const sqLat = Math.min(9, Math.max(0, Math.floor(adjLat % 10)));

  const subLon = Math.min(23, Math.max(0, Math.floor(((adjLon % 2) / 2) * 24)));
  const subLat = Math.min(23, Math.max(0, Math.floor((adjLat % 1) * 24)));

  const f1 = String.fromCharCode(65 + fieldLon);
  const f2 = String.fromCharCode(65 + fieldLat);
  const s1 = String.fromCharCode(97 + subLon);
  const s2 = String.fromCharCode(97 + subLat);

  return `${f1}${f2}${sqLon}${sqLat}${s1}${s2}`;
};

window.estimateZonesFromLocation = function(opts) {
  const state = (opts && opts.state ? String(opts.state) : '').trim().toUpperCase();
  const country = (opts && opts.country ? String(opts.country) : '').trim().toUpperCase();
  const lat = opts && opts.lat !== undefined ? parseFloat(opts.lat) : NaN;
  const lon = opts && opts.lon !== undefined ? parseFloat(opts.lon) : NaN;

  const US_STATE_ZONES = {
    // CQ Zone 5, ITU Zone 8 (US East)
    CT: { cqz: '5', ituz: '8' }, DC: { cqz: '5', ituz: '8' }, DE: { cqz: '5', ituz: '8' },
    FL: { cqz: '5', ituz: '8' }, GA: { cqz: '5', ituz: '8' }, MA: { cqz: '5', ituz: '8' },
    MD: { cqz: '5', ituz: '8' }, ME: { cqz: '5', ituz: '8' }, NC: { cqz: '5', ituz: '8' },
    NH: { cqz: '5', ituz: '8' }, NJ: { cqz: '5', ituz: '8' }, NY: { cqz: '5', ituz: '8' },
    PA: { cqz: '5', ituz: '8' }, RI: { cqz: '5', ituz: '8' }, SC: { cqz: '5', ituz: '8' },
    VA: { cqz: '5', ituz: '8' }, VT: { cqz: '5', ituz: '8' }, WV: { cqz: '5', ituz: '8' },
    // CQ Zone 4, ITU Zone 8 (Great Lakes / East-Central)
    AL: { cqz: '4', ituz: '8' }, IL: { cqz: '4', ituz: '8' }, IN: { cqz: '4', ituz: '8' },
    KY: { cqz: '4', ituz: '8' }, MI: { cqz: '4', ituz: '8' }, MS: { cqz: '4', ituz: '8' },
    OH: { cqz: '4', ituz: '8' }, TN: { cqz: '4', ituz: '8' }, WI: { cqz: '4', ituz: '8' },
    // CQ Zone 4, ITU Zone 7 (Plains & Mountain Central)
    AR: { cqz: '4', ituz: '7' }, CO: { cqz: '4', ituz: '7' }, IA: { cqz: '4', ituz: '7' },
    KS: { cqz: '4', ituz: '7' }, LA: { cqz: '4', ituz: '7' }, MN: { cqz: '4', ituz: '7' },
    MO: { cqz: '4', ituz: '7' }, MT: { cqz: '4', ituz: '7' }, ND: { cqz: '4', ituz: '7' },
    NE: { cqz: '4', ituz: '7' }, NM: { cqz: '4', ituz: '7' }, OK: { cqz: '4', ituz: '7' },
    SD: { cqz: '4', ituz: '7' }, TX: { cqz: '4', ituz: '7' }, WY: { cqz: '4', ituz: '7' },
    // CQ Zone 3, ITU Zone 7 (Mountain West)
    AZ: { cqz: '3', ituz: '7' }, ID: { cqz: '3', ituz: '7' }, UT: { cqz: '3', ituz: '7' },
    // CQ Zone 3, ITU Zone 6 (Pacific Coast)
    CA: { cqz: '3', ituz: '6' }, NV: { cqz: '3', ituz: '6' }, OR: { cqz: '3', ituz: '6' },
    WA: { cqz: '3', ituz: '6' },
    // Non-contiguous US
    AK: { cqz: '1', ituz: '1' },
    HI: { cqz: '31', ituz: '61' },
    PR: { cqz: '8', ituz: '11' },
    VI: { cqz: '8', ituz: '11' }
  };

  if (state && US_STATE_ZONES[state] && (!country || country === 'USA' || country === 'US' || country === 'UNITED STATES')) {
    return US_STATE_ZONES[state];
  }

  // Geographic fallback from Lat/Lon when state is unavailable
  if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
    // North America bounds
    if (lat >= 24 && lat <= 72 && lon >= -170 && lon <= -52) {
      if (lat >= 54 && lon <= -130) return { cqz: '1', ituz: '1' };
      let cqz = '4';
      if (lon <= -114) cqz = '3';
      else if (lon >= -85) cqz = '5';
      let ituz = '7';
      if (lon <= -118) ituz = '6';
      else if (lon >= -90) ituz = '8';
      return { cqz, ituz };
    }
    // Hawaii
    if (lat >= 18 && lat <= 23 && lon >= -162 && lon <= -154) {
      return { cqz: '31', ituz: '61' };
    }
    // Western / Central Europe
    if (lat >= 35 && lat <= 71 && lon >= -11 && lon <= 30) {
      return { cqz: lon < 15 ? '14' : '15', ituz: lon < 12 ? '27' : '28' };
    }
    // Japan / East Asia
    if (lat >= 24 && lat <= 46 && lon >= 122 && lon <= 146) {
      return { cqz: '25', ituz: '45' };
    }
    // Australia
    if (lat >= -44 && lat <= -10 && lon >= 112 && lon <= 154) {
      return { cqz: lon < 138 ? '29' : '30', ituz: lon < 138 ? '58' : '59' };
    }
  }

  return { cqz: '', ituz: '' };
};

window.calculateGreatCircle = function(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(phi1) * Math.cos(phi2);
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
  }
};
