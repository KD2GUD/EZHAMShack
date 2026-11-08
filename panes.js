/* =====================================================================
   EZSHACK - DASHBOARD PANES & 16-COLUMN FLUID GRID (panes.js)
   High-Density (16-Col) Layout, 1-Col Minimum Width & Granular Snapping
   ===================================================================== */

const GRID_COLS = 16; // 16-column layout (2x density of legacy 8-col grid)

const WEB_TOOLS_CATALOG = [
  {
    id: 'voacap_hf',
    title: 'VOACAP HF Propagation Planner',
    category: 'Propagation & Modeling',
    description: 'Professional high-frequency point-to-point path prediction engine & band charts.',
    isNative: false,
    urlTemplate: 'https://www.voacap.com/hf/',
    defaultW: 10,
    defaultH: 9
  },
  {
    id: 'dx_maps',
    title: 'DX Maps VHF/HF Live Spots',
    category: 'Propagation & Reception',
    description: 'Real-time propagation maps highlighting sporadic-E, tropospheric, and F2 openings.',
    isNative: false,
    urlTemplate: 'https://www.dxmaps.com/spots/map.php',
    defaultW: 8,
    defaultH: 8
  },
  {
    id: 'lightning_maps',
    title: 'Real-time Lightning & QRN Map',
    category: 'Weather & QRN',
    description: 'Live atmospheric discharge tracking across the globe to identify RF static.',
    isNative: false,
    urlTemplate: 'https://www.lightningmaps.org/',
    defaultW: 10,
    defaultH: 9
  },
  {
    id: 'rbn_spots',
    title: 'Reverse Beacon Network (RBN)',
    category: 'CW & Skimmer',
    description: 'Automated CW, RTTY, and FT8 receiver network spots with SNR reports.',
    isNative: false,
    urlTemplate: 'https://www.reversebeacon.net/main.php?rows=25&spot={callsign}',
    defaultW: 6,
    defaultH: 8
  }
];

// Presets mapped to 16-Column Layout
const PRESETS = {
  dxHunter: [
    { catalogId: 'voacap_hf', x: 1, y: 1, w: 11, h: 8 },
    { catalogId: 'solar_monitor', x: 12, y: 1, w: 5, h: 8 },
    { catalogId: 'qso_logger', x: 1, y: 9, w: 11, h: 8 },
    { catalogId: 'great_circle', x: 12, y: 9, w: 5, h: 8 }
  ],
  ft8Digital: [
    { catalogId: 'psk_reporter', x: 1, y: 1, w: 10, h: 10 },
    { catalogId: 'solar_monitor', x: 11, y: 1, w: 6, h: 5 },
    { catalogId: 'great_circle', x: 11, y: 6, w: 6, h: 5 },
    { catalogId: 'qso_logger', x: 1, y: 11, w: 10, h: 8 },
    { catalogId: 'shack_scratchpad', x: 11, y: 11, w: 6, h: 8 }
  ],
  contestMaster: [
    { catalogId: 'qso_logger', x: 1, y: 1, w: 10, h: 9 },
    { catalogId: 'rbn_spots', x: 11, y: 1, w: 6, h: 9 },
    { catalogId: 'solar_monitor', x: 1, y: 10, w: 5, h: 7 },
    { catalogId: 'great_circle', x: 6, y: 10, w: 5, h: 7 },
    { catalogId: 'shack_scratchpad', x: 11, y: 10, w: 6, h: 7 }
  ],
  casualRagchew: [
    { catalogId: 'solar_monitor', x: 1, y: 1, w: 5, h: 8 },
    { catalogId: 'lightning_maps', x: 6, y: 1, w: 11, h: 8 },
    { catalogId: 'shack_scratchpad', x: 1, y: 9, w: 5, h: 7 },
    { catalogId: 'qso_logger', x: 6, y: 9, w: 11, h: 7 }
  ]
};

function isSubRxSupported(stateData) {
  const caps = (stateData && stateData.capabilities) || (window.appState && window.appState.telemetry && window.appState.telemetry.capabilities) || [];
  const xcvr = (stateData && stateData.xcvr) || (window.appState && window.appState.telemetry && window.appState.telemetry.xcvr) || '';
  return caps.includes('sub_rx') || xcvr.toUpperCase().includes('2000') || xcvr.toUpperCase().includes('TS2000');
}

window.getCombinedCatalog = function() {
  const combined = [...WEB_TOOLS_CATALOG];

  // Hardware Capability Gating: Only expose TS-2000 Sub-Receiver if hardware is present
  if (isSubRxSupported()) {
    combined.push({
      id: 'sub_receiver',
      title: 'VHF/UHF Sub-Receiver (Dual Watch)',
      category: 'Radio Controls',
      description: 'Dedicated secondary receiver controls for VHF/UHF dual-watch monitoring on the TS-2000.',
      isNative: true,
      widgetType: 'sub_receiver',
      defaultW: 6,
      defaultH: 8
    });
  }

  if (window.EZWidgets) {
    const seenIds = new Set(combined.map(item => item.id));

    Object.keys(window.EZWidgets).forEach(widgetKey => {
      const w = window.EZWidgets[widgetKey];
      if (!w || !w.id || seenIds.has(w.id)) return;
      seenIds.add(w.id);

      combined.push({
        id: w.id,
        title: w.title,
        category: w.category || 'Native Widgets',
        description: w.description || '',
        isNative: (w.isNative !== undefined ? w.isNative : true),
        widgetType: widgetKey,
        defaultW: w.defaultW || 6,
        defaultH: w.defaultH || 8
      });
    });
  }
  return combined;
};

