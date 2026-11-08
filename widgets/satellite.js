/* =====================================================================
   EZSHACK - AMATEUR RADIO SATELLITE TRACKER (widgets/satellite.js)
   SGP4 Orbital Tracking, Doppler CAT, Next-Pass, Alerts & Auto-Sync
   ===================================================================== */

const TLE_MAX_AGE_DAYS = 3; // Number of days before auto-fetching fresh TLEs

const DEFAULT_SATELLITE_CATALOG = [
  {
    id: 'ISS',
    name: 'ISS (Zarya / ARISS)',
    norad: 25544,
    type: 'FM / APRS',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'FM Voice Crossband Repeater', downlink: 437800000, uplink: 145990000, tone: '67.0 Hz', mode: 'FM', inverted: false },
      { name: 'APRS Digipeater', downlink: 145825000, uplink: 145825000, tone: 'None', mode: 'FM', inverted: false }
    ],
    tle1: '1 25544U 98067A   26307.50000000  .00000000  00000-0  00000-0 0  9991',
    tle2: '2 25544  51.6416 112.5642 0004381  62.1524  43.2085 15.49842144445028'
  },
  {
    id: 'SO50',
    name: 'SO-50 (SaudiSat-1C)',
    norad: 27540,
    type: 'FM Repeater',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U FM Voice Repeater', downlink: 436795000, uplink: 145850000, tone: '67.0 Hz (Arm: 74.4)', mode: 'FM', inverted: false }
    ],
    tle1: '1 27540U 02058C   26307.45000000  .00000000  00000-0  00000-0 0  9992',
    tle2: '2 27540  64.5574 246.3218 0081395 257.6541 101.4285 14.75782140156942'
  },
  {
    id: 'AO91',
    name: 'AO-91 (RadFxSat / Fox-1B)',
    norad: 43015,
    type: 'FM Repeater',
    bands: 'U/V',
    active: true,
    transponders: [
      { name: 'U/V FM Voice Repeater', downlink: 145960000, uplink: 435250000, tone: '67.0 Hz', mode: 'FM', inverted: false }
    ],
    tle1: '1 43015U 17073H   26307.50000000  .00000000  00000-0  00000-0 0  9993',
    tle2: '2 43015  97.6821 154.2185 0241250 215.3421 143.2514 14.82512140345012'
  },
  {
    id: 'PO101',
    name: 'PO-101 (Diwata-2)',
    norad: 43678,
    type: 'FM Repeater',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U FM Voice Repeater', downlink: 437500000, uplink: 145900000, tone: '141.3 Hz', mode: 'FM', inverted: false }
    ],
    tle1: '1 43678U 18084H   26307.50000000  .00000000  00000-0  00000-0 0  9994',
    tle2: '2 43678  97.9421 162.4512 0012410 180.2514 179.8512 14.98124510291452'
  },
  {
    id: 'RS44',
    name: 'RS-44 (DOSAAF)',
    norad: 44909,
    type: 'Linear SSB/CW',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U Inverting Linear Passband', downlink: 435640000, uplink: 145965000, tone: 'Inverting (60 kHz BW)', mode: 'USB', inverted: true },
      { name: 'CW Telemetry Beacon', downlink: 435605000, uplink: 0, tone: 'CW Beacon', mode: 'CW', inverted: false }
    ],
    tle1: '1 44909U 19096E   26307.50000000  .00000000  00000-0  00000-0 0  9995',
    tle2: '2 44909  82.5124 315.4215 0214512 280.1245  78.2514 12.79512410214521'
  },
  {
    id: 'CAS4A',
    name: 'CAS-4A (Zhongyou-1A)',
    norad: 42761,
    type: 'Linear SSB/CW',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U Inverting Linear Passband', downlink: 435330000, uplink: 145870000, tone: 'Inverting (30 kHz BW)', mode: 'USB', inverted: true },
      { name: 'CW Telemetry Beacon', downlink: 435325000, uplink: 0, tone: 'CW Beacon', mode: 'CW', inverted: false }
    ],
    tle1: '1 42761U 17034B   26307.50000000  .00000000  00000-0  00000-0 0  9996',
    tle2: '2 42761  43.0152  85.2415 0014215 120.4512 240.1245 15.12451240375124'
  },
  {
    id: 'CAS4B',
    name: 'CAS-4B (Zhongyou-1B)',
    norad: 42759,
    type: 'Linear SSB/CW',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U Inverting Linear Passband', downlink: 435385000, uplink: 145925000, tone: 'Inverting (30 kHz BW)', mode: 'USB', inverted: true }
    ],
    tle1: '1 42759U 17034D   26307.50000000  .00000000  00000-0  00000-0 0  9997',
    tle2: '2 42759  43.0184  87.1245 0013512 118.2514 242.4512 15.12154120374851'
  },
  {
    id: 'XW2A',
    name: 'XW-2A (XiWang-2A)',
    norad: 40903,
    type: 'Linear SSB/CW',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U Inverting Linear Passband', downlink: 435040000, uplink: 145670000, tone: 'Inverting (20 kHz BW)', mode: 'USB', inverted: true }
    ],
    tle1: '1 40903U 15049E   26307.50000000  .00000000  00000-0  00000-0 0  9998',
    tle2: '2 40903  97.4512 185.1245 0012541 210.1245 149.8512 15.05124120465124'
  },
  {
    id: 'JO97',
    name: 'JO-97 (JY1Sat)',
    norad: 43803,
    type: 'Linear SSB/CW',
    bands: 'V/U',
    active: true,
    transponders: [
      { name: 'V/U Inverting Linear Passband', downlink: 435115000, uplink: 145985000, tone: 'Inverting (20 kHz BW)', mode: 'USB', inverted: true }
    ],
    tle1: '1 43803U 18099AX  26307.50000000  .00000000  00000-0  00000-0 0  9999',
    tle2: '2 43803  97.6812 192.4512 0014210 215.4512 144.5124 15.08451240294152'
  }
];

