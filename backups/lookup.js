/* =====================================================================
   EZSHACK WIDGET: Callsign & Station Research (widgets/lookup.js)
   Global DXCC Regex Engine, US FCC Lookup & Direct Shack Synchronization
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

  // Initialize Sync State
  if (!window.appState) window.appState = {};
  if (!window.appState.sync) window.appState.sync = { lookup: true, logger: true, greatCircle: true };

  let lookupHistory = [];
  try {
    const saved = localStorage.getItem('EZSHACK_LOOKUP_HIST');
    if (saved) lookupHistory = JSON.parse(saved);
  } catch (e) {}

  function saveLookupHistory() {
    try {
      localStorage.setItem('EZSHACK_LOOKUP_HIST', JSON.stringify(lookupHistory.slice(0, 8)));
    } catch (e) {}
  }

  function maidenheadToLatLon(grid) {
    if (!grid || typeof grid !== 'string') return null;
    const clean = grid.trim().toUpperCase();
    if (clean.length < 4) return null;

    const fLon = clean.charCodeAt(0) - 65;
    const fLat = clean.charCodeAt(1) - 65;
    const sLon = parseInt(clean.charAt(2), 10);
    const sLat = parseInt(clean.charAt(3), 10);

    if (fLon < 0 || fLon > 17 || fLat < 0 || fLat > 17 || isNaN(sLon) || isNaN(sLat)) return null;

    let lon = -180 + (fLon * 20) + (sLon * 2);
    let lat = -90 + (fLat * 10) + sLat;

    if (clean.length >= 6) {
      const subLon = clean.charCodeAt(4) - 65;
      const subLat = clean.charCodeAt(5) - 65;
      if (subLon >= 0 && subLon <= 23 && subLat >= 0 && subLat <= 23) {
        lon += (subLon * (2 / 24)) + (1 / 24);
        lat += (subLat * (1 / 24)) + (0.5 / 24);
        return { lat, lon };
      }
    }

    lon += 1.0;
    lat += 0.5;
    return { lat, lon };
  }

  function getObserverStation() {
    const profile = window.appState?.profile;
    if (!profile) return null;

    let lat = null;
    let lon = null;

    if (profile.grid && profile.grid.length >= 4) {
      const coords = maidenheadToLatLon(profile.grid);
      if (coords) {
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
    return { lat, lon, grid: profile.grid || '' };
  }

  // Corrected Great Circle bearing formula (Math.cos(dLon))
  function calculateDistanceAndBearing(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const rLat1 = lat1 * Math.PI / 180.0;
    const rLat2 = lat2 * Math.PI / 180.0;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(rLat1) * Math.cos(rLat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c;
    const distMiles = distKm * 0.621371;

    const y = Math.sin(dLon) * Math.cos(rLat2);
    const x = Math.cos(rLat1) * Math.sin(rLat2) -
              Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180.0 / Math.PI;
    bearing = (bearing + 360.0) % 360.0;

    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const compassIdx = Math.round((bearing / 22.5)) % 16;

    return {
      distKm: Math.round(distKm),
      distMiles: Math.round(distMiles),
      bearing: Math.round(bearing),
      cardinal: dirs[compassIdx]
    };
  }

  const DXCC_RULES = [
    { regex: /^([AKNW]H6|[AKNW]L6)/i, country: 'Hawaii', continent: 'OC', grid: 'BL11', lat: 21.30, lon: -157.85, waz: 31, itu: 61 },
    { regex: /^([AKNW]L7|[AKNW]L0)/i, country: 'Alaska', continent: 'NA', grid: 'BP51', lat: 61.21, lon: -149.90, waz: 1, itu: 1 },
    { regex: /^([AKNW]P4)/i, country: 'Puerto Rico', continent: 'NA', grid: 'FK68', lat: 18.22, lon: -66.59, waz: 8, itu: 11 },
    { regex: /^([AKNW]P2)/i, country: 'US Virgin Islands', continent: 'NA', grid: 'FK77', lat: 17.72, lon: -64.83, waz: 8, itu: 11 },
    { regex: /^([AKNW]H2)/i, country: 'Guam', continent: 'OC', grid: 'QK23', lat: 13.44, lon: 144.79, waz: 27, itu: 64 },
    { regex: /^([KWN]|A[A-L])[0-9]/i, country: 'United States', continent: 'NA', grid: 'EM79', lat: 39.10, lon: -84.51, waz: 4, itu: 8 },
    { 
      regex: /^(J[A-S]|7[J-N]|8[J-N])([0-9])/i, 
      country: 'Japan', 
      continent: 'AS', 
      waz: 25, 
      itu: 45,
      resolve: function(matches) {
        const area = matches[2];
        const JA_AREAS = {
          '1': { region: 'Kanto (Tokyo)', grid: 'PM95', lat: 35.68, lon: 139.76 },
          '2': { region: 'Tokai', grid: 'PM84', lat: 35.18, lon: 136.90 },
          '3': { region: 'Kinki (Osaka)', grid: 'PM74', lat: 34.69, lon: 135.50 },
          '4': { region: 'Chugoku', grid: 'PM64', lat: 34.38, lon: 132.45 },
          '5': { region: 'Shikoku', grid: 'PM63', lat: 33.84, lon: 132.76 },
          '6': { region: 'Kyushu & Okinawa', grid: 'PM53', lat: 33.59, lon: 130.40 },
          '7': { region: 'Tohoku', grid: 'QM08', lat: 38.26, lon: 140.86 },
          '8': { region: 'Hokkaido', grid: 'QN03', lat: 43.06, lon: 141.35 },
          '9': { region: 'Hokuriku', grid: 'PM86', lat: 36.56, lon: 136.65 },
          '0': { region: 'Shinetsu', grid: 'PM96', lat: 36.65, lon: 138.19 }
        };
        const loc = JA_AREAS[area] || { region: 'Mainland', grid: 'PM95', lat: 35.68, lon: 139.76 };
        return { country: `Japan (${loc.region} - Area ${area})`, grid: loc.grid, lat: loc.lat, lon: loc.lon };
      }
    },
    { regex: /^(VE|VA|VO|VY)[0-9]/i, country: 'Canada', continent: 'NA', grid: 'FN25', lat: 45.42, lon: -75.69, waz: 4, itu: 9 },
    { regex: /^(G|M|2E)[0-9]/i, country: 'England', continent: 'EU', grid: 'IO91', lat: 51.50, lon: -0.12, waz: 14, itu: 27 },
    { regex: /^D[A-R]/i, country: 'Germany', continent: 'EU', grid: 'JO40', lat: 50.11, lon: 8.68, waz: 14, itu: 28 },
    { regex: /^F[0-9A-Z]/i, country: 'France', continent: 'EU', grid: 'JN18', lat: 48.85, lon: 2.35, waz: 14, itu: 27 },
    { regex: /^E[A-H][0-9]/i, country: 'Spain', continent: 'EU', grid: 'IN80', lat: 40.41, lon: -3.70, waz: 14, itu: 37 },
    { regex: /^I[0-9A-Z]/i, country: 'Italy', continent: 'EU', grid: 'JN61', lat: 41.90, lon: 12.50, waz: 15, itu: 28 },
    { regex: /^V[KL][0-9]/i, country: 'Australia', continent: 'OC', grid: 'QF56', lat: -33.86, lon: 151.20, waz: 30, itu: 59 },
    { regex: /^ZL[0-9]/i, country: 'New Zealand', continent: 'OC', grid: 'RE78', lat: -41.28, lon: 174.77, waz: 32, itu: 60 },
    { regex: /^P[P-Y]/i, country: 'Brazil', continent: 'SA', grid: 'GG66', lat: -23.55, lon: -46.63, waz: 11, itu: 72 }
  ];

  function lookupDxccByRegex(call) {
    const clean = call.trim().toUpperCase();
    for (const rule of DXCC_RULES) {
      const match = clean.match(rule.regex);
      if (match) {
        let countryName = rule.country;
        let grid = rule.grid;
        let lat = rule.lat;
        let lon = rule.lon;

        if (typeof rule.resolve === 'function') {
          const res = rule.resolve(match);
          countryName = res.country || countryName;
          grid = res.grid || grid;
          lat = res.lat !== undefined ? res.lat : lat;
          lon = res.lon !== undefined ? res.lon : lon;
        }

        return {
          callsign: clean,
          name: countryName,
          operClass: `DX Entity (${rule.continent})`,
          grid: grid,
          lat: lat,
          lon: lon,
          county: countryName,
          line1: `${countryName} [${rule.continent}]`,
          line2: `CQ Zone: ${rule.waz} | ITU Zone: ${rule.itu}`,
          grantDate: '',
          expiryDate: '',
          source: 'EZShack DXCC Regex Engine'
        };
      }
    }
    return null;
  }

  const lookupWidgetDefinition = {
    id: 'callsign_lookup',
    title: 'Callsign & Station Research',
    category: 'Station Operations',
    description: 'Global amateur radio callsign research, FCC/DXCC engine, geodetic beam headings, and one-click shack integration.',
    isNative: true,
    defaultW: 6,
    defaultH: 8,

    render(instanceId) {
      const wrapper = document.createElement('div');
      wrapper.id = `lookupWidget-${instanceId}`;
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text flex flex-col justify-between space-y-2';

      const isSync = Boolean(window.appState.sync?.lookup);

      wrapper.innerHTML = `
        <div class="bg-shack-850 p-2.5 rounded border border-shack-border shrink-0 space-y-2">
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span class="font-bold uppercase tracking-wider text-slate-300">Callbook Lookup</span>
            <button id="btnToggleLookupSync-${instanceId}" type="button" onclick="window.togglePanelSync('lookup', '${instanceId}')" class="px-2 py-0.5 rounded font-mono font-bold text-[10px] border transition ${isSync ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300'}">
              SYNC: ${isSync ? 'ON' : 'OFF'}
            </button>
          </div>

          <form onsubmit="window.executeCallsignLookup('${instanceId}', event, true)" class="flex items-center gap-1.5">
            <div class="relative flex-1">
              <input 
                id="lookupCallInput-${instanceId}" 
                type="text" 
                placeholder="CALLSIGN (e.g. JE9PEL, W1AW)" 
                onblur="window.handleLookupBlur('${instanceId}')"
                class="w-full bg-shack-950 border border-shack-700 text-amber-400 font-bold px-3 py-1.5 rounded uppercase placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 text-xs tracking-wider"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
            <button type="submit" class="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-bold rounded text-xs transition flex items-center gap-1">
              <span>🔍 Lookup</span>
            </button>
            <button type="button" onclick="window.clearLookupPanel('${instanceId}')" class="px-2 py-1.5 bg-shack-800 hover:bg-shack-700 border border-shack-700 text-slate-400 hover:text-white rounded text-xs transition" title="Clear panel">
              ✕
            </button>
          </form>

          <div id="lookupHistoryStrip-${instanceId}" class="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-0.5"></div>
        </div>

        <div id="lookupResultCard-${instanceId}" class="flex-1 bg-shack-850 border border-shack-border rounded p-3 flex flex-col justify-between">
          <div class="text-center py-8 text-slate-500 text-xs">
            Enter a callsign above to retrieve operator details, Maidenhead grid, and true Great Circle beam headings.
          </div>
        </div>

        <div id="lookupActionFooter-${instanceId}" class="bg-shack-900 border border-shack-border rounded p-2 flex items-center justify-between text-xs hidden">
          <div class="flex items-center gap-2">
            <button type="button" onclick="window.applyLookupToGreatCircle('${instanceId}')" class="px-2.5 py-1 bg-shack-800 hover:bg-amber-500 hover:text-black border border-shack-700 text-amber-300 font-bold rounded text-[11px] transition flex items-center gap-1">
              🎯 Aim Antenna
            </button>
            <button type="button" onclick="window.applyLookupToQuickLog('${instanceId}')" class="px-2.5 py-1 bg-shack-800 hover:bg-cyan-500 hover:text-black border border-shack-700 text-cyan-300 font-bold rounded text-[11px] transition flex items-center gap-1">
              📝 Stage in Log
            </button>
          </div>
          <a id="lookupQrzLink-${instanceId}" href="#" target="_blank" class="text-[10px] text-slate-400 hover:text-cyan-400 underline flex items-center gap-0.5">
            QRZ.com Profile ↗
          </a>
        </div>
      `;

      setTimeout(() => {
        window.refreshLookupHistoryUI(instanceId);
      }, 50);

      return wrapper;
    }
  };

  window.EZWidgets.callsignLookup = lookupWidgetDefinition;
  window.EZWidgets.callsign_lookup = lookupWidgetDefinition;
  window.EZWidgets.lookup = lookupWidgetDefinition;

  // On Blur Handler
  window.handleLookupBlur = function(instanceId) {
    const input = document.getElementById(`lookupCallInput-${instanceId}`);
    if (!input || !input.value.trim()) return;
    window.executeCallsignLookup(instanceId, null, false);
  };

  // Cascading Lookup
  window.executeCallsignLookup = async function(instanceId, event, isManualSubmit = false) {
    if (event) event.preventDefault();

    const input = document.getElementById(`lookupCallInput-${instanceId}`);
    if (!input) return;
    const rawCall = input.value.trim().toUpperCase();
    if (!rawCall || rawCall.length < 3) return;

    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    const footer = document.getElementById(`lookupActionFooter-${instanceId}`);
    if (!card) return;

    card.innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 space-y-2">
        <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-slate-400">Querying licensing & DXCC databases for <b>${rawCall}</b>...</span>
      </div>
    `;
    if (footer) footer.classList.add('hidden');

    let stationData = null;

    try {
      const resp = await fetch(`https://callook.info/${encodeURIComponent(rawCall)}/json`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.status === 'VALID') {
          const cur = data.current || {};
          const loc = data.location || {};
          const oth = data.otherInfo || {};
          const add = data.address || {};
          stationData = {
            callsign: cur.callsign || data.name,
            name: data.name || 'Not Available',
            operClass: cur.operClass || 'Unknown',
            grid: loc.gridsquare || '',
            lat: loc.latitude ? parseFloat(loc.latitude) : null,
            lon: loc.longitude ? parseFloat(loc.longitude) : null,
            county: loc.county || '',
            line1: add.line1 || '',
            line2: add.line2 || '',
            grantDate: oth.grantDate || '',
            expiryDate: oth.expiryDate || '',
            source: 'FCC / callook.info'
          };
        }
      }
    } catch (err) {
      console.warn('[Lookup] callook.info check failed or offline:', err);
    }

    if (!stationData) {
      stationData = lookupDxccByRegex(rawCall);
    }

    if (stationData) {
      window.renderLookupCard(instanceId, stationData);
      if (!lookupHistory.includes(stationData.callsign)) {
        lookupHistory.unshift(stationData.callsign);
        saveLookupHistory();
        window.refreshLookupHistoryUI(instanceId);
      }

      // Broadcast if sync is enabled on lookup panel
      if (window.appState.sync?.lookup) {
        window.broadcastShackSync('lookup', {
          call: stationData.callsign,
          grid: stationData.grid,
          bearing: card.getAttribute('data-target-bearing')
        });
      }
    } else {
      card.innerHTML = `
        <div class="text-center py-8 space-y-2">
          <div class="text-amber-400 font-bold text-sm">Station Not Found: "${rawCall}"</div>
          <p class="text-slate-400 text-xs max-w-sm mx-auto">No matching licensing record or international prefix allocation was recognized.</p>
        </div>
      `;
      if (footer) footer.classList.add('hidden');
    }
  };

  window.renderLookupCard = function(instanceId, data) {
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    const footer = document.getElementById(`lookupActionFooter-${instanceId}`);
    const qrzLink = document.getElementById(`lookupQrzLink-${instanceId}`);
    if (!card) return;

    card.setAttribute('data-target-call', data.callsign);
    card.setAttribute('data-target-grid', data.grid || '');
    card.setAttribute('data-target-name', data.name || '');

    let beamHtml = '<span class="text-slate-500 font-mono">Grid needed for beam</span>';
    const obs = getObserverStation();

    if ((data.lat === null || data.lon === null) && data.grid) {
      const c = maidenheadToLatLon(data.grid);
      if (c) {
        data.lat = c.lat;
        data.lon = c.lon;
      }
    }

    if (obs && data.lat !== null && data.lon !== null) {
      const geo = calculateDistanceAndBearing(obs.lat, obs.lon, data.lat, data.lon);
      beamHtml = `
        <b class="text-amber-400 font-mono text-xs">${geo.bearing}° (${geo.cardinal})</b>
        <span class="text-slate-400 text-[10px]">· ${geo.distMiles.toLocaleString()} mi (${geo.distKm.toLocaleString()} km)</span>
      `;
      card.setAttribute('data-target-bearing', geo.bearing);
    } else if (!obs) {
      beamHtml = '<span class="text-amber-500 text-[10px]">Set Station Grid in Settings</span>';
    }

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between border-b border-shack-800 pb-2">
          <div class="flex items-baseline gap-2">
            <span class="text-xl sm:text-2xl font-bold font-mono text-amber-300 tracking-wider">${data.callsign}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase">${data.operClass}</span>
          </div>
          <span class="text-[9px] font-mono text-slate-500">${data.source}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <span class="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Operator / Entity</span>
            <span class="font-bold text-slate-200 text-sm truncate block" title="${data.name}">${data.name}</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Maidenhead Grid</span>
            <span class="font-mono font-bold text-cyan-400 text-sm">${data.grid || '---'}</span>
          </div>
        </div>

        <div class="bg-shack-900/80 p-2 rounded border border-shack-800 text-[11px] space-y-1">
          <div class="flex justify-between">
            <span class="text-slate-400">Location:</span>
            <span class="text-slate-200 font-medium truncate max-w-[210px]" title="${data.line1} ${data.line2}">${data.line1 || data.line2 || '---'}</span>
          </div>
          ${data.county ? `
            <div class="flex justify-between">
              <span class="text-slate-400">Region / Entity:</span>
              <span class="text-slate-300 font-bold">${data.county}</span>
            </div>
          ` : ''}
          <div class="flex justify-between items-center pt-1 border-t border-shack-800/60">
            <span class="text-slate-400">Short Path Great Circle Beam:</span>
            <div>${beamHtml}</div>
          </div>
        </div>
      </div>
    `;

    if (footer) footer.classList.remove('hidden');
    if (qrzLink) qrzLink.href = `https://www.qrz.com/db/${encodeURIComponent(data.callsign)}`;
  };

  window.applyLookupToGreatCircle = function(instanceId) {
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    if (!card) return;
    const grid = card.getAttribute('data-target-grid') || '';
    const bearing = card.getAttribute('data-target-bearing');
    window.broadcastShackSync('lookup', { grid, bearing });
  };

  window.applyLookupToQuickLog = function(instanceId) {
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    if (!card) return;
    const call = card.getAttribute('data-target-call') || '';
    const grid = card.getAttribute('data-target-grid') || '';
    window.broadcastShackSync('lookup', { call, grid });
  };

  window.clearLookupPanel = function(instanceId) {
    const input = document.getElementById(`lookupCallInput-${instanceId}`);
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    const footer = document.getElementById(`lookupActionFooter-${instanceId}`);

    if (input) input.value = '';
    if (card) {
      card.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-xs">
          Enter a callsign above to retrieve operator details, Maidenhead grid, and true Great Circle beam headings.
        </div>
      `;
    }
    if (footer) footer.classList.add('hidden');
  };

  window.refreshLookupHistoryUI = function(instanceId) {
    const strip = document.getElementById(`lookupHistoryStrip-${instanceId}`);
    if (!strip) return;

    if (lookupHistory.length === 0) {
      strip.innerHTML = '<span class="text-[10px] text-slate-600">No recent lookups</span>';
      return;
    }

    strip.innerHTML = `
      <span class="text-slate-500 font-bold shrink-0">Recent:</span>
      ${lookupHistory.map(call => `
        <button 
          type="button" 
          onclick="window.quickSelectLookupHistory('${instanceId}', '${call}')" 
          class="px-1.5 py-0.5 rounded bg-shack-900 hover:bg-cyan-950 border border-shack-700 text-cyan-400 hover:text-cyan-200 shrink-0 transition"
        >
          ${call}
        </button>
      `).join('')}
    `;
  };

  window.quickSelectLookupHistory = function(instanceId, call) {
    const input = document.getElementById(`lookupCallInput-${instanceId}`);
    if (input) {
      input.value = call;
      window.executeCallsignLookup(instanceId, null, true);
    }
  };

  // Reactive listener from other panels
  window.addEventListener('ezshack:sync', (e) => {
    if (e.detail?.origin === 'lookup') return;
    if (!window.appState.sync?.lookup) return;

    const { call } = e.detail;
    if (call) {
      document.querySelectorAll('[id^="lookupCallInput-"]').forEach(inp => {
        if (inp.value.toUpperCase() !== call.toUpperCase()) {
          inp.value = call;
          const instId = inp.id.replace('lookupCallInput-', '');
          window.executeCallsignLookup(instId, null, false);
        }
      });
    }
  });
})();