window.addEventListener('DOMContentLoaded', () => {
  ensureGridCoordinates();
  window.renderPanes();
  window.populatePaneCatalog();
});

let catalogSubRxUpdated = false;
window.addEventListener('ezshack:subrx', (e) => {
  if (!catalogSubRxUpdated && isSubRxSupported(e.detail)) {
    catalogSubRxUpdated = true;
    if (typeof window.populatePaneCatalog === 'function') {
      window.populatePaneCatalog();
    }
  }
});

function ensureGridCoordinates() {
  if (!window.appState || !window.appState.panes) return;
  let curX = 1;
  let curY = 1;

  window.appState.panes.forEach((p) => {
    if (!p.gridCols || p.gridCols !== GRID_COLS) {
      const oldCols = p.gridCols || 8;
      const oldW = p.w || 4;
      const oldX = p.x || 1;
      p.w = Math.max(1, Math.min(GRID_COLS, Math.round((oldW / oldCols) * GRID_COLS)));
      p.x = Math.max(1, Math.min(GRID_COLS - p.w + 1, Math.round(((oldX - 1) / oldCols) * GRID_COLS) + 1));
      p.gridCols = GRID_COLS;
    }

    if (!p.w) p.w = 8;
    if (!p.h) p.h = p.customHeight ? Math.max(4, Math.round(p.customHeight / 52)) : 8;

    if (!p.x || !p.y) {
      if (curX + p.w - 1 > GRID_COLS) {
        curX = 1;
        curY += 8;
      }
      p.x = curX;
      p.y = curY;
      curX += p.w;
    }
  });
}

/* =====================================================================
   NATIVE SUB-RECEIVER WIDGET BUILDER (TS-2000 VHF/UHF DUAL WATCH)
   ===================================================================== */