// Restore cached TLE elements from localStorage if available
window.SATELLITE_CATALOG = window.SATELLITE_CATALOG || DEFAULT_SATELLITE_CATALOG;
try {
  const cachedTLEs = localStorage.getItem('EZSHACK_CACHED_TLES');
  if (cachedTLEs) {
    const tleMap = JSON.parse(cachedTLEs);
    window.SATELLITE_CATALOG.forEach(sat => {
      if (tleMap[sat.norad]) {
        sat.tle1 = tleMap[sat.norad].tle1;
        sat.tle2 = tleMap[sat.norad].tle2;
      }
    });
  }
} catch (e) {
  console.warn('[Satellite Tracker] Failed restoring cached TLEs:', e);
}

const SATELLITE_CATALOG = window.SATELLITE_CATALOG;

let selectedSatId = 'SO50';
let activeFilter = 'ALL';
let satTrackingTimer = null;
let cachedNextPass = null;
let activeSatrec = null;
let isLibraryLoading = false;

let userHasManuallySelected = false;
let catalogPassRankings = {};
let lastPassScanTimestamp = 0;

let dopplerMode = 'ALL';
let forceDopplerTest = false;
let currentCalculatedDoppler70cm = 0;

let activeTrackedTransponder = null;
let isTuningInProgress = false;

// Audible Alert State & Web Audio Context
let audioAlertsEnabled = (localStorage.getItem('EZSHACK_SAT_AUDIO_ALERT') === 'true');
let satAudioCtx = null;
let alerted1MinPassKey = null;
let alertedAosPassKey = null;

const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

/* =====================================================================
   SYNTHESIZED WEB AUDIO ALERT ENGINE
   ===================================================================== */
function getSatAudioContext() {
  if (!satAudioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      satAudioCtx = new AudioCtxClass();
    }
  }
  if (satAudioCtx && satAudioCtx.state === 'suspended') {
    satAudioCtx.resume();
  }
  return satAudioCtx;
}

function playBeepTone(freqHz, waveType, durationMs, delayMs = 0, peakGain = 0.15) {
  const ctx = getSatAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime + (delayMs / 1000.0);
  const stopTime = startTime + (durationMs / 1000.0);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveType || 'sine';
  osc.frequency.setValueAtTime(freqHz, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(stopTime);
}

function play1MinWarningTone() {
  playBeepTone(659.25, 'sine', 120, 0, 0.20);
  playBeepTone(880.00, 'sine', 180, 150, 0.25);
}

function playAosAcquisitionTone() {
  playBeepTone(523.25, 'triangle', 110, 0, 0.20);
  playBeepTone(659.25, 'triangle', 110, 130, 0.22);
  playBeepTone(1046.50, 'sine', 320, 260, 0.30);
}

window.toggleSatAudioAlerts = function() {
  audioAlertsEnabled = !audioAlertsEnabled;
  localStorage.setItem('EZSHACK_SAT_AUDIO_ALERT', audioAlertsEnabled ? 'true' : 'false');
  
  getSatAudioContext();

  const btn = document.getElementById('btnSatAudioAlert');
  if (btn) {
    if (audioAlertsEnabled) {
      btn.className = 'px-1.5 py-1 bg-amber-950 border border-amber-700 text-amber-300 font-bold rounded text-[10px] transition shadow-sm';
      btn.innerHTML = '🔔 Alert: ON';
      playBeepTone(880, 'sine', 80, 0, 0.15);
      if (typeof window.showToast === 'function') {
        window.showToast('Satellite Audio Alerts ON (1-min warning & AOS horizon chime)');
      }
    } else {
      btn.className = 'px-1.5 py-1 bg-shack-800 hover:bg-shack-700 border border-shack-700 text-slate-400 rounded text-[10px] transition';
      btn.innerHTML = '🔕 Alert: OFF';
      if (typeof window.showToast === 'function') {
        window.showToast('Satellite Audio Alerts Muted');
      }
    }
  }
};

/* =====================================================================
   COORDINATES & PASS DISCOVERY
   ===================================================================== */
function extractToneHz(toneStr) {
  if (!toneStr || typeof toneStr !== 'string') return 0;
  const match = toneStr.match(/(\d+\.?\d*)\s*Hz/i);
  return match ? parseFloat(match[1]) : 0;
}

function getObserverGd() {
  const profile = (window.appState && window.appState.profile) ? window.appState.profile : null;
  if (!profile) return null;

  let lat = null;
  let lon = null;
  const altKm = (typeof profile.altitudeMeters === 'number') ? (profile.altitudeMeters / 1000.0) : 0.05;

  if (profile.grid && profile.grid.length >= 4 && typeof window.maidenheadToLatLon === 'function') {
    const coords = window.maidenheadToLatLon(profile.grid);
    if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
      lat = coords.lat;
      lon = coords.lon;
    }
  }

  if (lat === null || lon === null) {
    if (typeof profile.lat === 'number' && typeof profile.lon === 'number' && !isNaN(profile.lat) && !isNaN(profile.lon)) {
      lat = profile.lat;
      lon = profile.lon;
    }
  }

  if (lat === null || lon === null) return null;

  return {
    latitude: lat * DEG_TO_RAD,
    longitude: lon * DEG_TO_RAD,
    height: altKm,
    latDeg: lat,
    lonDeg: lon
  };
}

function ensureSatelliteLibrary(callback) {
  if (typeof satellite !== 'undefined') {
    callback();
    return;
  }
  if (isLibraryLoading) return;
  isLibraryLoading = true;

  const pill = document.getElementById('satPassStatusPill');
  if (pill) {
    pill.className = 'mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-800 text-cyan-400 animate-pulse';
    pill.innerText = 'Connecting orbital library...';
  }

  const cdnList = [
    'https://cdn.jsdelivr.net/npm/satellite.js@4.0.2/dist/satellite.min.js',
    'https://unpkg.com/satellite.js@4.0.2/dist/satellite.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/satellite.js/4.1.3/satellite.min.js'
  ];

  let cdnIdx = 0;
  function tryNextCdn() {
    if (cdnIdx >= cdnList.length) {
      isLibraryLoading = false;
      if (pill) {
        pill.className = 'mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 border border-red-800 text-red-400';
        pill.innerText = 'Library load blocked (offline/firewall)';
      }
      return;
    }
    const script = document.createElement('script');
    script.src = cdnList[cdnIdx++];
    script.onload = () => {
      isLibraryLoading = false;
      callback();
    };
    script.onerror = () => {
      script.remove();
      tryNextCdn();
    };
    document.head.appendChild(script);
  }
  tryNextCdn();
}

