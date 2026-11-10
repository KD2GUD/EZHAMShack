/* =====================================================================
   EZSHACK WIDGET: Callsign & Station Research (widgets/lookup.js)
   Global DXCC Regex Engine, US FCC Lookup & Direct Shack Synchronization
   ===================================================================== */

(function() {
  if (!window.EZWidgets) window.EZWidgets = {};

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

  function getObserverStation() {
    const profile = window.appState?.profile;
    if (!profile) return null;

    let lat = null;
    let lon = null;

    if (profile.grid && profile.grid.length >= 4 && window.maidenheadToLatLon) {
      const coords = window.maidenheadToLatLon(profile.grid);
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
              Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLat);
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

  /* =====================================================================
     COMPREHENSIVE DXCC / ITU REGEX ENGINE
     ===================================================================== */
  const DXCC_RULES = [
    { regex: /^([AKNW]H6|[AKNW]L6)/i, country: 'Hawaii', continent: 'OC', grid: 'BL11', lat: 21.30, lon: -157.85, waz: 31, itu: 61 },
    { regex: /^([AKNW]L7|[AKNW]L0)/i, country: 'Alaska', continent: 'NA', grid: 'BP51', lat: 61.21, lon: -149.90, waz: 1, itu: 1 },
    { regex: /^([AKNW]P4)/i, country: 'Puerto Rico', continent: 'NA', grid: 'FK68', lat: 18.22, lon: -66.59, waz: 8, itu: 11 },
    { regex: /^([AKNW]P2)/i, country: 'US Virgin Islands', continent: 'NA', grid: 'FK77', lat: 17.72, lon: -64.83, waz: 8, itu: 11 },
    { regex: /^([AKNW]H2)/i, country: 'Guam', continent: 'OC', grid: 'QK23', lat: 13.44, lon: 144.79, waz: 27, itu: 64 },
    { regex: /^([KWN]|A[A-L])[0-9]/i, country: 'United States', continent: 'NA', grid: 'EM79', lat: 39.10, lon: -84.51, waz: 4, itu: 8 },
    { 
      regex: /^(J[A-S]|7[J-N]|8[J-N])([0-9])/i, 
      country: 'Japan', continent: 'AS', waz: 25, itu: 45,
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
          '9': { region: 'Hokuriku (Fukui/Toyama/Ishikawa)', grid: 'PM86', lat: 36.56, lon: 136.65 },
          '0': { region: 'Shinetsu (Nagano/Niigata)', grid: 'PM96', lat: 36.65, lon: 138.19 }
        };
        const loc = JA_AREAS[area] || { region: 'Mainland', grid: 'PM95', lat: 35.68, lon: 139.76 };
        return { country: `Japan (${loc.region} - Area ${area})`, grid: loc.grid, lat: loc.lat, lon: loc.lon };
      }
    },
    { regex: /^(VE|VA|VO|VY)[0-9]/i, country: 'Canada', continent: 'NA', grid: 'FN25', lat: 45.42, lon: -75.69, waz: 4, itu: 9 },
    { regex: /^(GD|2D)/i, country: 'Isle of Man', continent: 'EU', grid: 'IO74', lat: 54.23, lon: -4.54, waz: 14, itu: 27 },
    { regex: /^(GI|2I)/i, country: 'Northern Ireland', continent: 'EU', grid: 'IO64', lat: 54.60, lon: -5.93, waz: 14, itu: 27 },
    { regex: /^(GJ|2J)/i, country: 'Jersey', continent: 'EU', grid: 'IN89', lat: 49.21, lon: -2.13, waz: 14, itu: 27 },
    { regex: /^(GM|2M)/i, country: 'Scotland', continent: 'EU', grid: 'IO75', lat: 55.86, lon: -4.25, waz: 14, itu: 27 },
    { regex: /^(GU|2U)/i, country: 'Guernsey', continent: 'EU', grid: 'IN89', lat: 49.46, lon: -2.58, waz: 14, itu: 27 },
    { regex: /^(GW|2W)/i, country: 'Wales', continent: 'EU', grid: 'IO81', lat: 51.48, lon: -3.18, waz: 14, itu: 27 },
    { regex: /^(G|M|2E)[0-9]/i, country: 'England', continent: 'EU', grid: 'IO91', lat: 51.50, lon: -0.12, waz: 14, itu: 27 },
    { regex: /^D[A-R]/i, country: 'Germany', continent: 'EU', grid: 'JO40', lat: 50.11, lon: 8.68, waz: 14, itu: 28 },
    { regex: /^F[0-9A-Z]/i, country: 'France', continent: 'EU', grid: 'JN18', lat: 48.85, lon: 2.35, waz: 14, itu: 27 },
    { regex: /^E[A-H][0-9]/i, country: 'Spain', continent: 'EU', grid: 'IN80', lat: 40.41, lon: -3.70, waz: 14, itu: 37 },
    { regex: /^I[0-9A-Z]/i, country: 'Italy', continent: 'EU', grid: 'JN61', lat: 41.90, lon: 12.50, waz: 15, itu: 28 },
    { regex: /^C[T-U]/i, country: 'Portugal', continent: 'EU', grid: 'IN51', lat: 38.72, lon: -9.13, waz: 14, itu: 37 },
    { regex: /^HB[0-9]/i, country: 'Switzerland', continent: 'EU', grid: 'JN36', lat: 46.94, lon: 7.44, waz: 14, itu: 28 },
    { regex: /^OE[0-9]/i, country: 'Austria', continent: 'EU', grid: 'JN88', lat: 48.20, lon: 16.37, waz: 15, itu: 28 },
    { regex: /^P[A-I]/i, country: 'Netherlands', continent: 'EU', grid: 'JO22', lat: 52.37, lon: 4.89, waz: 14, itu: 27 },
    { regex: /^O[N-T]/i, country: 'Belgium', continent: 'EU', grid: 'JO20', lat: 50.85, lon: 4.35, waz: 14, itu: 27 },
    { regex: /^S[A-M]/i, country: 'Sweden', continent: 'EU', grid: 'JO89', lat: 59.32, lon: 18.06, waz: 14, itu: 18 },
    { regex: /^L[A-N]/i, country: 'Norway', continent: 'EU', grid: 'JO59', lat: 59.91, lon: 10.75, waz: 14, itu: 18 },
    { regex: /^O[F-I]/i, country: 'Finland', continent: 'EU', grid: 'KP20', lat: 60.16, lon: 24.93, waz: 15, itu: 18 },
    { regex: /^O[U-Z]/i, country: 'Denmark', continent: 'EU', grid: 'JO65', lat: 55.67, lon: 12.56, waz: 14, itu: 18 },
    { regex: /^S[N-R]/i, country: 'Poland', continent: 'EU', grid: 'KO02', lat: 52.23, lon: 21.01, waz: 15, itu: 28 },
    { regex: /^(R[A-Z]|U[A-I])/i, country: 'European Russia', continent: 'EU', grid: 'KO85', lat: 55.75, lon: 37.61, waz: 16, itu: 29 },
    { regex: /^V[KL][0-9]/i, country: 'Australia', continent: 'OC', grid: 'QF56', lat: -33.86, lon: 151.20, waz: 30, itu: 59 },
    { regex: /^ZL[0-9]/i, country: 'New Zealand', continent: 'OC', grid: 'RE78', lat: -41.28, lon: 174.77, waz: 32, itu: 60 },
    { regex: /^(B[A-L]|B[Q-Z])/i, country: 'China', continent: 'AS', grid: 'OM89', lat: 39.90, lon: 116.40, waz: 24, itu: 44 },
    { regex: /^(DS|DT|HL)/i, country: 'South Korea', continent: 'AS', grid: 'PM37', lat: 37.56, lon: 126.97, waz: 25, itu: 44 },
    { regex: /^(VU|A[T-W])/i, country: 'India', continent: 'AS', grid: 'MK82', lat: 28.61, lon: 77.20, waz: 22, itu: 41 },
    { regex: /^P[P-Y]/i, country: 'Brazil', continent: 'SA', grid: 'GG66', lat: -23.55, lon: -46.63, waz: 11, itu: 72 },
    { regex: /^L[U-W]/i, country: 'Argentina', continent: 'SA', grid: 'GF05', lat: -34.60, lon: -58.38, waz: 13, itu: 73 },
    { regex: /^Z[R-U]/i, country: 'South Africa', continent: 'AF', grid: 'KG33', lat: -26.20, lon: 28.04, waz: 38, itu: 57 }
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
          name: `${countryName}`,
          operClass: `DX Entity (${rule.continent})`,
          grid: grid,
          lat: lat,
          lon: lon,
          county: countryName,
          location: `${countryName} [${rule.continent}]`,
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

  /* --- Widget UI Definition --- */
  const lookupWidgetDefinition = {
    id: 'callsign_lookup',
    title: 'Callsign & Station Research',
    category: 'Station Operations',
    description: 'Global amateur radio callsign research, FCC/DXCC engine, geodetic beam headings, and one-click shack integration.',
    isNative: true,
    defaultW: 6,
    defaultH: 8,

    render(containerOrId, pane) {
      const instId = (pane && pane.instanceId) ? pane.instanceId : (typeof containerOrId === 'string' ? containerOrId : 'lookup_panel');
      const wrapper = document.createElement('div');
      wrapper.id = `lookupWidget-${instId}`;
      wrapper.className = 'w-full h-full p-3 overflow-y-auto text-xs font-mono text-slate-200 select-text flex flex-col justify-between space-y-2';

      const isSync = window.getPanelSync ? window.getPanelSync('lookup') : true;

      wrapper.innerHTML = `
        <div class="bg-shack-850 p-2.5 rounded border border-shack-border shrink-0 space-y-2">
          <form onsubmit="window.executeCallsignLookup('${instId}', event)" class="flex items-center gap-1.5">
            <div class="relative flex-1">
              <input 
                id="lookupCallInput-${instId}" 
                type="text" 
                placeholder="CALLSIGN (e.g. JE9PEL, W1AW, G4...)" 
                onblur="window.handleLookupBlur('${instId}', this.value)"
                class="w-full bg-shack-950 border border-shack-700 text-amber-400 font-bold px-3 py-1.5 rounded uppercase placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 text-xs tracking-wider"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
            <button 
              type="button" 
              id="btnSync-lookup" 
              data-sync-panel="lookup"
              onclick="window.togglePanelSync('lookup', this)" 
              title="Toggle auto-sync with QuickLog & Great Circle"
              class="px-2 py-1.5 rounded font-mono font-bold text-[10px] border transition ${isSync ? 'bg-cyan-950 text-cyan-400 border-cyan-800' : 'bg-shack-900 text-slate-500 border-shack-700 hover:text-slate-300'}"
            >
              SYNC: ${isSync ? 'ON' : 'OFF'}
            </button>
            <button type="submit" class="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-bold rounded text-xs transition flex items-center gap-1">
              <span>🔍 Lookup</span>
            </button>
            <button type="button" onclick="window.clearLookupPanel('${instId}')" class="px-2 py-1.5 bg-shack-800 hover:bg-shack-700 border border-shack-700 text-slate-400 hover:text-white rounded text-xs transition" title="Clear panel">
              ✕
            </button>
          </form>

          <div id="lookupHistoryStrip-${instId}" class="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-0.5"></div>
        </div>

        <div id="lookupResultCard-${instId}" class="flex-1 bg-shack-850 border border-shack-border rounded p-3 flex flex-col justify-between">
          <div class="text-center py-8 text-slate-500 text-xs">
            Enter a US or international callsign above to retrieve operator details, Maidenhead grid, and geodetic beam headings.
          </div>
        </div>

        <div id="lookupActionFooter-${instId}" class="bg-shack-900 border border-shack-border rounded p-2 flex items-center justify-between text-xs hidden">
          <div class="flex items-center gap-2">
            <button type="button" onclick="window.applyLookupToGreatCircle('${instId}')" class="px-2.5 py-1 bg-shack-800 hover:bg-amber-500 hover:text-black border border-shack-700 text-amber-300 font-bold rounded text-[11px] transition flex items-center gap-1" title="Steer Great Circle rotator map to target station">
              🎯 Aim Antenna
            </button>
            <button type="button" onclick="window.applyLookupToQuickLog('${instId}')" class="px-2.5 py-1 bg-shack-800 hover:bg-cyan-500 hover:text-black border border-shack-700 text-cyan-300 font-bold rounded text-[11px] transition flex items-center gap-1" title="Copy station details into QuickLog form">
              📝 Stage in Log
            </button>
          </div>
          <a id="lookupQrzLink-${instId}" href="#" target="_blank" class="text-[10px] text-slate-400 hover:text-cyan-400 underline flex items-center gap-0.5">
            QRZ.com Profile ↗
          </a>
        </div>
      `;

      setTimeout(() => {
        window.refreshLookupHistoryUI(instId);
        const input = document.getElementById(`lookupCallInput-${instId}`);
        if (input) input.focus();
      }, 50);

      return wrapper;
    }
  };

  window.EZWidgets.callsignLookup = lookupWidgetDefinition;
  window.EZWidgets.callsign_lookup = lookupWidgetDefinition;
  window.EZWidgets.lookup = lookupWidgetDefinition;

  /* --- Blur Handler for Lookup Panel --- */
  window.handleLookupBlur = function(instanceId, callVal) {
    const clean = (callVal || '').trim().toUpperCase();
    if (!clean || clean.length < 3) return;

    window.executeCallsignLookup(instanceId);
  };

  /* --- Cascading Query Engine --- */
  window.executeCallsignLookup = async function(instanceId, event) {
    if (event) event.preventDefault();

    const input = document.getElementById(`lookupCallInput-${instanceId}`);
    if (!input) return;
    const rawCall = input.value.trim().toUpperCase();
    if (!rawCall) return;

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

    // 1. Check US FCC database via callook.info
    try {
      const resp = await fetch(`https://callook.info/${encodeURIComponent(rawCall)}/json`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.status === 'VALID') {
          const cur = data.current || {};
          const loc = data.location || {};
          const oth = data.otherInfo || {};
          const add = data.address || {};

          // Extract City and State from line2, stripping trailing 5-digit or 9-digit zip code
          const rawLine2 = add.line2 || '';
          const cityState = rawLine2.replace(/\s+\d{5}(-\d{4})?$/, '').trim();

          stationData = {
            callsign: cur.callsign || data.name,
            name: data.name || 'Not Available',
            operClass: cur.operClass || 'Unknown',
            grid: loc.gridsquare || '',
            lat: loc.latitude ? parseFloat(loc.latitude) : null,
            lon: loc.longitude ? parseFloat(loc.longitude) : null,
            county: loc.county || '',
            location: cityState || rawLine2 || (loc.county ? `${loc.county}, USA` : 'United States'),
            grantDate: oth.grantDate || '',
            expiryDate: oth.expiryDate || '',
            source: 'FCC / callook.info'
          };
        }
      }
    } catch (err) {
      console.warn('[Lookup] callook.info check failed or offline:', err);
    }

    // 2. Offline International DXCC Regular Expression Matcher
    if (!stationData) {
      stationData = lookupDxccByRegex(rawCall);
    }

    // 3. Render Card & Broadcast to Shack
    if (stationData) {
      window.renderLookupCard(instanceId, stationData);

      // Broadcast target to QuickLog and Great Circle
      if (window.syncShackTarget) {
        window.syncShackTarget('lookup', { call: stationData.callsign, grid: stationData.grid });
      }

      if (!lookupHistory.includes(stationData.callsign)) {
        lookupHistory.unshift(stationData.callsign);
        saveLookupHistory();
        window.refreshLookupHistoryUI(instanceId);
      }
    } else {
      card.innerHTML = `
        <div class="text-center py-8 space-y-2">
          <div class="text-amber-400 font-bold text-sm">Station Not Found: "${rawCall}"</div>
          <p class="text-slate-400 text-xs max-w-sm mx-auto">No matching licensing record or international prefix allocation was recognized.</p>
          <div class="pt-2">
            <a href="https://www.qrz.com/db/${encodeURIComponent(rawCall)}" target="_blank" class="inline-block px-3 py-1.5 bg-shack-800 hover:bg-shack-700 border border-shack-700 text-cyan-400 rounded text-xs">
              Open "${rawCall}" on QRZ.com ↗
            </a>
          </div>
        </div>
      `;
      if (footer) footer.classList.add('hidden');
    }
  };

  /* --- Render Station Profile Card --- */
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

    if ((data.lat === null || data.lon === null) && data.grid && window.maidenheadToLatLon) {
      const c = window.maidenheadToLatLon(data.grid);
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

    const displayLocation = data.location || '---';

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
            <span class="text-slate-200 font-medium truncate max-w-[210px]" title="${displayLocation}">${displayLocation}</span>
          </div>
          ${data.county ? `
            <div class="flex justify-between">
              <span class="text-slate-400">Region / Entity:</span>
              <span class="text-slate-300 font-bold">${data.county}</span>
            </div>
          ` : ''}
          <div class="flex justify-between items-center pt-1 border-t border-shack-800/60">
            <span class="text-slate-400">Short Path Beam:</span>
            <div>${beamHtml}</div>
          </div>
        </div>

        ${data.expiryDate ? `
          <div class="flex justify-between text-[10px] text-slate-400 pt-1">
            <span>Granted: <b class="text-slate-300">${data.grantDate || '---'}</b></span>
            <span>Expires: <b class="text-slate-300">${data.expiryDate || '---'}</b></span>
          </div>
        ` : ''}
      </div>
    `;

    if (footer) footer.classList.remove('hidden');
    if (qrzLink) qrzLink.href = `https://www.qrz.com/db/${encodeURIComponent(data.callsign)}`;
  };

  /* --- Direct Shack Hook: Aim Antenna (Great Circle) --- */
  window.applyLookupToGreatCircle = function(instanceId) {
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    if (!card) return;

    const grid = card.getAttribute('data-target-grid') || '';
    const call = card.getAttribute('data-target-call') || '';
    let rawBearing = card.getAttribute('data-target-bearing');
    let bearingNum = rawBearing !== null && rawBearing !== '' ? parseFloat(rawBearing) : null;

    if (!grid && bearingNum === null) {
      if (typeof window.showToast === 'function') window.showToast('No grid coordinates available to aim antenna.');
      return;
    }

    if (window.appState) {
      window.appState.targetGrid = grid;
      if (bearingNum !== null) window.appState.rotatorBearing = bearingNum;
    }

    const gcInput = document.getElementById('calcTargetGrid');
    if (gcInput && grid) {
      gcInput.value = grid;
      if (typeof window.runBearingCalculation === 'function') {
        window.runBearingCalculation();
      }
    }

    if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN && bearingNum !== null) {
      window.bridgeSocket.send(JSON.stringify({ action: "set_azimuth", azimuth: bearingNum }));
    }

    window.dispatchEvent(new CustomEvent('ezshack:rotator', { detail: { grid, bearing: bearingNum } }));

    if (typeof window.showToast === 'function') {
      const bearingStr = bearingNum !== null ? `${bearingNum}°` : grid;
      window.showToast(`🎯 Great Circle: Antenna aimed toward ${call} (${bearingStr})`);
    }
  };

  /* --- Direct Shack Hook: Stage in QuickLog --- */
  window.applyLookupToQuickLog = function(instanceId) {
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    if (!card) return;

    const call = card.getAttribute('data-target-call') || '';
    const grid = card.getAttribute('data-target-grid') || '';

    const logInput = document.getElementById('logCall');
    if (logInput && call) {
      logInput.value = call;
      logInput.dispatchEvent(new Event('input', { bubbles: true }));
      logInput.focus();
    }

    const gcInput = document.getElementById('calcTargetGrid');
    if (gcInput && grid) {
      gcInput.value = grid;
      if (typeof window.runBearingCalculation === 'function') {
        window.runBearingCalculation();
      }
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`📝 QuickLog: Staged ${call} ${grid ? '(' + grid + ')' : ''}`);
    }
  };

  /* --- Panel Cleanup & History Helpers --- */
  window.clearLookupPanel = function(instanceId) {
    const input = document.getElementById(`lookupCallInput-${instanceId}`);
    const card = document.getElementById(`lookupResultCard-${instanceId}`);
    const footer = document.getElementById(`lookupActionFooter-${instanceId}`);

    if (input) input.value = '';
    if (card) {
      card.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-xs">
          Enter a US or international callsign above to retrieve operator details, Maidenhead grid, and geodetic beam headings.
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
      window.executeCallsignLookup(instanceId);
    }
  };
})();