function renderSubReceiverWidget(body, pane) {
  body.id = `subrx-body-${pane.instanceId}`;
  body.className = 'flex-1 relative bg-shack-950 flex flex-col p-3 font-mono select-none overflow-y-auto';

  body.innerHTML = `
    <!-- Inactive Banner (shown on non-TS2000 rigs) -->
    <div id="subrx-inactive-${pane.instanceId}" class="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500 hidden">
      <span class="text-amber-400 text-lg mb-1">⊘</span>
      <span class="font-bold text-slate-300">SUB-RECEIVER INACTIVE</span>
      <span class="text-[10px] mt-1 text-slate-600">Dual-watch VHF/UHF hardware is exclusive to Kenwood TS-2000.</span>
    </div>

    <!-- Active Widget Content -->
    <div id="subrx-active-${pane.instanceId}" class="flex-1 flex flex-col justify-between">
      <!-- Top Row: Title, Power & Mute -->
      <div class="flex items-center justify-between pb-2 border-b border-shack-border">
        <div class="flex items-center gap-1.5">
          <span class="text-cyan-400 text-xs">◈</span>
          <span class="text-xs font-bold tracking-wider text-slate-300">SUB VFO</span>
          <span id="subrx-band-${pane.instanceId}" class="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded font-sans">2m FM</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button id="subrx-pwr-${pane.instanceId}" class="px-2 py-0.5 rounded text-[11px] font-bold bg-shack-800 text-slate-400 border border-shack-700 hover:bg-shack-700 transition">
            OFF
          </button>
          <button id="subrx-mute-${pane.instanceId}" class="px-2 py-0.5 rounded text-[11px] font-bold bg-shack-800 text-slate-400 border border-shack-700 hover:bg-shack-700 transition">
            MUTE
          </button>
        </div>
      </div>

      <!-- Main Sub Frequency Readout -->
      <div class="my-2 text-center py-2 bg-shack-900 border border-shack-border rounded shadow-inner">
        <div id="subrx-freq-${pane.instanceId}" class="font-lcd text-2xl sm:text-3xl font-bold text-cyan-400 tracking-wider">
          146.520.00
        </div>
        <div class="text-[10px] text-slate-500 mt-0.5">SUB-RECEIVER ACTIVE TUNER</div>
      </div>

      <!-- Quick Pick Channels & Steppers -->
      <div class="grid grid-cols-5 gap-1 my-1">
        <button class="subrx-qbtn px-1 py-1 rounded text-[10px] font-bold bg-shack-850 hover:bg-cyan-950 hover:text-cyan-400 hover:border-cyan-800 text-slate-300 border border-shack-border transition" data-freq="146520000">146.52</button>
        <button class="subrx-qbtn px-1 py-1 rounded text-[10px] font-bold bg-shack-850 hover:bg-cyan-950 hover:text-cyan-400 hover:border-cyan-800 text-slate-300 border border-shack-border transition" data-freq="147000000">147.00</button>
        <button class="subrx-qbtn px-1 py-1 rounded text-[10px] font-bold bg-shack-850 hover:bg-cyan-950 hover:text-cyan-400 hover:border-cyan-800 text-slate-300 border border-shack-border transition" data-freq="446000000">446.00</button>
        <button class="subrx-sbtn px-1 py-1 rounded text-[10px] font-bold bg-shack-850 hover:bg-amber-950 hover:text-amber-400 hover:border-amber-800 text-slate-300 border border-shack-border transition" data-step="-25000">-25k</button>
        <button class="subrx-sbtn px-1 py-1 rounded text-[10px] font-bold bg-shack-850 hover:bg-amber-950 hover:text-amber-400 hover:border-amber-800 text-slate-300 border border-shack-border transition" data-step="25000">+25k</button>
      </div>

      <!-- Sub S-Meter Bar -->
      <div class="my-1.5">
        <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
          <span>SUB SIGNAL</span>
          <span id="subrx-smeter-val-${pane.instanceId}" class="font-bold text-cyan-400">S0</span>
        </div>
        <div class="h-2 w-full bg-slate-900 border border-shack-border rounded overflow-hidden">
          <div id="subrx-smeter-bar-${pane.instanceId}" class="h-full bg-cyan-400 transition-all duration-75" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Sub AF Volume Slider -->
      <div class="pt-1.5 border-t border-shack-border flex items-center gap-2">
        <span class="text-[10px] text-slate-400 shrink-0">VOL</span>
        <input type="range" id="subrx-vol-${pane.instanceId}" min="0" max="100" value="50" class="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer">
        <span id="subrx-vol-val-${pane.instanceId}" class="text-[10px] text-slate-400 font-bold shrink-0 w-7 text-right">50%</span>
      </div>
    </div>
  `;

  const inactiveEl = body.querySelector(`#subrx-inactive-${pane.instanceId}`);
  const activeEl = body.querySelector(`#subrx-active-${pane.instanceId}`);
  const pwrBtn = body.querySelector(`#subrx-pwr-${pane.instanceId}`);
  const muteBtn = body.querySelector(`#subrx-mute-${pane.instanceId}`);
  const freqEl = body.querySelector(`#subrx-freq-${pane.instanceId}`);
  const bandEl = body.querySelector(`#subrx-band-${pane.instanceId}`);
  const smeterBar = body.querySelector(`#subrx-smeter-bar-${pane.instanceId}`);
  const smeterVal = body.querySelector(`#subrx-smeter-val-${pane.instanceId}`);
  const volSlider = body.querySelector(`#subrx-vol-${pane.instanceId}`);
  const volVal = body.querySelector(`#subrx-vol-val-${pane.instanceId}`);

  let currentSub = {
    enabled: false,
    frequency: 146520000,
    band: '2m',
    mode: 'FM',
    smeter_val: 0,
    volume: 50,
    muted: false
  };

  function sendBridge(payload) {
    if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
      window.bridgeSocket.send(JSON.stringify(payload));
    }
  }

  // Button Listeners
  pwrBtn.addEventListener('click', () => {
    sendBridge({ action: 'set_sub_power', enabled: !currentSub.enabled });
  });

  muteBtn.addEventListener('click', () => {
    sendBridge({ action: 'set_sub_mute', muted: !currentSub.muted });
  });

  body.querySelectorAll('.subrx-qbtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const f = parseInt(e.target.getAttribute('data-freq'), 10);
      sendBridge({ action: 'set_sub_freq', freq: f });
    });
  });

  body.querySelectorAll('.subrx-sbtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const step = parseInt(e.target.getAttribute('data-step'), 10);
      const nextFreq = (currentSub.frequency || 146520000) + step;
      sendBridge({ action: 'set_sub_freq', freq: nextFreq });
    });
  });

  volSlider.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    volVal.textContent = `${v}%`;
    sendBridge({ action: 'set_sub_volume', volume: v });
  });

  function updateWidgetState(telemetryData) {
    const supported = isSubRxSupported(telemetryData);
    if (!supported) {
      inactiveEl.classList.remove('hidden');
      activeEl.classList.add('hidden');
      return;
    }

    inactiveEl.classList.add('hidden');
    activeEl.classList.remove('hidden');

    const sub = (telemetryData && telemetryData.sub_rx) || (window.appState && window.appState.telemetry && window.appState.telemetry.subRx);
    if (!sub) return;

    currentSub = { ...currentSub, ...sub };

    // Power State
    if (currentSub.enabled) {
      pwrBtn.textContent = 'ON';
      pwrBtn.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 transition shadow-[0_0_8px_#34d399]';
    } else {
      pwrBtn.textContent = 'OFF';
      pwrBtn.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-shack-800 text-slate-400 border border-shack-700 hover:bg-shack-700 transition';
    }

    // Mute State
    if (currentSub.muted) {
      muteBtn.textContent = 'MUTED';
      muteBtn.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-800 transition';
    } else {
      muteBtn.textContent = 'MUTE';
      muteBtn.className = 'px-2 py-0.5 rounded text-[11px] font-bold bg-shack-800 text-slate-400 border border-shack-700 hover:bg-shack-700 transition';
    }

    // Frequency Readout
    if (currentSub.enabled && currentSub.frequency) {
      const parts = (currentSub.frequency / 1000000).toFixed(5).split('.');
      freqEl.textContent = `${parts[0]}.${parts[1].slice(0, 3)}.${parts[1].slice(3, 5)}`;
      freqEl.className = 'font-lcd text-2xl sm:text-3xl font-bold text-cyan-400 tracking-wider';
    } else {
      freqEl.textContent = 'STANDBY';
      freqEl.className = 'font-lcd text-2xl sm:text-3xl font-bold text-slate-600 tracking-wider';
    }

    // Band/Mode
    bandEl.textContent = `${currentSub.band || '2m'} ${currentSub.mode || 'FM'}`;

    // Meter Fill (Kenwood SM1 scale: 0 to 15)
    const rawSmeter = currentSub.enabled ? (currentSub.smeter_val || 0) : 0;
    const pct = Math.min(100, Math.max(0, Math.round((rawSmeter / 15.0) * 100)));
    smeterBar.style.width = `${pct}%`;
    smeterVal.textContent = rawSmeter > 0 ? `S${Math.round(rawSmeter)}` : 'S0';

    // Volume
    if (document.activeElement !== volSlider && currentSub.volume !== undefined) {
      volSlider.value = currentSub.volume;
      volVal.textContent = `${currentSub.volume}%`;
    }
  }

  // Hook live telemetry event
  window.addEventListener('ezshack:subrx', (e) => updateWidgetState(e.detail));

  // Initial draw
  updateWidgetState(window.appState && window.appState.telemetry);
}