function compassHeading(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
}

function scanAndRankAllSatellites(obsCoords, forceAutoSelect = false) {
  if (!obsCoords || typeof satellite === 'undefined') return;

  const now = new Date();
  catalogPassRankings = {};

  SATELLITE_CATALOG.forEach(sat => {
    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      const pass = calculateNextPass(satrec, obsCoords, now);

      if (pass) {
        const aosDiffMs = pass.aosTime.getTime() - now.getTime();
        const losDiffMs = pass.losTime.getTime() - now.getTime();

        if (aosDiffMs <= 0 && losDiffMs > 0) {
          catalogPassRankings[sat.id] = {
            pass,
            sortKey: -1000000 - pass.maxEl,
            badgeText: `[● NOW · ${pass.maxEl}°]`
          };
        } else if (aosDiffMs > 0) {
          const totalSec = Math.floor(aosDiffMs / 1000);
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;

          catalogPassRankings[sat.id] = {
            pass,
            sortKey: pass.aosTime.getTime(),
            badgeText: `[in ${timeLabel} · ${pass.maxEl}°]`
          };
        }
      } else {
        catalogPassRankings[sat.id] = {
          pass: null,
          sortKey: Number.MAX_SAFE_INTEGER,
          badgeText: `[No pass 24h]`
        };
      }
    } catch (e) {
      catalogPassRankings[sat.id] = {
        pass: null,
        sortKey: Number.MAX_SAFE_INTEGER,
        badgeText: `[---]`
      };
    }
  });

  lastPassScanTimestamp = Date.now();

  if (forceAutoSelect || !userHasManuallySelected) {
    const sorted = [...SATELLITE_CATALOG].sort((a, b) => {
      const scoreA = catalogPassRankings[a.id]?.sortKey ?? Number.MAX_SAFE_INTEGER;
      const scoreB = catalogPassRankings[b.id]?.sortKey ?? Number.MAX_SAFE_INTEGER;
      return scoreA - scoreB;
    });

    if (sorted.length > 0 && sorted[0].id !== selectedSatId) {
      selectedSatId = sorted[0].id;
      cachedNextPass = catalogPassRankings[selectedSatId]?.pass || null;
      activeSatrec = null;
    }
  }

  window.renderSatelliteDropdown();
}

// DROPDOWN RENDERER: Removed [V/U] from options
window.renderSatelliteDropdown = function() {
  const dropdown = document.getElementById('satSelectDropdown');
  if (!dropdown) return;

  const filtered = SATELLITE_CATALOG.filter(s => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'FM') return s.type.includes('FM');
    if (activeFilter === 'LINEAR') return s.type.includes('Linear');
    if (activeFilter === 'VU') return s.bands === 'V/U';
    if (activeFilter === 'UV') return s.bands === 'U/V';
    return true;
  });

  filtered.sort((a, b) => {
    const scoreA = catalogPassRankings[a.id]?.sortKey ?? Number.MAX_SAFE_INTEGER;
    const scoreB = catalogPassRankings[b.id]?.sortKey ?? Number.MAX_SAFE_INTEGER;
    return scoreA - scoreB;
  });

  dropdown.innerHTML = filtered.map(s => {
    const badge = catalogPassRankings[s.id]?.badgeText || '';
    return `<option value="${s.id}" ${s.id === selectedSatId ? 'selected' : ''}>${badge} ${s.name}</option>`;
  }).join('');
};