window.renderPanes = function() {
  const container = document.getElementById('panesContainer');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;
  container.innerHTML = '';

  container.className = 'w-full relative min-h-[calc(100vh-80px)] pb-20';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${GRID_COLS}, minmax(0, 1fr))`;
  container.style.gridAutoRows = '40px';
  container.style.gap = '12px';

  if (!window.appState || !window.appState.panes || window.appState.panes.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  window.appState.panes.forEach((pane, idx) => {
    try {
      const card = document.createElement('div');
      card.id = `pane-${pane.instanceId}`;
      card.className = 'bg-shack-900 border border-shack-border rounded-lg shadow-xl flex flex-col overflow-hidden relative group/card select-none';
      
      card.style.gridColumn = `${pane.x} / span ${pane.w}`;
      card.style.gridRow = `${pane.y} / span ${pane.h}`;

      const header = document.createElement('div');
      header.className = 'card-drag-handle px-3 py-2 bg-shack-850 border-b border-shack-border flex items-center justify-between text-xs font-mono shrink-0 cursor-grab active:cursor-grabbing';
      
      header.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden pointer-events-none">
          <span class="text-slate-500 font-sans text-xs">⋮⋮</span>
          <span class="w-2 h-2 rounded-full ${pane.isNative ? 'bg-cyan-400' : 'bg-amber-400'}"></span>
          <span class="font-bold text-slate-200 truncate tracking-wide" title="${pane.title}">${pane.title}</span>
        </div>
        <div class="flex items-center gap-1 text-slate-400" onclick="event.stopPropagation()">
          ${!pane.isNative ? `
            <button onclick="window.reloadPaneIframe('${pane.instanceId}')" class="p-1 hover:text-white hover:bg-shack-800 rounded transition" title="Reload iframe">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
            <button onclick="window.popoutPane('${pane.instanceId}')" class="p-1 hover:text-amber-400 hover:bg-shack-800 rounded transition" title="Pop out into clean popup window">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </button>
          ` : ''}
          <button onclick="window.toggleExpandPane('${pane.instanceId}')" class="p-1 hover:text-cyan-400 hover:bg-shack-800 rounded transition" title="Toggle half / full width">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </button>
          <button onclick="window.removePane('${pane.instanceId}')" class="p-1 hover:text-red-400 hover:bg-shack-800 rounded transition" title="Remove pane">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      `;

      header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();

        const containerRect = container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const grabOffsetX = e.clientX - cardRect.left;
        const grabOffsetY = e.clientY - cardRect.top;

        const ghost = document.createElement('div');
        ghost.id = 'pane-drag-ghost';
        ghost.className = 'border-2 border-dashed border-cyan-400 bg-cyan-950/25 rounded-lg pointer-events-none z-30 transition-all duration-75';
        ghost.style.gridColumn = `${pane.x} / span ${pane.w}`;
        ghost.style.gridRow = `${pane.y} / span ${pane.h}`;
        container.appendChild(ghost);

        card.classList.add('opacity-40');
        document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');

        const gap = 12;
        const rowUnit = 40 + gap;
        const colUnit = (containerRect.width - (gap * (GRID_COLS - 1))) / GRID_COLS + gap;

        let targetX = pane.x;
        let targetY = pane.y;

        function onMouseMove(me) {
          const currentRelX = me.clientX - containerRect.left - grabOffsetX + (colUnit / 2);
          const currentRelY = me.clientY - containerRect.top - grabOffsetY + (rowUnit / 2);

          targetX = Math.floor(currentRelX / colUnit) + 1;
          targetY = Math.floor(currentRelY / rowUnit) + 1;

          targetX = Math.max(1, Math.min(GRID_COLS - pane.w + 1, targetX));
          targetY = Math.max(1, targetY);

          ghost.style.gridColumn = `${targetX} / span ${pane.w}`;
          ghost.style.gridRow = `${targetY} / span ${pane.h}`;
        }

        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');

          card.classList.remove('opacity-40');
          if (ghost.parentNode) ghost.remove();

          pane.x = targetX;
          pane.y = targetY;
          card.style.gridColumn = `${pane.x} / span ${pane.w}`;
          card.style.gridRow = `${pane.y} / span ${pane.h}`;

          if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      card.appendChild(header);

      const body = document.createElement('div');

      const KEY_MAP = {
        'solar_monitor': 'solarMonitor',
        'qso_logger': 'qsoLogger',
        'great_circle': 'greatCircle',
        'shack_scratchpad': 'scratchpad',
        'satellite_tracker': 'satelliteTracker',
        'callsign_lookup': 'callsignLookup',
        'psk_reporter': 'psk_reporter',
        'sub_receiver': 'sub_receiver'
      };

      const rawKey = pane.widgetType || pane.catalogId || '';
      const resolvedKey = KEY_MAP[rawKey] || rawKey;

      // 1. Native Sub-Receiver Widget
      if (resolvedKey === 'sub_receiver' || rawKey === 'sub_receiver') {
        renderSubReceiverWidget(body, pane);
      }
      // 2. EZWidgets registered modules
      else {
        body.className = 'flex-1 relative bg-shack-950 overflow-hidden';
        const widgetObj = window.EZWidgets && (
          window.EZWidgets[resolvedKey] || 
          window.EZWidgets[rawKey] || 
          window.EZWidgets[pane.catalogId] || 
          window.EZWidgets[pane.widgetType]
        );

        if (widgetObj && typeof widgetObj.render === 'function') {
          const result = widgetObj.render(body, pane);
          if (result instanceof HTMLElement) {
            body.appendChild(result);
          }
        } 
        else if (typeof window.buildNativeWidget === 'function') {
          const el = window.buildNativeWidget(resolvedKey, pane.instanceId);
          if (el instanceof HTMLElement) body.appendChild(el);
        } 
        else {
          const finalUrl = resolveTemplateUrl(pane.urlTemplate);
          body.innerHTML = `
            <iframe id="iframe-${pane.instanceId}" src="${finalUrl}" class="w-full h-full border-0 bg-white" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>
            <div class="absolute bottom-0 inset-x-0 bg-shack-900/90 backdrop-blur-xs border-t border-shack-800 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span class="truncate pr-2" title="${finalUrl}">URL: ${finalUrl}</span>
              <button onclick="window.openFrameShieldModal('${escapeQuotes(pane.title)}', '${escapeQuotes(finalUrl)}')" class="shrink-0 text-amber-400 hover:underline flex items-center gap-1 font-bold">
                Frame Shield / Pop Out ↗
              </button>
            </div>
          `;
        }
      }
      card.appendChild(body);

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'card-resize-handle';
      resizeHandle.title = 'Drag to resize across 16 horizontal columns';
      resizeHandle.innerHTML = `
        <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
          <path d="M8 2 L10 2 L10 10 L2 10 L2 8 L8 8 Z"/>
          <path d="M5 5 L7 5 L7 7 L5 7 Z"/>
        </svg>
      `;

      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const initialW = pane.w;
        const initialH = pane.h;
        const containerRect = container.getBoundingClientRect();

        const gap = 12;
        const rowUnit = 40 + gap;
        const colUnit = (containerRect.width - (gap * (GRID_COLS - 1))) / GRID_COLS + gap;

        document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
        card.classList.add('ring-2', 'ring-cyan-400');

        let newW = initialW;
        let newH = initialH;

        function onResizeMove(me) {
          const deltaX = me.clientX - startX;
          const deltaY = me.clientY - startY;

          const colDelta = Math.round(deltaX / colUnit);
          const rowDelta = Math.round(deltaY / rowUnit);

          newW = Math.max(1, Math.min(GRID_COLS - pane.x + 1, initialW + colDelta));
          newH = Math.max(3, initialH + rowDelta);

          card.style.gridColumn = `${pane.x} / span ${newW}`;
          card.style.gridRow = `${pane.y} / span ${newH}`;
        }

        function onResizeUp() {
          document.removeEventListener('mousemove', onResizeMove);
          document.removeEventListener('mouseup', onResizeUp);
          document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
          card.classList.remove('ring-2', 'ring-cyan-400');

          pane.w = newW;
          pane.h = newH;
          if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
        }

        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeUp);
      });

      card.appendChild(resizeHandle);
      container.appendChild(card);
    } catch (cardError) {
      console.error(`[EZShack] Failed to render pane #${idx}:`, cardError);
    }
  });
};