const satWidgetDefinition = {
  id: 'satellite_tracker',
  title: 'Native Satellite Tracker & Doppler',
  category: 'Native Instrumentation',
  description: 'Real-time amateur satellite orbital tracking, next pass predictions, polar radar view, and Doppler-corrected split rig tuning.',
  defaultW: 8,
  defaultH: 9,
  render(containerOrId, pane) {
    const instId = (pane && pane.instanceId) ? pane.instanceId : (typeof containerOrId === 'string' ? containerOrId : 'sat_tracker');
    const wrapper = document.createElement('div');
    wrapper.id = `satWidget-${instId}`;
    wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text flex flex-col justify-between space-y-2';

    wrapper.innerHTML = `
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-2 bg-shack-850 p-2 rounded border border-shack-border shrink-0">
        <div class="flex items-center gap-1.5">
          <label class="text-[10px] text-slate-400 uppercase font-bold">Bird:</label>
          <select id="satSelectDropdown" onchange="window.onSatelliteSelect(this.value, true)" class="bg-shack-950 border border-shack-700 text-amber-400 font-bold rounded px-2 py-1 text-xs focus:outline-none max-w-[200px] sm:max-w-[260px] truncate">
            ${SATELLITE_CATALOG.map(s => `<option value="${s.id}" ${s.id === selectedSatId ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
          <button onclick="window.rescanAndPickNext()" title="Re-order list and automatically select next upcoming satellite" class="px-1.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-bold rounded text-[10px] transition">
            ⏭ Next
          </button>
          <button onclick="window.fetchLiveTLEs(true)" title="Update Keplerian elements directly from CelesTrak" class="px-1.5 py-1 bg-shack-800 hover:bg-shack-700 border border-shack-700 text-cyan-400 rounded text-[10px] transition">
            🔄 TLE
          </button>
          <!-- Audible Milestone Alert Toggle -->
          <button onclick="window.toggleSatAudioAlerts()" id="btnSatAudioAlert" class="px-1.5 py-1 rounded text-[10px] font-bold border transition ${audioAlertsEnabled ? 'bg-amber-950 border-amber-700 text-amber-300' : 'bg-shack-800 border-shack-700 text-slate-400'}" title="Toggle audible 1-min pre-pass chime and AOS horizon fanfare">
            ${audioAlertsEnabled ? '🔔 Alert: ON' : '🔕 Alert: OFF'}
          </button>
        </div>

        <div class="inline-flex rounded border border-shack-700 bg-shack-900 p-0.5 text-[10px]">
          <button onclick="window.filterSatellites('ALL')" id="satFilter-ALL" class="px-2 py-0.5 rounded ${activeFilter === 'ALL' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}">All</button>
          <button onclick="window.filterSatellites('FM')" id="satFilter-FM" class="px-2 py-0.5 rounded ${activeFilter === 'FM' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}">FM</button>
          <button onclick="window.filterSatellites('LINEAR')" id="satFilter-LINEAR" class="px-2 py-0.5 rounded ${activeFilter === 'LINEAR' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}">SSB/CW</button>
          <button onclick="window.filterSatellites('VU')" id="satFilter-VU" class="px-2 py-0.5 rounded ${activeFilter === 'VU' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}">V/U</button>
          <button onclick="window.filterSatellites('UV')" id="satFilter-UV" class="px-2 py-0.5 rounded ${activeFilter === 'UV' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}">U/V</button>
        </div>
      </div>

      <!-- Radar and Telemetry -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 bg-shack-850 p-2.5 rounded border border-shack-border flex-1 items-center">
        <div class="flex flex-col items-center justify-center relative">
          <div class="relative w-36 h-36 flex items-center justify-center">
            <svg class="w-full h-full text-shack-700 select-none" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="65" fill="#070a0f" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="70" cy="70" r="43" fill="none" stroke="#1f2c42" stroke-width="1" stroke-dasharray="2,2"/>
              <circle cx="70" cy="70" r="21" fill="none" stroke="#1f2c42" stroke-width="1" stroke-dasharray="2,2"/>
              <line x1="70" y1="5" x2="70" y2="135" stroke="#1f2c42" stroke-width="1"/>
              <line x1="5" y1="70" x2="135" y2="70" stroke="#1f2c42" stroke-width="1"/>
              <text x="70" y="14" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">N</text>
              <text x="128" y="73" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">E</text>
              <text x="70" y="132" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">S</text>
              <text x="12" y="73" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">W</text>
            </svg>
            <div id="satRadarBlip" class="absolute w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_10px_#00f0ff] transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none" style="left: 70px; top: 70px; display: none;"></div>
          </div>
          <span id="satPassStatusPill" class="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-shack-900 border border-shack-700 text-slate-400">
            AOS: Initializing...
          </span>
        </div>

        <div class="space-y-1.5 text-[11px]">
          <div class="flex justify-between border-b border-shack-800 pb-1">
            <span class="text-slate-400">ELEVATION:</span>
            <span id="satElVal" class="font-lcd font-bold text-slate-400">0.0°</span>
          </div>
          <div class="flex justify-between border-b border-shack-800 pb-1">
            <span class="text-slate-400">AZIMUTH / BEAM:</span>
            <span id="satAzVal" class="font-lcd font-bold text-amber-400">---°</span>
          </div>
          <div class="flex justify-between border-b border-shack-800 pb-1">
            <span class="text-slate-400">SLANT RANGE:</span>
            <span id="satRangeVal" class="font-mono text-cyan-400 font-bold">--- km</span>
          </div>
          <div class="flex justify-between border-b border-shack-800 pb-1">
            <span class="text-slate-400">ALTITUDE:</span>
            <span id="satAltVal" class="font-mono text-slate-300">--- km</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-slate-400">70cm DOPPLER SHIFT:</span>
            <span id="satDopplerVal" class="font-mono font-bold text-amber-400">0 Hz</span>
          </div>
        </div>
      </div>

      <!-- NEXT PASS PREDICTION CARD -->
      <div class="bg-shack-850 border border-shack-border rounded p-2.5">
        <div class="flex items-center justify-between text-[11px] border-b border-shack-800 pb-1 mb-2">
          <span class="font-bold text-slate-300 uppercase flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>NEXT PASS PREDICTION</span>
          </span>
          <span id="nextPassCountdown" class="text-amber-400 font-bold font-mono text-xs">Scanning...</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div class="bg-shack-900 p-2 rounded border border-shack-700 flex flex-col justify-center">
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">AOS (UTC)</span>
            <span id="passAosTime" class="font-bold text-sm sm:text-base text-amber-300 font-mono tracking-wider">--:--:-- Z</span>
          </div>
          <div class="bg-shack-900 p-2 rounded border border-shack-700 flex flex-col justify-center">
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">MAX EL</span>
            <span id="passMaxEl" class="font-bold text-sm sm:text-base text-emerald-400 font-mono">--°</span>
          </div>
          <div class="bg-shack-900 p-2 rounded border border-shack-700 flex flex-col justify-center">
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">DURATION</span>
            <span id="passDuration" class="font-bold text-sm sm:text-base text-cyan-400 font-mono">-- min</span>
          </div>
          <div class="bg-shack-900 p-2 rounded border border-shack-700 flex flex-col justify-center">
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">TRAJECTORY</span>
            <span id="passTrajectory" class="font-bold text-xs sm:text-sm text-slate-200 font-mono leading-tight">--- ➔ ---</span>
          </div>
        </div>
      </div>

      <!-- Transponders List with Doppler Controls -->
      <div class="bg-shack-950 border border-shack-border rounded overflow-hidden">
        <div class="px-2.5 py-1.5 bg-shack-850 border-b border-shack-border flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span class="font-bold text-slate-300">TRANSPONDERS & FREQUENCIES</span>
          <div class="flex items-center gap-2">
            <button onclick="window.toggleForceDopplerTest()" id="btnForceDoppler" class="px-2 py-0.5 rounded border border-amber-800/80 bg-amber-950/40 text-amber-400 hover:bg-amber-900/60 font-bold transition" title="Overrides horizon gate to verify VFO stepping on the bench">
              ⚡ Bench Test Mode: OFF
            </button>

            <span class="text-slate-400 font-bold">DOPPLER:</span>
            <div class="inline-flex rounded border border-shack-700 bg-shack-900 p-0.5 text-[9px]">
              <button onclick="window.setDopplerMode('OFF')" id="dopMode-OFF" class="px-2 py-0.5 rounded ${dopplerMode === 'OFF' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}">OFF</button>
              <button onclick="window.setDopplerMode('LINEAR')" id="dopMode-LINEAR" class="px-2 py-0.5 rounded ${dopplerMode === 'LINEAR' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}" title="SSB/CW Only">SSB/CW</button>
              <button onclick="window.setDopplerMode('ALL')" id="dopMode-ALL" class="px-2 py-0.5 rounded ${dopplerMode === 'ALL' ? 'bg-cyan-950 text-cyan-400 font-bold' : 'text-slate-400'}" title="Continuous Tracking (Inc. FM)">ALL</button>
            </div>
          </div>
        </div>
        <div id="satTransponderList" class="divide-y divide-shack-850"></div>
      </div>
    `;

    setTimeout(() => {
      window.initSatelliteTracker(instId);
    }, 50);

    return wrapper;
  }
};

window.EZWidgets = window.EZWidgets || {};
window.EZWidgets.satelliteTracker = satWidgetDefinition;
window.EZWidgets.satellite_tracker = satWidgetDefinition;

/* =====================================================================
   DOPPLER & HARDWARE CAT ACTIONS
   ===================================================================== */
window.toggleForceDopplerTest = function() {
  forceDopplerTest = !forceDopplerTest;
  const btn = document.getElementById('btnForceDoppler');
  if (btn) {
    if (forceDopplerTest) {
      btn.className = 'px-2 py-0.5 rounded border border-emerald-700 bg-emerald-950 text-emerald-300 font-bold animate-pulse';
      btn.innerText = '⚡ Bench Test Mode: ON';
      if (typeof window.showToast === 'function') {
        window.showToast('Bench Test ON: Doppler will now step the radio below horizon.');
      }
    } else {
      btn.className = 'px-2 py-0.5 rounded border border-amber-800/80 bg-amber-950/40 text-amber-400 font-bold';
      btn.innerText = '⚡ Bench Test Mode: OFF';
      if (typeof window.showToast === 'function') {
        window.showToast('Bench Test OFF: Standard in-pass horizon gate restored.');
      }
    }
  }
};

window.setDopplerMode = function(mode) {
  dopplerMode = mode;
  ['OFF', 'LINEAR', 'ALL'].forEach(m => {
    const el = document.getElementById(`dopMode-${m}`);
    if (el) {
      el.className = (m === mode)
        ? 'px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold'
        : 'px-2 py-0.5 rounded text-slate-400 hover:text-slate-200';
    }
  });
  window.updateTransponderDisplay();
};

window.calculateSpecificDoppler = function(carrierFreqHz) {
  if (!currentCalculatedDoppler70cm) return 0;
  return Math.round(currentCalculatedDoppler70cm * (carrierFreqHz / 436.5e6));
};

window.tuneRigToTransponder = function(transponderIdx) {
  const sat = SATELLITE_CATALOG.find(s => s.id === selectedSatId);
  if (!sat || !sat.transponders[transponderIdx]) return;

  const t = sat.transponders[transponderIdx];
  const isLinear = ['USB', 'LSB', 'CW', 'CW-U', 'CW-L'].includes(t.mode);

  isTuningInProgress = true;

  let targetRxFreq = t.downlink;
  const dopShift = window.calculateSpecificDoppler(targetRxFreq);

  if (dopplerMode === 'ALL' || (dopplerMode === 'LINEAR' && isLinear)) {
    targetRxFreq += dopShift;
  }

  const targetRxMode = (t.mode === 'CW') ? 'CW-U' : t.mode;
  let targetTxMode = t.mode;
  if (t.inverted) {
    if (t.mode === 'USB') targetTxMode = 'LSB';
    else if (t.mode === 'LSB') targetTxMode = 'USB';
  }

  const hasUplink = Boolean(t.uplink && t.uplink > 0);
  const toneHz = extractToneHz(t.tone);

  activeTrackedTransponder = {
    satId: sat.id,
    idx: transponderIdx,
    lastSentFreq: targetRxFreq,
    lastSentTime: Date.now()
  };

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({
      action: "setup_satellite",
      satellite: {
        sat_id: sat.id,
        sat_name: sat.name,
        transponder: t.name,
        rx_freq: targetRxFreq,
        tx_freq: t.uplink || 0,
        rx_mode: targetRxMode,
        tx_mode: targetTxMode,
        tone_hz: toneHz,
        has_uplink: hasUplink
      }
    }));
  }

  if (typeof tuneLockUntil !== 'undefined') {
    tuneLockUntil = Date.now() + 2500;
  }

  setTimeout(() => {
    isTuningInProgress = false;
  }, 2000);

  if (window.appState && window.appState.vfo) {
    window.appState.vfo.frequency = targetRxFreq;
    window.appState.vfo.mode = targetRxMode;
    window.appState.vfo.split = hasUplink;
    if (typeof window.updateVfoDisplay === 'function') window.updateVfoDisplay();
  }

  window.updateTransponderDisplay();

  if (typeof window.showToast === 'function') {
    window.showToast(`🛰️ ${sat.name} Armed. Doppler Tracking Active.`);
  }
};

window.stopTrackingTransponder = function() {
  activeTrackedTransponder = null;
  isTuningInProgress = false;

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "stop_satellite" }));
  }

  if (window.appState && window.appState.vfo) {
    window.appState.vfo.split = false;
    if (typeof window.updateVfoDisplay === 'function') window.updateVfoDisplay();
  }

  window.updateTransponderDisplay();

  if (typeof window.showToast === 'function') {
    window.showToast('Satellite CAT Tracking & Split Disengaged.');
  }
};

/* =====================================================================
   SGP4 PASS PREDICTOR ALGORITHM
   ===================================================================== */
function calculateNextPass(satrec, obsCoords, startTime) {
  if (!obsCoords) return null;
  const now = startTime;
  const stepSec = 45;
  const maxHours = 36;
  const maxSteps = Math.floor((maxHours * 3600) / stepSec);

  let inPass = false;
  let aosTime = null;
  let aosAz = 0;
  let maxEl = -999;
  let losTime = null;
  let losAz = 0;

  const pv0 = satellite.propagate(satrec, now);
  if (pv0 && pv0.position) {
    const gmst0 = satellite.gstime(now);
    const ecf0 = satellite.eciToEcf(pv0.position, gmst0);
    const look0 = satellite.ecfToLookAngles(obsCoords, ecf0);
    const el0 = look0.elevation * RAD_TO_DEG;
    if (el0 > 0) {
      inPass = true;
      aosTime = now;
      aosAz = Math.round(look0.azimuth * RAD_TO_DEG);
      maxEl = el0;
    }
  }

  for (let i = 1; i <= maxSteps; i++) {
    const t = new Date(now.getTime() + i * stepSec * 1000);
    const pv = satellite.propagate(satrec, t);
    if (!pv || !pv.position) continue;

    const gmst = satellite.gstime(t);
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(obsCoords, ecf);
    const elDeg = look.elevation * RAD_TO_DEG;
    const azDeg = Math.round(look.azimuth * RAD_TO_DEG);

    if (!inPass) {
      if (elDeg > 0) {
        inPass = true;
        aosTime = t;
        aosAz = azDeg;
        maxEl = elDeg;
      }
    } else {
      if (elDeg > maxEl) maxEl = elDeg;
      if (elDeg <= 0) {
        losTime = t;
        losAz = azDeg;
        break;
      }
    }
  }

  if (aosTime && losTime) {
    const durSec = Math.max(0, Math.round((losTime.getTime() - aosTime.getTime()) / 1000));
    return {
      aosTime,
      losTime,
      maxEl: Math.round(maxEl),
      durationStr: `${Math.floor(durSec / 60)}m ${String(durSec % 60).padStart(2, '0')}s`,
      trajectory: `${aosAz}° (${compassHeading(aosAz)}) ➔ ${losAz}° (${compassHeading(losAz)})`
    };
  }
  return null;
}

function updateNextPassDisplay() {
  const cdEl = document.getElementById('nextPassCountdown');
  const aosEl = document.getElementById('passAosTime');
  const maxEl = document.getElementById('passMaxEl');
  const durEl = document.getElementById('passDuration');
  const trajEl = document.getElementById('passTrajectory');

  if (!cachedNextPass) {
    if (cdEl) {
      cdEl.className = 'text-slate-400 font-mono text-xs';
      cdEl.innerText = 'No pass in next 36h';
    }
    return;
  }

  if (aosEl) {
    const d = cachedNextPass.aosTime;
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    aosEl.innerText = `${hh}:${mm}:${ss} Z`;
  }

  if (maxEl) {
    maxEl.innerText = `${cachedNextPass.maxEl}°`;
    maxEl.className = cachedNextPass.maxEl >= 45 
      ? 'font-bold text-sm sm:text-base text-emerald-400 font-mono' 
      : 'font-bold text-sm sm:text-base text-cyan-400 font-mono';
  }

  if (durEl) durEl.innerText = cachedNextPass.durationStr;
  if (trajEl) trajEl.innerText = cachedNextPass.trajectory;

  if (cdEl) {
    const now = Date.now();
    const aosDiff = cachedNextPass.aosTime.getTime() - now;
    const losDiff = cachedNextPass.losTime.getTime() - now;
    const passKey = `${selectedSatId}_${cachedNextPass.aosTime.getTime()}`;

    if (audioAlertsEnabled) {
      if (aosDiff <= 60000 && aosDiff > 45000 && alerted1MinPassKey !== passKey) {
        alerted1MinPassKey = passKey;
        play1MinWarningTone();
        if (typeof window.showToast === 'function') {
          const satObj = SATELLITE_CATALOG.find(s => s.id === selectedSatId);
          window.showToast(`🛰️ 1 Minute to Horizon: ${satObj ? satObj.name : selectedSatId}`);
        }
      }

      if (aosDiff <= 0 && losDiff > 0 && alertedAosPassKey !== passKey) {
        alertedAosPassKey = passKey;
        playAosAcquisitionTone();
        if (typeof window.showToast === 'function') {
          const satObj = SATELLITE_CATALOG.find(s => s.id === selectedSatId);
          window.showToast(`🛰️ AOS: ${satObj ? satObj.name : selectedSatId} is at the horizon!`);
        }
      }
    }

    if (aosDiff > 0) {
      const totalSec = Math.floor(aosDiff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      cdEl.className = 'text-amber-400 font-bold font-mono text-xs';
      cdEl.innerText = `AOS in ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    } else if (losDiff > 0) {
      const remSec = Math.floor(losDiff / 1000);
      const m = Math.floor(remSec / 60);
      const s = remSec % 60;
      cdEl.className = 'text-emerald-400 font-bold font-mono text-xs animate-pulse';
      cdEl.innerText = `● IN PASS (LOS in ${m}m ${String(s).padStart(2, '0')}s)`;
    } else {
      cdEl.className = 'text-slate-400 font-mono text-xs';
      cdEl.innerText = 'Pass complete. Re-calculating...';
      cachedNextPass = null;
    }
  }
}

/* =====================================================================
   CORE SATELLITE ENGINE & TRACKING LOOP
   ===================================================================== */
window.initSatelliteTracker = function(instanceId) {
  if (satTrackingTimer) clearInterval(satTrackingTimer);
  cachedNextPass = null;
  activeSatrec = null;
  userHasManuallySelected = false;
  isTuningInProgress = false;

  window.updateTransponderDisplay();

  // Automatic Staleness Check: Check if TLEs are older than TLE_MAX_AGE_DAYS
  const lastSync = parseInt(localStorage.getItem('EZSHACK_SAT_LAST_SYNC') || '0', 10);
  const ageMs = Date.now() - lastSync;
  const maxAgeMs = TLE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  if (isNaN(lastSync) || ageMs > maxAgeMs) {
    window.fetchLiveTLEs(false); // Quiet background refresh
  }

  ensureSatelliteLibrary(() => {
    const obsCoords = getObserverGd();
    if (obsCoords) {
      scanAndRankAllSatellites(obsCoords, true);
    }
    window.runSatelliteCalculation();
    satTrackingTimer = setInterval(window.runSatelliteCalculation, 1000);
  });
};

window.rescanAndPickNext = function() {
  const obsCoords = getObserverGd();
  if (obsCoords) {
    userHasManuallySelected = false;
    scanAndRankAllSatellites(obsCoords, true);
    window.updateTransponderDisplay();
    window.runSatelliteCalculation();
  }
};