function resolveTemplateUrl(urlTemplate) {
  if (!urlTemplate) return '';
  const call = (window.appState && window.appState.profile && window.appState.profile.callsign) ? window.appState.profile.callsign : 'N0CALL';
  const grid = (window.appState && window.appState.profile && window.appState.profile.grid) ? window.appState.profile.grid : 'AA00aa';
  const freq = (window.appState && window.appState.vfo && window.appState.vfo.frequency) ? (window.appState.vfo.frequency / 1000).toFixed(0) : '14074';
  const band = (window.appState && window.appState.vfo && window.appState.vfo.band) ? window.appState.vfo.band : '20m';
  return urlTemplate
    .replace(/{callsign}/g, encodeURIComponent(call))
    .replace(/{grid}/g, encodeURIComponent(grid))
    .replace(/{freq}/g, encodeURIComponent(freq))
    .replace(/{band}/g, encodeURIComponent(band));
}

window.reloadPaneIframe = function(instanceId) {
  const iframe = document.getElementById(`iframe-${instanceId}`);
  if (iframe) {
    const src = iframe.src;
    iframe.src = '';
    setTimeout(() => { iframe.src = src; }, 100);
    if (typeof window.showToast === 'function') window.showToast('Reloading pane frame...');
  }
};

window.popoutPane = function(instanceId) {
  const pane = window.appState.panes.find(p => p.instanceId === instanceId);
  if (pane && pane.urlTemplate) {
    const url = resolveTemplateUrl(pane.urlTemplate);
    window.open(url, '_blank', 'width=1024,height=720,menubar=no,toolbar=no,location=no,status=no');
  }
};