window.onSatelliteSelect = function(satId, isUserAction = false) {
  if (isUserAction) {
    userHasManuallySelected = true;
  }
  selectedSatId = satId;
  cachedNextPass = catalogPassRankings[satId]?.pass || null;
  activeSatrec = null;
  window.updateTransponderDisplay();
  ensureSatelliteLibrary(() => {
    window.runSatelliteCalculation();
  });
};

window.filterSatellites = function(filterKey) {
  activeFilter = filterKey;
  ['ALL', 'FM', 'LINEAR', 'VU', 'UV'].forEach(k => {
    const b = document.getElementById(`satFilter-${k}`);
    if (b) {
      b.className = (k === filterKey)
        ? 'px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 font-bold'
        : 'px-2 py-0.5 rounded text-slate-400 hover:text-slate-200';
    }
  });

  window.renderSatelliteDropdown();
  const dropdown = document.getElementById('satSelectDropdown');
  if (dropdown && dropdown.options.length > 0) {
    const match = Array.from(dropdown.options).find(o => o.value === selectedSatId);
    if (!match) {
      window.onSatelliteSelect(dropdown.options[0].value, false);
    }
  }
};

window.updateTransponderDisplay = function() {
  const container = document.getElementById('satTransponderList');
  if (!container) return;

  const sat = SATELLITE_CATALOG.find(s => s.id === selectedSatId);
  if (!sat) return;

  container.innerHTML = sat.transponders.map((t, idx) => {
    const isLinear = ['USB', 'LSB', 'CW', 'CW-U', 'CW-L'].includes(t.mode);
    const isCurrentlyTracked = activeTrackedTransponder && 
                               activeTrackedTransponder.satId === sat.id && 
                               activeTrackedTransponder.idx === idx;

    const ulMhz = t.uplink > 0 ? (t.uplink / 1000000.0).toFixed(4) : '---';
    const specificDop = window.calculateSpecificDoppler(t.downlink);
    const dopCorrectedHz = t.downlink + specificDop;
    const correctedDlMhz = (dopCorrectedHz / 1000000.0).toFixed(4);
    const toneHz = extractToneHz(t.tone);

    return `
      <div class="p-1.5 flex items-center justify-between text-[11px] ${isCurrentlyTracked ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-shack-900/60'}">
        <div>
          <div class="font-bold text-slate-200 flex items-center gap-1.5">
            <span>${t.name}</span>
            <span class="text-[9px] px-1 py-0.5 rounded ${isLinear ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}">${t.mode}</span>
            ${isCurrentlyTracked ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">LIVE DOPPLER CAT</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-400 flex flex-wrap gap-2 mt-0.5">
            <span>RX (VFO A): <b class="${isCurrentlyTracked ? 'text-emerald-400' : 'text-cyan-400'}">${correctedDlMhz} MHz</b> <span class="text-[9px] text-amber-400">(${specificDop >= 0 ? '+' : ''}${specificDop} Hz)</span></span>
            <span>TX (VFO B): <b class="text-amber-400">${ulMhz} MHz</b></span>
            <span>PL: <b class="${toneHz > 0 ? 'text-cyan-300' : 'text-slate-400'}">${t.tone}</b></span>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          ${isCurrentlyTracked ? `
            <button onclick="window.stopTrackingTransponder()" class="px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold rounded text-[10px] transition" title="Disengage Split and disconnect live CAT tracking">
              ⏹ Disengage
            </button>
          ` : `
            <button onclick="window.tuneRigToTransponder(${idx})" class="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-400 font-bold rounded text-[10px] transition" title="Tune VFO A/B, arm Split, and lock Doppler">
              📻 Tune & Sync
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
};

window.runSatelliteCalculation = function() {
  if (typeof satellite === 'undefined') {
    ensureSatelliteLibrary(() => window.runSatelliteCalculation());
    return;
  }

  const pill = document.getElementById('satPassStatusPill');
  const obsCoords = getObserverGd();

  if (!obsCoords) {
    if (pill) {
      pill.className = 'mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-700 text-amber-300';
      pill.innerText = 'Grid Not Set in Settings';
    }
    return;
  }

  if (Date.now() - lastPassScanTimestamp > 90000) {
    scanAndRankAllSatellites(obsCoords, false);
  }

  const sat = SATELLITE_CATALOG.find(s => s.id === selectedSatId);
  if (!sat || !sat.tle1 || !sat.tle2) return;

  try {
    if (!activeSatrec) {
      activeSatrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    }

    const now = new Date();
    if (!cachedNextPass) {
      cachedNextPass = calculateNextPass(activeSatrec, obsCoords, now);
    }
    updateNextPassDisplay();

    const pv = satellite.propagate(activeSatrec, now);
    if (!pv || !pv.position) return;

    const gmst = satellite.gstime(now);
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(obsCoords, ecf);

    const azDeg = Math.round(look.azimuth * RAD_TO_DEG);
    const elDeg = Math.round(look.elevation * RAD_TO_DEG * 10) / 10;
    const rangeKm = Math.round(look.rangeSat);

    const geodetic = satellite.eciToGeodetic(pv.position, gmst);
    const altKm = Math.round(geodetic.height);

    const nextSec = new Date(now.getTime() + 1000);
    const nextPv = satellite.propagate(activeSatrec, nextSec);
    if (nextPv && nextPv.position) {
      const nextEcf = satellite.eciToEcf(nextPv.position, satellite.gstime(nextSec));
      const nextRange = satellite.ecfToLookAngles(obsCoords, nextEcf).rangeSat;
      const rangeRateKmS = nextRange - look.rangeSat;
      const cKmS = 299792.458;
      currentCalculatedDoppler70cm = Math.round(-436.5e6 * (rangeRateKmS / cKmS));
    }

    const elVal = document.getElementById('satElVal');
    const azVal = document.getElementById('satAzVal');
    const rangeVal = document.getElementById('satRangeVal');
    const altVal = document.getElementById('satAltVal');
    const dopVal = document.getElementById('satDopplerVal');
    const blip = document.getElementById('satRadarBlip');

    if (azVal) azVal.innerText = `${azDeg}° (${compassHeading(azDeg)})`;
    if (rangeVal) rangeVal.innerText = `${rangeKm.toLocaleString()} km`;
    if (altVal) altVal.innerText = `${altKm.toLocaleString()} km`;
    
    if (dopVal) {
      dopVal.innerText = `${currentCalculatedDoppler70cm > 0 ? '+' : ''}${currentCalculatedDoppler70cm} Hz`;
    }

    if (elVal) {
      elVal.innerText = `${elDeg.toFixed(1)}°`;
      elVal.className = elDeg > 0 
        ? 'font-lcd font-bold text-emerald-400 text-sm' 
        : 'font-lcd font-bold text-slate-500';
    }

    if (pill) {
      if (elDeg > 0) {
        pill.className = 'mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-700 text-emerald-400 animate-pulse';
        pill.innerText = `● IN PASS: Elev ${elDeg.toFixed(1)}°`;
      } else {
        pill.className = 'mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-shack-900 border border-shack-700 text-slate-400';
        pill.innerText = `Below Horizon (${elDeg.toFixed(1)}°)`;
      }
    }

    if (blip) {
      if (elDeg >= -10) {
        blip.style.display = 'block';
        const r = Math.max(0, Math.min(65, (90 - Math.max(0, elDeg)) / 90 * 65));
        const azRad = look.azimuth - Math.PI / 2;
        const x = 70 + r * Math.cos(azRad);
        const y = 70 + r * Math.sin(azRad);
        blip.style.left = `${x}px`;
        blip.style.top = `${y}px`;
      } else {
        blip.style.display = 'none';
      }
    }

    // Active Continuous Doppler Retuning Engine
    if (activeTrackedTransponder && activeTrackedTransponder.satId === sat.id && !isTuningInProgress) {
      const t = sat.transponders[activeTrackedTransponder.idx];
      if (t) {
        const isLinear = ['USB', 'LSB', 'CW', 'CW-U', 'CW-L'].includes(t.mode);
        const shouldRetune = (dopplerMode === 'ALL') || (dopplerMode === 'LINEAR' && isLinear);
        const canRetuneNow = (elDeg >= -2.0) || forceDopplerTest;

        if (shouldRetune && canRetuneNow) {
          const specificDop = window.calculateSpecificDoppler(t.downlink);
          const targetRxFreq = t.downlink + specificDop;
          const deltaFreq = Math.abs(targetRxFreq - activeTrackedTransponder.lastSentFreq);
          const nowMs = Date.now();
          const elapsedSec = (nowMs - activeTrackedTransponder.lastSentTime) / 1000.0;

          if (deltaFreq >= 20 && elapsedSec >= 2.0) {
            activeTrackedTransponder.lastSentFreq = targetRxFreq;
            activeTrackedTransponder.lastSentTime = nowMs;

            if (typeof tuneLockUntil !== 'undefined') {
              tuneLockUntil = Date.now() + 1200;
            }

            if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
              window.bridgeSocket.send(JSON.stringify({
                action: "set_freq",
                freq: targetRxFreq
              }));
            }

            if (window.appState && window.appState.vfo) {
              window.appState.vfo.frequency = targetRxFreq;
              if (typeof window.updateVfoDisplay === 'function') window.updateVfoDisplay();
            }
          }
        }
      }
    }

    window.updateTransponderDisplay();

  } catch (err) {
    console.error('[Satellite Tracker] Calculation loop error:', err);
  }
};

window.fetchLiveTLEs = async function(notify = true) {
  if (notify && typeof window.showToast === 'function') {
    window.showToast('Fetching fresh amateur TLEs from CelesTrak...');
  }
  try {
    const resp = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle');
    if (!resp.ok) throw new Error('CelesTrak fetch failed');
    const text = await resp.text();
    const lines = text.split('\n');

    let updatedCount = 0;
    const tleMapToCache = {};

    SATELLITE_CATALOG.forEach(sat => {
      const searchNorad = String(sat.norad);
      for (let i = 0; i < lines.length - 2; i++) {
        if (lines[i+1].includes(searchNorad) || lines[i+2].includes(searchNorad)) {
          sat.tle1 = lines[i+1].trim();
          sat.tle2 = lines[i+2].trim();
          tleMapToCache[sat.norad] = { tle1: sat.tle1, tle2: sat.tle2 };
          updatedCount++;
          break;
        }
      }
    });

    // Save updated TLE elements and sync timestamp to localStorage
    try {
      localStorage.setItem('EZSHACK_CACHED_TLES', JSON.stringify(tleMapToCache));
      localStorage.setItem('EZSHACK_SAT_LAST_SYNC', Date.now().toString());
    } catch (e) {
      console.warn('[Satellite Tracker] Could not cache TLEs to localStorage:', e);
    }

    cachedNextPass = null;
    activeSatrec = null;

    const obsCoords = getObserverGd();
    if (obsCoords) {
      scanAndRankAllSatellites(obsCoords, false);
    }

    window.runSatelliteCalculation();
    if (notify && typeof window.showToast === 'function') {
      window.showToast(`TLE Sync: Updated ${updatedCount} satellites.`);
    }
  } catch (err) {
    console.warn('[Satellite Tracker] Live sync skipped:', err);
  }
};