window.toggleExpandPane = function(instanceId) {
  const pane = window.appState.panes.find(p => p.instanceId === instanceId);
  if (pane) {
    if (pane.w >= GRID_COLS) {
      pane.w = Math.floor(GRID_COLS / 2);
    } else {
      pane.x = 1;
      pane.w = GRID_COLS;
    }
    if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
    window.renderPanes();
  }
};

window.removePane = function(instanceId) {
  if (!window.appState || !window.appState.panes) return;
  window.appState.panes = window.appState.panes.filter(p => p.instanceId !== instanceId);
  if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
  window.renderPanes();
  if (typeof window.showToast === 'function') window.showToast('Pane removed from dashboard.');
};

window.renderSettingsPanesList = function() {
  const container = document.getElementById('settingsPanesList');
  if (!container) return;
  container.innerHTML = '';

  if (!window.appState || !window.appState.panes || window.appState.panes.length === 0) {
    container.innerHTML = '<div class="text-slate-500 text-xs py-2">No active panes on dashboard.</div>';
    return;
  }

  window.appState.panes.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-2.5 bg-shack-900 border border-shack-border rounded text-xs';
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-slate-500 font-mono">#${idx+1}</span>
        <span class="font-bold text-slate-200">${p.title}</span>
        <span class="text-[10px] text-slate-500">(${p.isNative ? 'Native' : 'Embed'}) [${p.w}x${p.h}]</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="window.removePane('${p.instanceId}'); window.renderSettingsPanesList();" class="text-red-400 hover:text-red-300 font-mono text-xs">Remove</button>
      </div>
    `;
    container.appendChild(row);
  });
};

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.applyPreset = function(presetKey, notify = true) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  const catalog = window.getCombinedCatalog();

  if (!window.appState) {
    window.appState = { panes: [] };
  }

  window.appState.panes = preset.map(item => {
    const cat = catalog.find(c => c.id === item.catalogId) || {
      id: item.catalogId,
      title: item.catalogId,
      isNative: false,
      urlTemplate: ''
    };
    return {
      instanceId: 'p_' + Math.random().toString(36).substr(2, 9),
      catalogId: cat.id,
      title: cat.title,
      isNative: cat.isNative,
      widgetType: cat.widgetType,
      urlTemplate: cat.urlTemplate || '',
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      gridCols: GRID_COLS
    };
  });

  window.renderPanes();
  if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
  const dropdown = document.getElementById('presetDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  if (notify && typeof window.showToast === 'function') window.showToast(`Loaded "${presetKey}" 16-column layout.`);
};

window.loadDefaultPreset = function() {
  window.applyPreset('dxHunter', false);
};

window.populatePaneCatalog = function() {
  const catalogList = document.getElementById('paneCatalogList');
  if (!catalogList) return;
  catalogList.innerHTML = '';

  const catalog = window.getCombinedCatalog();
  const seenIds = new Set();

  catalog.forEach(item => {
    if (!item || !item.id || seenIds.has(item.id)) return;
    seenIds.add(item.id);

    const div = document.createElement('div');
    div.className = 'bg-shack-850 border border-shack-border hover:border-amber-500/50 p-3 rounded flex flex-col justify-between transition';
    div.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="font-bold text-slate-200 text-xs">${item.title}</span>
          <span class="text-[9px] font-mono px-1.5 py-0.5 rounded ${item.isNative ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-shack-800 text-slate-400'}">${item.isNative ? 'NATIVE' : 'EMBED'}</span>
        </div>
        <p class="text-[11px] text-slate-400 leading-snug mb-2">${item.description}</p>
      </div>
      <button onclick="window.addCatalogPane('${item.id}')" class="w-full py-1.5 bg-shack-800 hover:bg-amber-500 hover:text-black text-slate-200 font-mono text-xs font-bold rounded transition">
        + Add to Dashboard
      </button>
    `;
    catalogList.appendChild(div);
  });
};

window.addCatalogPane = function(catalogId) {
  const catalog = window.getCombinedCatalog();
  const cat = catalog.find(c => c.id === catalogId);
  if (!cat) return;

  if (!window.appState) {
    window.appState = { panes: [] };
  }
  if (!Array.isArray(window.appState.panes)) {
    window.appState.panes = [];
  }

  let maxY = 1;
  window.appState.panes.forEach(p => {
    const bottom = (p.y || 1) + (p.h || 8);
    if (bottom > maxY) maxY = bottom;
  });

  const newPane = {
    instanceId: 'p_' + Math.random().toString(36).substr(2, 9),
    catalogId: cat.id,
    title: cat.title,
    isNative: cat.isNative,
    widgetType: cat.widgetType,
    urlTemplate: cat.urlTemplate || '',
    x: 1,
    y: maxY,
    w: cat.defaultW || 5,
    h: cat.defaultH || 8,
    gridCols: GRID_COLS
  };

  window.appState.panes.push(newPane);
  window.renderPanes();
  if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
  if (typeof window.closeModal === 'function') window.closeModal('addPaneModal');
  if (typeof window.showToast === 'function') window.showToast(`Added "${cat.title}"`);
};

window.addCustomUrlPane = function() {
  const titleInput = document.getElementById('customPaneTitle');
  const urlInput = document.getElementById('customPaneUrl');
  const heightSelect = document.getElementById('customPaneHeight');

  const title = titleInput?.value.trim() || 'Custom Ham Tool';
  const url = urlInput?.value.trim();

  if (!url) {
    if (typeof window.showToast === 'function') window.showToast('Please enter a valid website URL.');
    return;
  }

  let rowHeight = 8;
  if (heightSelect?.value === 'h-72') rowHeight = 6;
  if (heightSelect?.value === 'h-[520px]') rowHeight = 11;

  if (!window.appState) {
    window.appState = { panes: [] };
  }
  if (!Array.isArray(window.appState.panes)) {
    window.appState.panes = [];
  }

  let maxY = 1;
  window.appState.panes.forEach(p => {
    const bottom = (p.y || 1) + (p.h || 8);
    if (bottom > maxY) maxY = bottom;
  });

  const newPane = {
    instanceId: 'p_' + Math.random().toString(36).substr(2, 9),
    title: title,
    isNative: false,
    urlTemplate: url,
    x: 1,
    y: maxY,
    w: 8,
    h: rowHeight,
    gridCols: GRID_COLS
  };

  window.appState.panes.push(newPane);
  window.renderPanes();
  if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
  if (titleInput) titleInput.value = '';
  if (urlInput) urlInput.value = '';
  if (typeof window.closeModal === 'function') window.closeModal('addPaneModal');
  if (typeof window.showToast === 'function') window.showToast(`Added "${title}" to dashboard.`);
};

/* =====================================================================
   EZSHACK - DYNAMIC WORKSPACE PRESETS & MEMORY CONTROLLER
   ===================================================================== */

let isMemArmed = false;
let activePresetId = 1;

const DEFAULT_PRESET_META = [
  { id: 1, label: 'P1: GEN' },
  { id: 2, label: 'P2: SAT' },
  { id: 3, label: 'P3: FT8' },
  { id: 4, label: 'P4: DX' }
];

function getPresetMeta() {
  try {
    const saved = localStorage.getItem('EZSHACK_PRESETS_META');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [...DEFAULT_PRESET_META];
}

function savePresetMeta(meta) {
  try {
    localStorage.setItem('EZSHACK_PRESETS_META', JSON.stringify(meta));
  } catch (e) {}
}

window.renderPresetButtons = function() {
  const container = document.getElementById('presetButtonsBar');
  if (!container) return;

  const presets = getPresetMeta();
  container.innerHTML = '';

  presets.forEach(p => {
    const btn = document.createElement('button');
    btn.id = `btnPreset-${p.id}`;
    btn.type = 'button';
    btn.onclick = () => window.handlePresetClick(p.id);

    const isActive = (p.id === activePresetId);
    btn.className = isActive
      ? 'preset-btn px-2.5 py-1 rounded text-[11px] font-bold bg-cyan-600 text-white border border-cyan-400 transition'
      : 'preset-btn px-2.5 py-1 rounded text-[11px] font-bold bg-shack-800 text-slate-300 border border-shack-700 hover:bg-shack-700 transition';

    btn.textContent = p.label;
    btn.title = `Preset P${p.id} (Click to load; MEM + click to save and rename)`;
    container.appendChild(btn);
  });
};

window.armPresetMemory = function() {
  isMemArmed = !isMemArmed;
  const memBtn = document.getElementById('btnMem');
  if (!memBtn) return;

  if (isMemArmed) {
    memBtn.className = 'px-2 py-1 rounded text-[11px] font-bold bg-amber-500 text-black border border-amber-300 transition animate-pulse';
    if (typeof window.showToast === 'function') {
      window.showToast('MEM armed. Click a preset button to save and rename.');
    }
  } else {
    memBtn.className = 'px-2 py-1 rounded text-[11px] font-bold bg-shack-800 hover:bg-shack-700 text-slate-300 border border-shack-700 transition';
  }
};

window.handlePresetClick = function(num) {
  const memBtn = document.getElementById('btnMem');

  if (isMemArmed) {
    const presets = getPresetMeta();
    let currentPreset = presets.find(p => p.id === num);
    if (!currentPreset) {
      currentPreset = { id: num, label: `P${num}` };
      presets.push(currentPreset);
    }

    const promptName = prompt(`Enter button label for Preset P${num}:`, currentPreset.label);
    if (promptName !== null && promptName.trim() !== '') {
      currentPreset.label = promptName.trim();
    }
    savePresetMeta(presets);

    const currentPanes = (window.appState && Array.isArray(window.appState.panes)) 
      ? JSON.parse(JSON.stringify(window.appState.panes))
      : [];

    localStorage.setItem(`EZSHACK_WORKSPACE_P${num}`, JSON.stringify(currentPanes));

    isMemArmed = false;
    if (memBtn) {
      memBtn.className = 'px-2 py-1 rounded text-[11px] font-bold bg-shack-800 hover:bg-shack-700 text-slate-300 border border-shack-700 transition';
    }

    activePresetId = num;
    window.renderPresetButtons();

    if (typeof window.showToast === 'function') {
      window.showToast(`Saved layout to "${currentPreset.label}"`);
    }
  } else {
    window.loadWorkspacePreset(num);
  }
};

window.addNewPreset = function() {
  const presets = getPresetMeta();
  const nextId = presets.length > 0 ? Math.max(...presets.map(p => p.id)) + 1 : 1;
  const defaultLabel = `P${nextId}: WORK`;

  const inputLabel = prompt(`Enter name for new Preset P${nextId}:`, defaultLabel);
  if (inputLabel === null) return;

  const cleanLabel = inputLabel.trim() || defaultLabel;
  presets.push({ id: nextId, label: cleanLabel });
  savePresetMeta(presets);

  const currentPanes = (window.appState && Array.isArray(window.appState.panes)) 
    ? JSON.parse(JSON.stringify(window.appState.panes))
    : [];
  localStorage.setItem(`EZSHACK_WORKSPACE_P${nextId}`, JSON.stringify(currentPanes));

  activePresetId = nextId;
  window.renderPresetButtons();

  if (typeof window.showToast === 'function') {
    window.showToast(`Created & saved "${cleanLabel}"`);
  }
};

window.loadWorkspacePreset = function(num) {
  const presets = getPresetMeta();
  const currentPreset = presets.find(p => p.id === num) || { label: `P${num}` };
  const saved = localStorage.getItem(`EZSHACK_WORKSPACE_P${num}`);

  if (saved) {
    try {
      const layout = JSON.parse(saved);
      if (Array.isArray(layout) && layout.length > 0) {
        activePresetId = num;
        window.renderPresetButtons();
        window.appState.panes = layout;
        if (typeof window.saveStateToStorage === 'function') window.saveStateToStorage();
        if (typeof window.renderPanes === 'function') window.renderPanes();
        if (typeof window.showToast === 'function') window.showToast(`Loaded ${currentPreset.label}`);
        return;
      }
    } catch (e) {
      console.error("[EZShack] Error loading preset:", e);
    }
  }

  if (num === 1 && typeof window.loadDefaultPreset === 'function') {
    window.loadDefaultPreset();
    activePresetId = 1;
    window.renderPresetButtons();
    if (typeof window.showToast === 'function') window.showToast('Loaded Default Layout (P1)');
    return;
  }

  if (typeof window.showToast === 'function') {
    window.showToast(`Preset "${currentPreset.label}" is empty. Click MEM -> ${currentPreset.label} to save.`);
  }
};

setTimeout(() => {
  if (typeof window.renderPresetButtons === 'function') {
    window.renderPresetButtons();
  }
}, 50);