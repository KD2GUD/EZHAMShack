/* =====================================================================
   EZSHACK - CORE APPLICATION CONTROLLER (app.js)
   Hardware CAT, Telemetry, FCC License Engine & Station State
   ===================================================================== */

const DEFAULT_PROFILE = {
  callsign: 'N0CALL',
  licenseClass: 'TECHNICIAN',
  meterProfile: 'auto',
  grid: 'AA00aa',
  lat: 0.0,
  lon: 0.0,
  city: '',
  state: '',
  country: 'USA',
  cqz: '',
  ituz: '',
  power: '100',
  rigName: '',
  antenna: ''
};

// 5 Transceiver S-Meter Calibration Models
window.RADIO_METER_PROFILES = {
  yaesu: {
    name: "Yaesu Modern CAT",
    s0Floor: 2.0,
    s9Threshold: 46.0,
    unitsPerS: 5.11,
    calculate(v) {
      if (isNaN(v) || v <= this.s0Floor) return { segments: 0, label: 'S0' };
      if (v <= this.s9Threshold) {
        const s = Math.max(1, Math.min(9, Math.round(v / this.unitsPerS)));
        return { segments: s, label: `S${s}` };
      }
      const overDb = v - this.s9Threshold;
      const dbSteps = Math.min(6, Math.max(1, Math.round(overDb / 10.0)));
      const displayDb = Math.min(60, Math.max(10, Math.round(overDb / 10.0) * 10));
      return { segments: 9 + dbSteps, label: `S9+${displayDb}dB` };
    }
  },
  yaesu_legacy: {
    name: "Yaesu FT-857 / 817 / 897",
    s0Floor: 1.0,
    s9Threshold: 153.0,
    unitsPerS: 17.0,
    calculate(v) {
      if (isNaN(v) || v <= this.s0Floor) return { segments: 0, label: 'S0' };
      // FT-857D 0xE7 returns 0..15 nibble scaled by 17.0 (0..255)
      const rawNibble = Math.max(0, Math.min(15, Math.round(v / 17.0)));
      if (rawNibble === 0) return { segments: 0, label: 'S0' };
      if (rawNibble <= 9) {
        return { segments: rawNibble, label: `S${rawNibble}` };
      }
      const dbSteps = Math.min(6, rawNibble - 9);
      return { segments: 9 + dbSteps, label: `S9+${dbSteps * 10}dB` };
    }
  },
  kenwood: {
    name: "Kenwood / Elecraft",
    s0Floor: 0.5,
    s9Threshold: 15.0,
    unitsPerS: 1.667,
    calculate(v) {
      if (isNaN(v) || v <= this.s0Floor) return { segments: 0, label: 'S0' };
      if (v <= this.s9Threshold) {
        const s = Math.max(1, Math.min(9, Math.round(v / this.unitsPerS)));
        return { segments: s, label: `S${s}` };
      }
      const overCounts = v - this.s9Threshold;
      const overDb = overCounts * 4.0;
      const dbSteps = Math.min(6, Math.max(1, Math.round(overDb / 10.0)));
      const displayDb = Math.min(60, Math.max(10, Math.round(overDb / 10.0) * 10));
      return { segments: 9 + dbSteps, label: `S9+${displayDb}dB` };
    }
  },
  icom: {
    name: "Icom CI-V Standard",
    s0Floor: 4.0,
    s9Threshold: 128.0,
    unitsPerS: 14.22,
    calculate(v) {
      if (isNaN(v) || v <= this.s0Floor) return { segments: 0, label: 'S0' };
      if (v <= this.s9Threshold) {
        const s = Math.max(1, Math.min(9, Math.round(v / this.unitsPerS)));
        return { segments: s, label: `S${s}` };
      }
      const overCounts = v - this.s9Threshold;
      const overDb = (overCounts / 112.0) * 60.0;
      const dbSteps = Math.min(6, Math.max(1, Math.round(overDb / 10.0)));
      const displayDb = Math.min(60, Math.max(10, Math.round(overDb / 10.0) * 10));
      return { segments: 9 + dbSteps, label: `S9+${displayDb}dB` };
    }
  },
  generic: {
    name: "Generic / SDR Normalized (0-100%)",
    s0Floor: 2.0,
    s9Threshold: 50.0,
    unitsPerS: 5.55,
    calculate(v) {
      if (isNaN(v) || v <= this.s0Floor) return { segments: 0, label: 'S0' };
      if (v <= this.s9Threshold) {
        const s = Math.max(1, Math.min(9, Math.round(v / this.unitsPerS)));
        return { segments: s, label: `S${s}` };
      }
      const overCounts = v - this.s9Threshold;
      const overDb = (overCounts / 50.0) * 60.0;
      const dbSteps = Math.min(6, Math.max(1, Math.round(overDb / 10.0)));
      const displayDb = Math.min(60, Math.max(10, Math.round(overDb / 10.0) * 10));
      return { segments: 9 + dbSteps, label: `S9+${displayDb}dB` };
    }
  }
};

// Global App State bound directly to window
window.appState = {
  profile: { ...DEFAULT_PROFILE },
  vfo: {
    active: 'A',
    vfoA: { frequency: null, mode: 'USB', band: '--m' },
    vfoB: { frequency: null, mode: 'LSB', band: '--m' },
    frequency: null,
    band: '--m',
    mode: '---',
    isSimulated: false
  },
  bandFrequencies: {},
  solar: {
    sfi: 164,
    ssn: 138,
    aIndex: 6,
    kIndex: 2,
    status: 'Quiet'
  },
  telemetry: {
    ptt: false,
    rigSearching: true,
    smeterVal: 0,
    smeterStr: 'S0',
    pwrOut: 0.0,
    swr: 1.0,
    powerTarget: 100,
    volumeTarget: 50,
    tunerEnabled: false,
    tunerTuning: false,
    xcvr: 'Radio',
    rigId: '',
    isMuted: false,
    preMuteVol: 50,
    capabilities: [],
    supported_bands: [],
    subRx: null
  },
  panes: [],
  qsos: [],
  scratchpadText: 'Welcome to EZShack! Record skeds, QSL addresses, and net notes here.',
  nightMode: false,
  uiZoom: 1.0,
  radioSoftware: 'flrig',
  radioPort: 8088
};

let tuneLockUntil = 0;
let pwrLockUntil = 0;
let volLockUntil = 0;
let isShuttingDown = false;
let lastAutoSegmentKey = null;
window.bridgeSocket = null;
window.subReceiverWidget = null;

/* =====================================================================
   PROFILE & CAPABILITY RESOLVER ENGINE
   ===================================================================== */
window.resolveActiveMeterProfile = function() {
  const chosen = window.appState.profile.meterProfile || 'auto';
  if (chosen !== 'auto' && window.RADIO_METER_PROFILES[chosen]) {
    return { key: chosen, profile: window.RADIO_METER_PROFILES[chosen], isAuto: false };
  }

  const rigId = (window.appState.telemetry.rigId || '').toLowerCase();
  const xcvr = (window.appState.telemetry.xcvr || '').toUpperCase();

  // Check legacy Yaesu 5-byte binary rigs (FT-857D / FT-817 / FT-897) BEFORE generic FT- match
  if (
    rigId.includes('857') || rigId.includes('817') || rigId.includes('897') ||
    xcvr.includes('857') || xcvr.includes('817') || xcvr.includes('897')
  ) {
    return { key: 'yaesu_legacy', profile: window.RADIO_METER_PROFILES.yaesu_legacy, isAuto: true };
  }
  if (xcvr.includes('FT-') || xcvr.includes('FTDX') || xcvr.includes('YAESU') || xcvr.includes('991')) {
    return { key: 'yaesu', profile: window.RADIO_METER_PROFILES.yaesu, isAuto: true };
  }
  if (xcvr.includes('TS-') || xcvr.includes('KENWOOD') || xcvr.includes('K3') || xcvr.includes('KX') || xcvr.includes('ELECRAFT') || xcvr.includes('2000')) {
    return { key: 'kenwood', profile: window.RADIO_METER_PROFILES.kenwood, isAuto: true };
  }
  if (xcvr.includes('IC-') || xcvr.includes('ICOM') || xcvr.includes('7300') || xcvr.includes('7610')) {
    return { key: 'icom', profile: window.RADIO_METER_PROFILES.icom, isAuto: true };
  }
  return { key: 'generic', profile: window.RADIO_METER_PROFILES.generic, isAuto: true };
};

window.calculateSmeter = function(val) {
  const active = window.resolveActiveMeterProfile();
  return active.profile.calculate(val);
};

window.getRigSupportedBands = function() {
  const tel = window.appState.telemetry || {};
  if (Array.isArray(tel.supported_bands) && tel.supported_bands.length > 0) {
    return tel.supported_bands;
  }

  const combined = `${tel.rigId || ''} ${tel.xcvr || ''}`.toLowerCase().trim();
  if (!combined || combined === 'radio') return null;

  const HF_ONLY = ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m'];
  const HF_6M = [...HF_ONLY, '6m'];
  const ALL_BAND = [...HF_6M, '2m', '70cm'];
  const VHF_UHF_SHF = ['2m', '70cm', '23cm'];

  if (/ic-?9700/.test(combined)) return VHF_UHF_SHF;
  if (/ic-?718/.test(combined)) return HF_ONLY;
  if (/ic-?(7300|7610|7600|7410|7200|756|7700|7800|7851)/.test(combined)) return HF_6M;
  if (/ftdx-?(10|101|3000|5000|1200)|ft-?(891|450|950|920|1000)/.test(combined)) return HF_6M;
  if (/ts-?(590|890|990|480|570|870)/.test(combined)) return HF_6M;
  if (/\b(kx2|kx3|k3|k4)\b/.test(combined)) return HF_6M;
  if (/ft-?(991|857|897|817|818|100)|ic-?(705|7100|7000|706|9100)|ts-?2000/.test(combined)) {
    return ALL_BAND;
  }
  return null;
};

window.isRigCapabilitySupported = function(capName) {
  const rigId = (window.appState.telemetry.rigId || '').toLowerCase();
  const xcvr = (window.appState.telemetry.xcvr || '').toUpperCase();
  const isLegacyFt8xx =
    rigId.includes('857') || rigId.includes('817') || rigId.includes('897') ||
    xcvr.includes('857') || xcvr.includes('817') || xcvr.includes('897');

  if (isLegacyFt8xx && (capName === 'af_gain' || capName === 'rf_power' || capName === 'tuner')) {
    return false;
  }

  const caps = window.appState.telemetry.capabilities;
  if (Array.isArray(caps) && (caps.includes('af_gain') || caps.includes('rf_power') || caps.includes('sub_rx') || caps.includes('tuner'))) {
    return caps.includes(capName);
  }

  return true;
};

window.updateTunerDisplay = function() {
  const atuSupported = window.isRigCapabilitySupported('tuner');
  const badge = document.getElementById('atuStateBadge');
  const tuneBtn = document.getElementById('btnAtuTune');
  const toggleBtn = document.getElementById('btnAtuToggle');

  if (!atuSupported) {
    if (badge) {
      badge.innerText = 'NONE';
      badge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-shack-900 text-slate-500 border border-shack-800';
    }
    if (tuneBtn) {
      tuneBtn.disabled = true;
      tuneBtn.innerText = 'TUNE';
    }
    if (toggleBtn) toggleBtn.disabled = true;
    return;
  }

  const isTuning = Boolean(window.appState.telemetry.tunerTuning);
  const isEnabled = Boolean(window.appState.telemetry.tunerEnabled);

  if (toggleBtn) toggleBtn.disabled = isTuning;

  if (badge) {
    if (isTuning) {
      badge.innerText = 'TUNING';
      badge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-600 animate-pulse';
    } else if (isEnabled) {
      badge.innerText = 'ON';
      badge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-700';
    } else {
      badge.innerText = 'OFF';
      badge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-shack-800 text-slate-400 border border-shack-700';
    }
  }

  if (tuneBtn) {
    tuneBtn.disabled = isTuning;
    if (isTuning) {
      tuneBtn.innerText = 'TUNING...';
      tuneBtn.className = 'px-2 py-0.5 bg-amber-500 text-black font-bold rounded border border-amber-300 text-[10px] animate-pulse cursor-wait';
    } else {
      tuneBtn.innerText = 'TUNE';
      tuneBtn.className = 'px-2 py-0.5 bg-shack-800 hover:bg-amber-500 hover:text-black text-amber-400 font-bold rounded border border-amber-500/40 text-[10px] transition cursor-pointer';
    }
  }
};

window.updateRigControlAvailability = function() {
  const afSupported = window.isRigCapabilitySupported('af_gain');
  const pwrSupported = window.isRigCapabilitySupported('rf_power');
  const atuSupported = window.isRigCapabilitySupported('tuner');

  // 1. Built-In ATU / Tune Control Group
  const atuContainer = document.getElementById('atuControlGroup');
  if (atuContainer) {
    atuContainer.classList.toggle('opacity-35', !atuSupported);
    atuContainer.classList.toggle('pointer-events-none', !atuSupported);
    atuContainer.classList.toggle('select-none', !atuSupported);
    if (!atuSupported) {
      atuContainer.title = 'No built-in antenna tuner on this transceiver';
    } else {
      atuContainer.title = 'Toggle built-in ATU bypass/inline or trigger an auto-tune cycle';
    }
  }
  window.updateTunerDisplay();

  // 2. AF Volume Control Group (Ghost & Disable when hardware-pot only, e.g. FT-857D)
  const vSlider = document.getElementById('afVolSlider') || document.getElementById('rigVolumeSlider');
  const vDisp = document.getElementById('afVolDisplay') || document.getElementById('rigVolumeLabel') || document.getElementById('rigVolumeDisplay');
  const muteBtn = document.getElementById('btnMute');
  const volContainer =
    document.getElementById('afVolControlGroup') ||
    document.getElementById('afVolumeGroup') ||
    (vSlider ? vSlider.parentElement : null);

  if (vSlider) {
    vSlider.disabled = !afSupported;
    vSlider.classList.toggle('cursor-not-allowed', !afSupported);
    vSlider.classList.toggle('cursor-pointer', afSupported);
  }
  if (muteBtn) {
    muteBtn.disabled = !afSupported;
  }
  if (volContainer) {
    volContainer.classList.toggle('opacity-35', !afSupported);
    volContainer.classList.toggle('pointer-events-none', !afSupported);
    volContainer.classList.toggle('select-none', !afSupported);
    if (!afSupported) {
      volContainer.title = 'AF Volume is controlled via the physical front-panel knob on this transceiver';
    } else {
      volContainer.removeAttribute('title');
    }
  }
  if (vDisp) {
    if (!afSupported) {
      vDisp.innerText = 'KNOB';
    } else if (vDisp.innerText === 'KNOB') {
      vDisp.innerText = `${window.appState.telemetry.volumeTarget ?? 50}%`;
    }
  }

  // 3. TX RF Power Control Group (Ghost & Disable when menu-only, e.g. FT-857D)
  const pSlider = document.getElementById('txPwrSlider');
  const pDisp = document.getElementById('txPwrDisplay');
  const pwrContainer =
    document.getElementById('txPwrControlGroup') ||
    document.getElementById('txPowerGroup') ||
    (pSlider ? pSlider.parentElement : null);

  if (pSlider) {
    pSlider.disabled = !pwrSupported;
    pSlider.classList.toggle('cursor-not-allowed', !pwrSupported);
    pSlider.classList.toggle('cursor-pointer', pwrSupported);
  }
  document.querySelectorAll('[onclick*="setQuickPower"]').forEach(btn => {
    btn.disabled = !pwrSupported;
    btn.classList.toggle('opacity-35', !pwrSupported);
    btn.classList.toggle('pointer-events-none', !pwrSupported);
  });
  if (pwrContainer) {
    pwrContainer.classList.toggle('opacity-35', !pwrSupported);
    pwrContainer.classList.toggle('pointer-events-none', !pwrSupported);
    pwrContainer.classList.toggle('select-none', !pwrSupported);
    if (!pwrSupported) {
      pwrContainer.title = 'TX Power is set in the radio menu (#075) on this transceiver';
    } else {
      pwrContainer.removeAttribute('title');
    }
  }
  if (pDisp) {
    if (!pwrSupported) {
      pDisp.innerText = 'MENU';
    } else if (pDisp.innerText === 'MENU') {
      pDisp.innerText = `${window.appState.telemetry.powerTarget ?? 100}W`;
    }
  }

  // 4. Refresh Satellite Tracker transponder band gating if mounted
  if (typeof window.updateTransponderDisplay === 'function') {
    window.updateTransponderDisplay();
  }
};

window.triggerBuiltInTune = function() {
  if (!window.isRigCapabilitySupported('tuner')) return;
  window.appState.telemetry.tunerEnabled = true;
  window.appState.telemetry.tunerTuning = true;
  window.updateTunerDisplay();

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "start_tune" }));
  }
  window.showToast('Starting built-in ATU tune cycle...');
};

window.toggleBuiltInTuner = function() {
  if (!window.isRigCapabilitySupported('tuner')) return;
  if (window.appState.telemetry.tunerTuning) return;

  const nextState = !window.appState.telemetry.tunerEnabled;
  window.appState.telemetry.tunerEnabled = nextState;
  window.updateTunerDisplay();

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_tuner", enabled: nextState }));
  }
  window.showToast(`Built-in ATU ${nextState ? 'ENABLED (Inline)' : 'BYPASSED (Off)'}`);
};

/* =====================================================================
   VIEWPORT ZOOM, FULLSCREEN & STICKY HEADER SYNC
   ===================================================================== */
window.syncStickyHeaderOffset = function() {
  const header = document.getElementById('mainHeader');
  const strip = document.getElementById('telemetryStrip');
  if (header && strip) {
    strip.style.top = `${header.offsetHeight}px`;
  }
};

window.applyUiZoom = function(zoomVal) {
  const clamped = Math.max(0.75, Math.min(1.25, Math.round(zoomVal * 100) / 100));
  window.appState.uiZoom = clamped;
  document.documentElement.style.zoom = String(clamped);

  const badge = document.getElementById('btnZoomReset');
  if (badge) {
    badge.innerText = `${Math.round(clamped * 100)}%`;
  }
  window.syncStickyHeaderOffset();
};

window.adjustUiZoom = function(delta) {
  const current = window.appState.uiZoom || 1.0;
  window.applyUiZoom(current + delta);
  window.saveStateToStorage();
};

window.resetUiZoom = function() {
  window.applyUiZoom(1.0);
  window.saveStateToStorage();
  window.showToast('Display zoom reset to 100%');
};

window.updateFullscreenButton = function() {
  const btn = document.getElementById('btnFullscreen');
  if (!btn) return;
  const isFs = Boolean(document.fullscreenElement);
  btn.classList.toggle('text-amber-400', isFs);
  btn.classList.toggle('bg-shack-700', isFs);
};

window.toggleFullscreenMode = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      window.showToast(`Fullscreen unavailable: ${err.message || 'Press F11'}`);
    });
  } else {
    document.exitFullscreen().catch(() => {});
  }
};

/* =====================================================================
   INITIALIZATION & STORAGE PERSISTENCE
   ===================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  window.loadStateFromStorage();
  window.applyUiZoom(window.appState.uiZoom || 1.0);
  window.startClocks();
  window.setupHeaderTelemetry();
  window.buildMeterSegments();
  window.updateRigControlAvailability();
  window.syncStickyHeaderOffset();
  window.connectBridgeWebSocket();

  window.addEventListener('resize', window.syncStickyHeaderOffset);
  document.addEventListener('fullscreenchange', () => {
    window.updateFullscreenButton();
    window.syncStickyHeaderOffset();
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#presetBtn') && !e.target.closest('#presetDropdown')) {
      const d = document.getElementById('presetDropdown');
      if (d) d.classList.add('hidden');
    }
    if (!e.target.closest('#vfoBandBtn') && !e.target.closest('#bandDropdown')) {
      const d = document.getElementById('bandDropdown');
      if (d) d.classList.add('hidden');
    }
    if (!e.target.closest('#vfoModeBtn') && !e.target.closest('#modeDropdown')) {
      const d = document.getElementById('modeDropdown');
      if (d) d.classList.add('hidden');
    }
  });
});

window.saveStateToStorage = function() {
  try {
    const stateToSave = {
      profile: window.appState.profile,
      bandFrequencies: window.appState.bandFrequencies || {},
      solar: window.appState.solar,
      panes: window.appState.panes,
      qsos: window.appState.qsos,
      scratchpadText: window.appState.scratchpadText,
      nightMode: window.appState.nightMode,
      uiZoom: window.appState.uiZoom || 1.0,
      radioSoftware: window.appState.radioSoftware,
      radioPort: window.appState.radioPort
    };
    localStorage.setItem('EZSHACK_STATE_V1', JSON.stringify(stateToSave));
  } catch (e) {
    console.error('Storage save error:', e);
  }
};

window.loadStateFromStorage = function() {
  const saved = localStorage.getItem('EZSHACK_STATE_V1') || localStorage.getItem('RIGDECK_V2_STATE');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      window.appState = {
        ...window.appState,
        ...parsed,
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        bandFrequencies: { ...(parsed.bandFrequencies || {}) }
      };
      window.appState.vfo.frequency = null;
      window.appState.vfo.vfoA.frequency = null;
      window.appState.vfo.vfoB.frequency = null;
    } catch (e) {
      console.warn('Could not parse saved state. Loading default preset.', e);
      if (typeof window.loadDefaultPreset === 'function') window.loadDefaultPreset();
    }
  } else {
    if (typeof window.loadDefaultPreset === 'function') window.loadDefaultPreset();
    setTimeout(() => {
      window.openSettingsModal('profile');
      window.showToast('Welcome to EZShack! Please configure your callsign and grid.');
    }, 400);
  }

  if (window.appState.nightMode) {
    document.body.classList.add('night-mode');
  }

  if (window.appState.profile.callsign && window.appState.profile.callsign !== 'N0CALL') {
    window.runLicenseLookup(false);
  }
};

/* =====================================================================
   FCC PART 97 BAND PRIVILEGE ENGINE
   ===================================================================== */
window.checkBandPrivilege = function(freqHz, mode, licClass) {
  if (!freqHz || !licClass || licClass === 'UNRESTRICTED') return { status: 'OK' };
  const mhz = freqHz / 1000000.0;
  const m = (mode || '').toUpperCase();

  let allowedRanges = [];

  if (mhz >= 1.8 && mhz <= 2.0) {
    if (licClass === 'EXTRA' || licClass === 'GENERAL') allowedRanges.push({ min: 1800000, max: 2000000 });
  } else if (mhz >= 3.5 && mhz <= 4.0) {
    if (licClass === 'EXTRA') allowedRanges.push({ min: 3500000, max: 4000000 });
    else if (licClass === 'GENERAL') {
      allowedRanges.push({ min: 3525000, max: 3600000 });
      allowedRanges.push({ min: 3800000, max: 4000000 });
    } else if (licClass === 'TECHNICIAN' || licClass === 'NOVICE') {
      allowedRanges.push({ min: 3525000, max: 3600000 });
    }
  } else if (mhz >= 5.33 && mhz <= 5.41) {
    if (licClass === 'EXTRA' || licClass === 'GENERAL') allowedRanges.push({ min: 5330000, max: 5410000 });
  } else if (mhz >= 7.0 && mhz <= 7.3) {
    if (licClass === 'EXTRA') allowedRanges.push({ min: 7000000, max: 7300000 });
    else if (licClass === 'GENERAL') {
      allowedRanges.push({ min: 7025000, max: 7125000 });
      allowedRanges.push({ min: 7175000, max: 7300000 });
    } else if (licClass === 'TECHNICIAN' || licClass === 'NOVICE') {
      allowedRanges.push({ min: 7025000, max: 7125000 });
    }
  } else if (mhz >= 10.1 && mhz <= 10.15) {
    if (licClass === 'EXTRA' || licClass === 'GENERAL') allowedRanges.push({ min: 10100000, max: 10150000 });
  } else if (mhz >= 14.0 && mhz <= 14.35) {
    if (licClass === 'EXTRA') allowedRanges.push({ min: 14000000, max: 14350000 });
    else if (licClass === 'GENERAL') {
      allowedRanges.push({ min: 14025000, max: 14150000 });
      allowedRanges.push({ min: 14225000, max: 14350000 });
    }
  } else if (mhz >= 18.068 && mhz <= 18.168) {
    if (licClass === 'EXTRA' || licClass === 'GENERAL') allowedRanges.push({ min: 18068000, max: 18168000 });
  } else if (mhz >= 21.0 && mhz <= 21.45) {
    if (licClass === 'EXTRA') allowedRanges.push({ min: 21000000, max: 21450000 });
    else if (licClass === 'GENERAL') {
      allowedRanges.push({ min: 21025000, max: 21200000 });
      allowedRanges.push({ min: 21275000, max: 21450000 });
    } else if (licClass === 'TECHNICIAN' || licClass === 'NOVICE') {
      allowedRanges.push({ min: 21025000, max: 21200000 });
    }
  } else if (mhz >= 24.89 && mhz <= 24.99) {
    if (licClass === 'EXTRA' || licClass === 'GENERAL') allowedRanges.push({ min: 24890000, max: 24990000 });
  } else if (mhz >= 28.0 && mhz <= 29.7) {
    if (licClass === 'EXTRA' || licClass === 'GENERAL') allowedRanges.push({ min: 28000000, max: 29700000 });
    else if (licClass === 'TECHNICIAN' || licClass === 'NOVICE') {
      allowedRanges.push({ min: 28000000, max: 28500000 });
    }
  } else if ((mhz >= 50.0 && mhz <= 54.0) || (mhz >= 144.0 && mhz <= 148.0) || (mhz >= 420.0 && mhz <= 450.0)) {
    allowedRanges.push({ min: 50000000, max: 54000000 });
    allowedRanges.push({ min: 144000000, max: 148000000 });
    allowedRanges.push({ min: 420000000, max: 450000000 });
  }

  const matched = allowedRanges.find(r => freqHz >= r.min && freqHz <= r.max);
  if (!matched) {
    return { status: 'OOB', reason: 'Carrier outside authorized band privileges' };
  }

  let bwLow = freqHz;
  let bwHigh = freqHz;
  const voiceBw = 2500;

  if (m === 'USB' || m === 'DATA-U') {
    bwLow = freqHz;
    bwHigh = freqHz + voiceBw;
  } else if (m === 'LSB') {
    bwLow = freqHz - voiceBw;
    bwHigh = freqHz;
  } else if (m === 'AM') {
    bwLow = freqHz - 3000;
    bwHigh = freqHz + 3000;
  } else if (m === 'FM' || m === 'C4FM') {
    bwLow = freqHz - 6000;
    bwHigh = freqHz + 6000;
  } else if (m === 'CW') {
    bwLow = freqHz - 250;
    bwHigh = freqHz + 250;
  }

  if (bwHigh > matched.max || bwLow < matched.min) {
    return { status: 'WARN', reason: 'Audio bandwidth spillover beyond authorized edge' };
  }

  return { status: 'OK' };
};

/* =====================================================================
   EXPANDED LICENSE, MAIDENHEAD GRID & ZONE AUTO-DISCOVERY
   ===================================================================== */
function parseCityStateFromAddress(addrObj) {
  if (!addrObj) return { city: '', state: '' };
  const line2 = (addrObj.line2 || '').trim();
  // Callook line2 format: "WATERTOWN, NY 13601"
  const m = line2.match(/^([^,]+),\s*([A-Z]{2})\b/i);
  if (m) {
    return { city: m[1].trim(), state: m[2].trim().toUpperCase() };
  }
  return { city: '', state: '' };
}

window.runLicenseLookup = async function(notify = true) {
  const callInput = document.getElementById('cfgCallsign');
  const call = (callInput ? callInput.value : window.appState.profile.callsign || '').trim().toUpperCase();
  if (!call || call === 'N0CALL') {
    if (notify) window.showToast('Enter a valid call sign first.');
    return;
  }

  if (notify) window.showToast(`Looking up ${call}...`);

  let mappedClass = window.appState.profile.licenseClass || 'TECHNICIAN';
  let foundGrid = '';
  let foundCity = '';
  let foundState = '';
  let foundCountry = '';
  let foundLat = NaN;
  let foundLon = NaN;
  let foundCqz = '';
  let foundItuz = '';
  let foundAny = false;

  // 1. Primary FCC / North America lookup via Callook
  try {
    const resp = await fetch(`https://callook.info/${encodeURIComponent(call)}/json`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 'VALID') {
        foundAny = true;
        if (data.current?.operClass) {
          const cls = data.current.operClass.toUpperCase();
          if (cls.includes('EXTRA')) mappedClass = 'EXTRA';
          else if (cls.includes('GENERAL')) mappedClass = 'GENERAL';
          else if (cls.includes('ADVANCED')) mappedClass = 'GENERAL';
          else if (cls.includes('NOVICE')) mappedClass = 'NOVICE';
          else mappedClass = 'TECHNICIAN';
        }

        if (data.location?.gridsquare) {
          foundGrid = data.location.gridsquare.trim();
        }
        if (data.location?.latitude !== undefined && data.location?.longitude !== undefined) {
          const parsedLat = parseFloat(data.location.latitude);
          const parsedLon = parseFloat(data.location.longitude);
          if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
            foundLat = parsedLat;
            foundLon = parsedLon;
          }
        }
        const parsedAddr = parseCityStateFromAddress(data.address);
        foundCity = parsedAddr.city;
        foundState = parsedAddr.state;
        foundCountry = 'USA';
      }
    }
  } catch (e) {
    // Fall through to HamDB fallback
  }

  // 2. Fallback / Supplement via HamDB (adds international callsigns, QTH, and DXCC)
  if (!foundAny || !foundGrid || !foundCity) {
    try {
      const hResp = await fetch(`https://api.hamdb.org/v1/${encodeURIComponent(call)}/json/ezshack`);
      if (hResp.ok) {
        const hData = await hResp.json();
        const rec = hData?.hamdb?.callsign;
        if (rec && rec.call && rec.call !== 'NOT_FOUND') {
          foundAny = true;
          if (!foundAny && rec.class) {
            const c = rec.class.toUpperCase();
            if (c.includes('E')) mappedClass = 'EXTRA';
            else if (c.includes('G')) mappedClass = 'GENERAL';
            else if (c.includes('N')) mappedClass = 'NOVICE';
          }
          if (!foundGrid && rec.grid) foundGrid = rec.grid.trim();
          if (!foundCity && rec.addr2) foundCity = rec.addr2.trim();
          if (!foundState && rec.state) foundState = rec.state.trim().toUpperCase();
          if (!foundCountry && rec.country) foundCountry = rec.country.trim().toUpperCase();
          if (isNaN(foundLat) && rec.lat) foundLat = parseFloat(rec.lat);
          if (isNaN(foundLon) && rec.lon) foundLon = parseFloat(rec.lon);
        }
      }
    } catch (e) {}
  }

  if (!foundAny) {
    if (notify) window.showToast(`No license record found for ${call} (or lookup offline).`);
    return;
  }

  // Compute Maidenhead grid from Lat/Lon if needed, or Lat/Lon from Maidenhead grid
  if (!foundGrid && !isNaN(foundLat) && !isNaN(foundLon) && typeof window.latLonToMaidenhead === 'function') {
    foundGrid = window.latLonToMaidenhead(foundLat, foundLon) || '';
  }
  if (foundGrid && (isNaN(foundLat) || isNaN(foundLon)) && typeof window.maidenheadToLatLon === 'function') {
    const coords = window.maidenheadToLatLon(foundGrid);
    if (coords) {
      foundLat = coords.lat;
      foundLon = coords.lon;
    }
  }

  // Estimate CQ Zone and ITU Zone from state / coordinates
  if (typeof window.estimateZonesFromLocation === 'function') {
    const zones = window.estimateZonesFromLocation({
      state: foundState,
      country: foundCountry,
      lat: foundLat,
      lon: foundLon
    });
    foundCqz = zones.cqz || '';
    foundItuz = zones.ituz || '';
  }

  // Apply values to appState.profile and populate all Settings modal inputs
  window.appState.profile.callsign = call;
  window.appState.profile.licenseClass = mappedClass;
  if (foundGrid) window.appState.profile.grid = foundGrid;
  if (foundCity) window.appState.profile.city = foundCity;
  if (foundState) window.appState.profile.state = foundState;
  if (foundCountry) window.appState.profile.country = foundCountry;
  if (foundCqz) window.appState.profile.cqz = foundCqz;
  if (foundItuz) window.appState.profile.ituz = foundItuz;
  if (!isNaN(foundLat)) window.appState.profile.lat = Math.round(foundLat * 10000) / 10000;
  if (!isNaN(foundLon)) window.appState.profile.lon = Math.round(foundLon * 10000) / 10000;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== '' && val !== undefined && val !== null) el.value = val;
  };
  setVal('cfgClass', mappedClass);
  setVal('cfgGrid', foundGrid);
  setVal('cfgCity', foundCity);
  setVal('cfgState', foundState);
  setVal('cfgCountry', foundCountry);
  setVal('cfgCqz', foundCqz);
  setVal('cfgItuz', foundItuz);
  if (!isNaN(foundLat)) setVal('cfgLat', window.appState.profile.lat.toFixed(4));
  if (!isNaN(foundLon)) setVal('cfgLon', window.appState.profile.lon.toFixed(4));

  window.setupHeaderTelemetry();
  window.saveStateToStorage();

  if (notify) {
    const summary = [
      `${call} (${mappedClass})`,
      foundGrid ? `Grid ${foundGrid}` : '',
      (foundCity || foundState) ? `${foundCity}${foundCity && foundState ? ', ' : ''}${foundState}` : '',
      (foundCqz || foundItuz) ? `CQ ${foundCqz || '-'} / ITU ${foundItuz || '-'}` : ''
    ].filter(Boolean).join(' • ');
    window.showToast(`Verified: ${summary}`);
  }
};

/* =====================================================================
   S-METER SEGMENT BUILDER & DISPLAY ENGINE
   ===================================================================== */
window.buildMeterSegments = function() {
  const container = document.getElementById('smeterSegments');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= 15; i++) {
    const seg = document.createElement('div');
    seg.id = `led-seg-${i}`;
    seg.className = 'w-[5px] h-full rounded-[1px] bg-slate-800 transition-colors duration-75';
    container.appendChild(seg);
  }
};

window.updateMeterDisplay = function(data) {
  const isPtt = Boolean(data.ptt);
  const modeLabel = document.getElementById('meterModeLabel');
  const valLabel = document.getElementById('meterValueLabel');
  const fwdPwr = document.getElementById('fwdPwrVal');
  const swr = document.getElementById('swrVal');

  if (fwdPwr) fwdPwr.innerText = `${(data.pwr_out || 0).toFixed(1)} W`;
  if (swr) swr.innerText = (data.swr || 1.0).toFixed(2);

  let activeSegments = 0;

  if (isPtt) {
    if (modeLabel) {
      modeLabel.innerText = "TX PWR";
      modeLabel.className = "text-[10px] font-bold text-amber-400 w-12 2xl:w-14";
    }
    const watts = data.pwr_out || 0;
    if (valLabel) {
      valLabel.innerText = `${Math.round(watts)}W`;
      valLabel.title = `Forward Power: ${watts.toFixed(1)}W`;
    }
    activeSegments = Math.min(15, Math.max(0, Math.round((watts / 100) * 15)));
  } else {
    if (modeLabel) {
      modeLabel.innerText = "RX S-MTR";
      modeLabel.className = "text-[10px] font-bold text-cyan-400 w-12 2xl:w-14";
    }
    const active = window.resolveActiveMeterProfile();
    const meterResult = active.profile.calculate(data.smeter_val);
    activeSegments = meterResult.segments;
    if (valLabel) {
      valLabel.innerText = meterResult.label;
      const rigStr = data.xcvr || 'Radio';
      const autoTag = active.isAuto ? `Auto (${rigStr})` : `Manual (${active.profile.name})`;
      valLabel.title = `Profile: ${autoTag} | Raw: ${(data.smeter_val || 0).toFixed(1)}`;
    }
  }

  for (let i = 1; i <= 15; i++) {
    const seg = document.getElementById(`led-seg-${i}`);
    if (!seg) continue;
    if (i <= activeSegments) {
      if (i <= 9) {
        seg.className = isPtt 
          ? 'w-[5px] h-full rounded-[1px] bg-amber-400 shadow-[0_0_4px_#f59e0b]' 
          : 'w-[5px] h-full rounded-[1px] bg-cyan-400 shadow-[0_0_4px_#00f0ff]';
      } else {
        seg.className = 'w-[5px] h-full rounded-[1px] bg-red-500 shadow-[0_0_4px_#ef4444]';
      }
    } else {
      seg.className = 'w-[5px] h-full rounded-[1px] bg-slate-800';
    }
  }

  const now = Date.now();
  if (window.isRigCapabilitySupported('rf_power') && data.power_target !== undefined && now > pwrLockUntil) {
    const pSlider = document.getElementById('txPwrSlider');
    const pDisp = document.getElementById('txPwrDisplay');
    if (pSlider) pSlider.value = data.power_target;
    if (pDisp) pDisp.innerText = `${data.power_target}W`;
    window.appState.telemetry.powerTarget = data.power_target;
  }

  if (window.isRigCapabilitySupported('af_gain') && data.volume_target !== undefined && now > volLockUntil) {
    const vSlider = document.getElementById('afVolSlider') || document.getElementById('rigVolumeSlider');
    const vDisp = document.getElementById('afVolDisplay') || document.getElementById('rigVolumeLabel') || document.getElementById('rigVolumeDisplay');
    if (vSlider) vSlider.value = data.volume_target;
    if (vDisp) vDisp.innerText = `${data.volume_target}%`;
    window.appState.telemetry.volumeTarget = data.volume_target;
  }
};

window.onTxPowerChange = function(val) {
  if (!window.isRigCapabilitySupported('rf_power')) return;
  const pwr = parseInt(val, 10);
  pwrLockUntil = Date.now() + 2000;
  const pDisp = document.getElementById('txPwrDisplay');
  if (pDisp) pDisp.innerText = `${pwr}W`;
  window.appState.telemetry.powerTarget = pwr;
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_power", power: pwr }));
  }
};

window.setQuickPower = function(val) {
  if (!window.isRigCapabilitySupported('rf_power')) return;
  const pSlider = document.getElementById('txPwrSlider');
  if (pSlider) pSlider.value = val;
  window.onTxPowerChange(val);
  window.showToast(`TX Target: ${val} Watts`);
};

window.onAfVolumeChange = function(val) {
  if (!window.isRigCapabilitySupported('af_gain')) return;
  const vol = parseInt(val, 10);
  volLockUntil = Date.now() + 2000;
  const vDisp = document.getElementById('afVolDisplay') || document.getElementById('rigVolumeLabel') || document.getElementById('rigVolumeDisplay');
  if (vDisp) vDisp.innerText = `${vol}%`;
  window.appState.telemetry.volumeTarget = vol;
  window.appState.telemetry.isMuted = (vol === 0);
  window.updateMuteIcon();
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_volume", volume: vol }));
  }
};

window.onVolumeSliderInput = window.onAfVolumeChange;
window.onVolumeSliderCommit = window.onAfVolumeChange;

window.toggleMute = function() {
  if (!window.isRigCapabilitySupported('af_gain')) return;
  const vSlider = document.getElementById('afVolSlider');
  if (window.appState.telemetry.isMuted) {
    const restoreVol = window.appState.telemetry.preMuteVol || 50;
    if (vSlider) vSlider.value = restoreVol;
    window.onAfVolumeChange(restoreVol);
  } else {
    window.appState.telemetry.preMuteVol = window.appState.telemetry.volumeTarget || 50;
    if (vSlider) vSlider.value = 0;
    window.onAfVolumeChange(0);
  }
};

window.updateMuteIcon = function() {
  const btn = document.getElementById('btnMute');
  if (btn) {
    btn.innerText = window.appState.telemetry.isMuted ? '🔇' : '🔊';
  }
};

/* =====================================================================
   WEBSOCKET CAT INTEGRATION
   ===================================================================== */
window.connectBridgeWebSocket = function() {
  if (isShuttingDown) return;
  const wsUrl = `ws://127.0.0.1:${window.appState.radioPort || 8088}`;
  let searchStartedAt = Date.now();
  let searchToastShown = false;

  try {
    window.bridgeSocket = new WebSocket(wsUrl);

    window.bridgeSocket.onopen = () => {
      searchStartedAt = Date.now();
      searchToastShown = false;
      window.appState.telemetry.rigSearching = true;
      window.updateVfoDisplay();
      window.updateRigLinkStatus(false, "SCANNING...", true);
    };

    window.bridgeSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.connected) {
          window.appState.telemetry.rigSearching = false;
          searchToastShown = false;

          if (data.xcvr) {
            window.appState.telemetry.xcvr = data.xcvr;
          }
          if (data.rig_id !== undefined) {
            window.appState.telemetry.rigId = data.rig_id;
          }
          if (data.capabilities) {
            window.appState.telemetry.capabilities = data.capabilities;
          }
          if (Array.isArray(data.supported_bands)) {
            window.appState.telemetry.supported_bands = data.supported_bands;
          }
          if (data.tuner_enabled !== undefined) {
            window.appState.telemetry.tunerEnabled = Boolean(data.tuner_enabled);
          }
          if (data.tuner_tuning !== undefined) {
            window.appState.telemetry.tunerTuning = Boolean(data.tuner_tuning);
          }

          window.updateRigControlAvailability();

          if (Date.now() > tuneLockUntil) {
            const bandName = data.band || window.calculateBand(data.frequency);
            window.appState.vfo.frequency = data.frequency;
            window.appState.vfo.mode = data.mode || window.appState.vfo.mode;
            window.appState.vfo.band = bandName;
            window.appState.vfo.isSimulated = false;

            const currentSlot = (window.appState.vfo.active || 'A') === 'A' ? 'vfoA' : 'vfoB';
            window.appState.vfo[currentSlot] = {
              frequency: data.frequency,
              mode: window.appState.vfo.mode,
              band: bandName
            };

            window.recordBandFrequency(bandName, data.frequency);
            window.applySubBandAutoMode(data.frequency, false);
            window.updateVfoDisplay();
          }

          window.updateMeterDisplay(data);
          window.updateRigLinkStatus(true, "RADIO LIVE");

          // Dispatch Sub-Receiver Telemetry to Widgets and Event Bus
          if (data.sub_rx !== undefined) {
            window.appState.telemetry.subRx = data.sub_rx;
            if (window.subReceiverWidget && typeof window.subReceiverWidget.update === 'function') {
              window.subReceiverWidget.update(data);
            }
            window.dispatchEvent(new CustomEvent('ezshack:subrx', { detail: data }));
          }
        } else {
          window.appState.telemetry.rigSearching = true;
          if (!window.appState.vfo.frequency) {
            window.updateVfoDisplay();
          }
          window.updateRigLinkStatus(false, "SCANNING...", true);
          if (!searchToastShown && Date.now() - searchStartedAt > 6000) {
            searchToastShown = true;
            window.showToast("Still scanning USB ports for an active transceiver...");
          }
        }
      } catch (e) {
        console.error("[EZShack] Telemetry parse error:", e);
      }
    };

    window.bridgeSocket.onclose = () => {
      if (!isShuttingDown) {
        window.appState.telemetry.rigSearching = false;
        window.updateVfoDisplay();
        window.updateRigLinkStatus(false, "WS OFFLINE");
        setTimeout(window.connectBridgeWebSocket, 2000);
      }
    };

    window.bridgeSocket.onerror = () => {
      if (!isShuttingDown) {
        window.appState.telemetry.rigSearching = false;
        window.updateVfoDisplay();
        window.updateRigLinkStatus(false, "WS ERROR");
      }
    };
  } catch (err) {
    if (!isShuttingDown) {
      window.appState.telemetry.rigSearching = false;
      window.updateVfoDisplay();
      window.updateRigLinkStatus(false, "WS OFFLINE");
      setTimeout(window.connectBridgeWebSocket, 3000);
    }
  }
};

window.updateRigLinkStatus = function(online, label, scanning = false) {
  const ind = document.getElementById('rigStatusIndicator');
  const txt = document.getElementById('rigStatusText');
  if (!ind || !txt) return;

  if (online) {
    ind.className = 'w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]';
    txt.className = 'text-[10px] 2xl:text-[11px] font-mono text-emerald-400 font-bold';
  } else if (scanning) {
    ind.className = 'w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse';
    txt.className = 'text-[10px] 2xl:text-[11px] font-mono text-amber-400 font-bold';
  } else {
    ind.className = 'w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]';
    txt.className = 'text-[10px] 2xl:text-[11px] font-mono text-red-400 font-bold';
  }
  txt.innerText = label;
};

window.calculateBand = function(freqHz) {
  const mhz = freqHz / 1000000.0;
  if (mhz >= 1.8 && mhz <= 2.0) return "160m";
  if (mhz >= 3.5 && mhz <= 4.0) return "80m";
  if (mhz >= 5.33 && mhz <= 5.41) return "60m";
  if (mhz >= 7.0 && mhz <= 7.3) return "40m";
  if (mhz >= 10.1 && mhz <= 10.15) return "30m";
  if (mhz >= 14.0 && mhz <= 14.35) return "20m";
  if (mhz >= 18.068 && mhz <= 18.168) return "17m";
  if (mhz >= 21.0 && mhz <= 21.45) return "15m";
  if (mhz >= 24.89 && mhz <= 24.99) return "12m";
  if (mhz >= 28.0 && mhz <= 29.7) return "10m";
  if (mhz >= 50.0 && mhz <= 54.0) return "6m";
  if (mhz >= 144.0 && mhz <= 148.0) return "2m";
  if (mhz >= 420.0 && mhz <= 450.0) return "70cm";
  return "--m";
};

window.recordBandFrequency = function(bandName, freqHz) {
  if (!bandName || bandName === '--m' || !freqHz || freqHz <= 0) return;
  if (!window.appState.bandFrequencies) {
    window.appState.bandFrequencies = {};
  }
  window.appState.bandFrequencies[bandName] = freqHz;
};

/* =====================================================================
   AUTOMATIC SUB-BAND SEGMENT & ONE-TIME MODE SWITCHING
   ===================================================================== */
window.getSubBandSegment = function(freqHz) {
  const f = parseInt(freqHz, 10);
  if (!f || isNaN(f)) return null;
  const band = window.calculateBand(f);
  if (band === '--m') return { key: `OOB:${Math.floor(f / 1000000)}`, band: '--m', mode: null };

  let mode = null;

  if (band === '160m') {
    if (f < 1840000) mode = 'CW';
    else if (f <= 1843000) mode = 'DATA-U';
    else mode = 'LSB';
  } else if (band === '80m') {
    if (f < 3570000) mode = 'CW';
    else if (f <= 3600000) mode = 'DATA-U';
    else mode = 'LSB';
  } else if (band === '60m') {
    if (f >= 5356000 && f <= 5359000) mode = 'DATA-U';
    else mode = 'USB';
  } else if (band === '40m') {
    if (f < 7045000) mode = 'CW';
    else if (f <= 7125000) mode = 'DATA-U';
    else mode = 'LSB';
  } else if (band === '30m') {
    if (f < 10130000) mode = 'CW';
    else mode = 'DATA-U';
  } else if (band === '20m') {
    if (f < 14070000) mode = 'CW';
    else if (f <= 14150000) mode = 'DATA-U';
    else mode = 'USB';
  } else if (band === '17m') {
    if (f < 18095000) mode = 'CW';
    else if (f <= 18110000) mode = 'DATA-U';
    else mode = 'USB';
  } else if (band === '15m') {
    if (f < 21070000) mode = 'CW';
    else if (f <= 21150000) mode = 'DATA-U';
    else mode = 'USB';
  } else if (band === '12m') {
    if (f < 24910000) mode = 'CW';
    else if (f <= 24930000) mode = 'DATA-U';
    else mode = 'USB';
  } else if (band === '10m') {
    if (f < 28070000) mode = 'CW';
    else if (f <= 28300000) mode = 'DATA-U';
    else if (f < 29000000) mode = 'USB';
    else mode = 'FM';
  } else if (band === '6m') {
    if (f < 50100000) mode = 'CW';
    else if (f < 50300000) mode = 'USB';
    else if (f <= 50400000) mode = 'DATA-U';
    else if (f < 52000000) mode = 'USB';
    else mode = 'FM';
  } else if (band === '2m') {
    if (f < 144170000) mode = 'CW';
    else if (f <= 144185000) mode = 'DATA-U';
    else if (f < 144300000) mode = 'USB';
    else mode = 'FM';
  } else if (band === '70cm') {
    if (f < 432060000) mode = 'CW';
    else if (f <= 432075000) mode = 'DATA-U';
    else if (f < 432300000) mode = 'USB';
    else mode = 'FM';
  }

  return { key: `${band}:${mode || 'NONE'}`, band, mode };
};

window.applySubBandAutoMode = function(freqHz, allowSwitch = true) {
  const seg = window.getSubBandSegment(freqHz);
  if (!seg) return null;

  // On initial radio connect, seed the current segment without overriding the rig's active mode
  if (lastAutoSegmentKey === null) {
    lastAutoSegmentKey = seg.key;
    return null;
  }

  // Only fire once when crossing a sub-band segment boundary
  if (seg.key === lastAutoSegmentKey) {
    return null;
  }

  lastAutoSegmentKey = seg.key;
  if (!allowSwitch || !seg.mode) return null;

  if ((window.appState.vfo.mode || '').toUpperCase() === seg.mode) {
    return null;
  }

  window.appState.vfo.mode = seg.mode;
  const activeSlot = (window.appState.vfo.active || 'A') === 'A' ? 'vfoA' : 'vfoB';
  window.appState.vfo[activeSlot].mode = seg.mode;

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_mode", mode: seg.mode }));
  }
  return seg.mode;
};

window.sendFreqToBridge = function(freqHz) {
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_freq", freq: freqHz }));
  }
};

/* =====================================================================
   SUB-RECEIVER DISPATCH ACTIONS (Kenwood TS-2000 VHF/UHF)
   ===================================================================== */
window.setSubFrequency = function(freqHz) {
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_sub_freq", freq: freqHz }));
  }
};

window.setSubPower = function(enabled) {
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_sub_power", enabled: Boolean(enabled) }));
  }
};

window.setSubVolume = function(vol) {
  const v = Math.max(0, Math.min(100, parseInt(vol, 10)));
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_sub_volume", volume: v }));
  }
};

window.setSubMute = function(muted) {
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_sub_mute", muted: Boolean(muted) }));
  }
};

/* =====================================================================
   CLEAN POWER-DOWN SEQUENCING (Shuts down Daemon & Closes Tab)
   ===================================================================== */
window.openPowerModal = function() {
  document.getElementById('powerModal')?.classList.remove('hidden');
};

window.executeStationShutdown = function() {
  window.closeModal('powerModal');
  isShuttingDown = true;
  window.saveStateToStorage();

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "shutdown" }));
  }

  document.getElementById('haltedOverlay')?.classList.remove('hidden');

  setTimeout(() => {
    try {
      if (window.bridgeSocket) window.bridgeSocket.close();
    } catch (e) {}
    window.close();
    // Secondary fallback for browsers requiring self-target handle
    try {
      window.open('', '_self');
      window.close();
    } catch (e) {}
  }, 350);
};

/* =====================================================================
   VFO A/B & DECADE TUNING
   ===================================================================== */
window.setVfo = function(vfoId) {
  if (window.appState.vfo.active === vfoId) return;

  const oldActive = window.appState.vfo.active || 'A';
  const oldSlot = oldActive === 'A' ? 'vfoA' : 'vfoB';
  window.appState.vfo[oldSlot] = {
    frequency: window.appState.vfo.frequency,
    mode: window.appState.vfo.mode,
    band: window.appState.vfo.band
  };

  window.appState.vfo.active = vfoId;
  const newSlot = vfoId === 'A' ? 'vfoA' : 'vfoB';
  const target = window.appState.vfo[newSlot] || (vfoId === 'A' ? { frequency: 14074000, mode: 'USB', band: '20m' } : { frequency: 7074000, mode: 'LSB', band: '40m' });

  window.appState.vfo.frequency = target.frequency;
  window.appState.vfo.mode = target.mode;
  window.appState.vfo.band = target.band || window.calculateBand(target.frequency || 14074000);

  if (target.frequency) {
    const seg = window.getSubBandSegment(target.frequency);
    if (seg) lastAutoSegmentKey = seg.key;
  }

  window.updateVfoDisplay();
  window.saveStateToStorage();

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_vfo", vfo: vfoId }));
    if (window.appState.vfo.frequency) window.sendFreqToBridge(window.appState.vfo.frequency);
  }

  window.showToast(`Switched to VFO ${vfoId}`);
};

window.updateVfoButtons = function() {
  const btnA = document.getElementById('btnVfoA');
  const btnB = document.getElementById('btnVfoB');
  if (!btnA || !btnB) return;
  const isA = (window.appState.vfo.active || 'A') === 'A';
  if (isA) {
    btnA.className = "px-1.5 2xl:px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 shadow-sm transition font-bold";
    btnB.className = "px-1.5 2xl:px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 transition border border-transparent font-normal";
  } else {
    btnB.className = "px-1.5 2xl:px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 shadow-sm transition font-bold";
    btnA.className = "px-1.5 2xl:px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 transition border border-transparent font-normal";
  }
};

window.formatWeightLabel = function(w) {
  if (w >= 1000000) return `${w / 1000000} MHz`;
  if (w >= 1000) return `${w / 1000} kHz`;
  return `${w} Hz`;
};

window.tuneDigit = function(weight, direction) {
  if (!window.appState.vfo.frequency) return;
  const delta = weight * direction;
  let newFreq = Math.max(100000, Math.min(450000000, window.appState.vfo.frequency + delta));
  const bandName = window.calculateBand(newFreq);

  window.appState.vfo.frequency = newFreq;
  window.appState.vfo.band = bandName;

  const activeSlot = (window.appState.vfo.active || 'A') === 'A' ? 'vfoA' : 'vfoB';
  window.appState.vfo[activeSlot].frequency = newFreq;
  window.appState.vfo[activeSlot].band = bandName;

  window.recordBandFrequency(bandName, newFreq);
  const autoSwitchedMode = window.applySubBandAutoMode(newFreq, true);

  tuneLockUntil = Date.now() + 800;

  window.updateVfoDisplay();
  window.saveStateToStorage();
  window.sendFreqToBridge(newFreq);

  if (autoSwitchedMode) {
    window.showToast(`Auto Mode: ${autoSwitchedMode} (${bandName})`);
  }
};

window.handleDigitWheel = function(event, weight) {
  event.preventDefault();
  event.stopPropagation();
  const direction = event.deltaY < 0 ? 1 : -1;
  window.tuneDigit(weight, direction);
};

window.buildDigitColumn = function(char, weight, colorClass) {
  return `
    <div class="relative group inline-flex flex-col items-center justify-center w-5 sm:w-6 h-9 sm:h-10 mx-[0.5px] rounded border border-transparent hover:border-cyan-500/40 hover:bg-cyan-950/40 select-none transition-colors" onwheel="window.handleDigitWheel(event, ${weight})">
      <div onclick="window.tuneDigit(${weight}, 1)" title="Step +${window.formatWeightLabel(weight)}" class="absolute top-0 inset-x-0 h-1/2 cursor-pointer z-10 hover:bg-cyan-400/25 rounded-t flex items-start justify-center">
        <span class="opacity-0 group-hover:opacity-100 text-[8px] text-cyan-300 font-sans -mt-0.5 leading-none transition-opacity">▲</span>
      </div>
      <span class="font-lcd text-xl sm:text-2xl font-bold ${colorClass} pointer-events-none">${char}</span>
      <div onclick="window.tuneDigit(${weight}, -1)" title="Step -${window.formatWeightLabel(weight)}" class="absolute bottom-0 inset-x-0 h-1/2 cursor-pointer z-10 hover:bg-cyan-400/25 rounded-b flex items-end justify-center">
        <span class="opacity-0 group-hover:opacity-100 text-[8px] text-cyan-300 font-sans -mb-0.5 leading-none transition-opacity">▼</span>
      </div>
    </div>
  `;
};

window.renderVfoDigits = function(freqHz) {
  if (!freqHz) {
    if (window.appState.telemetry.rigSearching) {
      return `<span class="font-lcd text-base sm:text-lg font-bold text-amber-400 tracking-wider animate-pulse px-2">SCANNING USB...</span>`;
    }
    return `<span class="font-lcd text-xl sm:text-2xl font-bold text-slate-600">---.---.---</span>`;
  }

  const privilege = window.checkBandPrivilege(freqHz, window.appState.vfo.mode, window.appState.profile.licenseClass);
  let colorClass = 'text-cyan-400 lcd-text';
  if (privilege.status === 'OOB') {
    colorClass = 'text-red-500 lcd-red';
  } else if (privilege.status === 'WARN') {
    colorClass = 'text-yellow-400 lcd-yellow';
  }

  const f = Math.max(0, parseInt(freqHz, 10) || 0);
  const mhzVal = Math.floor(f / 1000000);
  const khzVal = Math.floor((f % 1000000) / 1000);
  const hzVal = f % 1000;

  const mhzStr = String(mhzVal).padStart(3, '0');
  const khzStr = String(khzVal).padStart(3, '0');
  const hzStr = String(hzVal).padStart(3, '0');

  let html = '';

  for (let i = 0; i < 3; i++) {
    const power = 3 - 1 - i;
    const weight = Math.pow(10, power + 6);
    html += window.buildDigitColumn(mhzStr[i], weight, colorClass);
  }

  html += `<span class="text-cyan-400/60 select-none mx-0.5 text-xl sm:text-2xl font-lcd font-bold pointer-events-none">.</span>`;

  const khzWeights = [100000, 10000, 1000];
  for (let i = 0; i < 3; i++) {
    html += window.buildDigitColumn(khzStr[i], khzWeights[i], colorClass);
  }

  html += `<span class="text-cyan-400/60 select-none mx-0.5 text-xl sm:text-2xl font-lcd font-bold pointer-events-none">.</span>`;

  const hzWeights = [100, 10, 1];
  for (let i = 0; i < 3; i++) {
    html += window.buildDigitColumn(hzStr[i], hzWeights[i], colorClass);
  }

  return html;
};

window.toggleBandDropdown = function(e) {
  e.stopPropagation();
  document.getElementById('modeDropdown')?.classList.add('hidden');
  document.getElementById('presetDropdown')?.classList.add('hidden');
  document.getElementById('bandDropdown')?.classList.toggle('hidden');
};

window.toggleModeDropdown = function(e) {
  e.stopPropagation();
  document.getElementById('bandDropdown')?.classList.add('hidden');
  document.getElementById('presetDropdown')?.classList.add('hidden');
  document.getElementById('modeDropdown')?.classList.toggle('hidden');
};

window.selectBand = function(bandName, defaultFreq) {
  const savedFreq = window.appState.bandFrequencies?.[bandName];
  const targetFreq = (savedFreq && savedFreq > 0) ? savedFreq : defaultFreq;
  const usedSaved = Boolean(savedFreq && savedFreq > 0);

  window.appState.vfo.band = bandName;
  if (targetFreq) {
    window.appState.vfo.frequency = targetFreq;
    window.recordBandFrequency(bandName, targetFreq);
  }
  const activeSlot = (window.appState.vfo.active || 'A') === 'A' ? 'vfoA' : 'vfoB';
  window.appState.vfo[activeSlot].band = bandName;
  window.appState.vfo[activeSlot].frequency = window.appState.vfo.frequency;

  const autoSwitchedMode = targetFreq ? window.applySubBandAutoMode(targetFreq, true) : null;

  tuneLockUntil = Date.now() + 800;

  window.updateVfoDisplay();
  window.saveStateToStorage();
  document.getElementById('bandDropdown')?.classList.add('hidden');
  if (window.appState.vfo.frequency) window.sendFreqToBridge(window.appState.vfo.frequency);

  const mhzLabel = (window.appState.vfo.frequency / 1000000).toFixed(3);
  const modeNote = autoSwitchedMode ? ` [${autoSwitchedMode}]` : '';
  const memNote = usedSaved ? ' (Last Used)' : '';
  window.showToast(`${bandName}: ${mhzLabel} MHz${modeNote}${memNote}`);
};

window.selectMode = function(modeName) {
  window.appState.vfo.mode = modeName;
  const activeSlot = (window.appState.vfo.active || 'A') === 'A' ? 'vfoA' : 'vfoB';
  window.appState.vfo[activeSlot].mode = modeName;

  tuneLockUntil = Date.now() + 800;

  window.updateVfoDisplay();
  window.saveStateToStorage();
  document.getElementById('modeDropdown')?.classList.add('hidden');

  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "set_mode", mode: modeName }));
  }
  window.showToast(`Switched Mode to ${modeName}`);
};

window.updateVfoDisplay = function() {
  const vfoElem = document.getElementById('vfoFrequency');
  if (vfoElem) {
    vfoElem.innerHTML = window.renderVfoDigits(window.appState.vfo.frequency);
  }
  const bandElem = document.getElementById('vfoBand');
  if (bandElem) bandElem.innerText = window.appState.vfo.band;
  const modeElem = document.getElementById('vfoMode');
  if (modeElem) modeElem.innerText = window.appState.vfo.mode;
  window.updateVfoButtons();
};

/* =====================================================================
   HEADER CLOCKS & TELEMETRY
   ===================================================================== */
window.startClocks = function() {
  function tick() {
    const now = new Date();
    const utcHours = String(now.getUTCHours()).padStart(2, '0');
    const utcMins = String(now.getUTCMinutes()).padStart(2, '0');
    const utcSecs = String(now.getUTCSeconds()).padStart(2, '0');
    const clk = document.getElementById('utcClock');
    if (clk) clk.innerText = `${utcHours}:${utcMins}:${utcSecs}`;

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const utcDateStr = `${now.getUTCDate()} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
    const dt = document.getElementById('utcDate');
    if (dt) dt.innerText = utcDateStr;

    const locHours = String(now.getHours()).padStart(2, '0');
    const locMins = String(now.getMinutes()).padStart(2, '0');
    const loc = document.getElementById('localClock');
    if (loc) loc.innerText = `LOC ${locHours}:${locMins}`;
  }
  tick();
  setInterval(tick, 1000);
};

window.setupHeaderTelemetry = function() {
  const callElem = document.getElementById('hdrCallsign');
  if (callElem) callElem.innerText = window.appState.profile.callsign || 'N0CALL';
  const gridElem = document.getElementById('hdrGrid');
  if (gridElem) gridElem.innerText = window.appState.profile.grid || 'AA00aa';
  const classBadge = document.getElementById('hdrClassBadge');
  if (classBadge) classBadge.innerText = (window.appState.profile.licenseClass || 'TECH').slice(0, 5);

  const sfiElem = document.getElementById('hdrSfi');
  if (sfiElem) sfiElem.innerText = window.appState.solar.sfi;
  const ssnElem = document.getElementById('hdrSsn');
  if (ssnElem) ssnElem.innerText = window.appState.solar.ssn;
  const aElem = document.getElementById('hdrAIndex');
  if (aElem) aElem.innerText = window.appState.solar.aIndex;

  const kVal = window.appState.solar.kIndex;
  const kBadge = document.getElementById('hdrKIndex');
  if (kBadge) {
    if (kVal <= 2) {
      kBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800';
      kBadge.innerText = `K${kVal} Quiet`;
    } else if (kVal <= 4) {
      kBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800';
      kBadge.innerText = `K${kVal} Unsettled`;
    } else {
      kBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800';
      kBadge.innerText = `K${kVal} Storm`;
    }
  }

  window.updateVfoDisplay();
};

/* =====================================================================
   SETTINGS MODAL & STATION PROFILE
   ===================================================================== */
window.openSettingsModal = function(tab = 'profile') {
  const fCall = document.getElementById('cfgCallsign');
  if (fCall) fCall.value = window.appState.profile.callsign || '';
  const fClass = document.getElementById('cfgClass');
  if (fClass) fClass.value = window.appState.profile.licenseClass || 'TECHNICIAN';
  const fMeter = document.getElementById('cfgMeterProfile');
  if (fMeter) fMeter.value = window.appState.profile.meterProfile || 'auto';
  const fGrid = document.getElementById('cfgGrid');
  if (fGrid) fGrid.value = window.appState.profile.grid || '';
  const fCity = document.getElementById('cfgCity');
  if (fCity) fCity.value = window.appState.profile.city || '';
  const fState = document.getElementById('cfgState');
  if (fState) fState.value = window.appState.profile.state || '';
  const fCountry = document.getElementById('cfgCountry');
  if (fCountry) fCountry.value = window.appState.profile.country || 'USA';
  const fCqz = document.getElementById('cfgCqz');
  if (fCqz) fCqz.value = window.appState.profile.cqz || '';
  const fItuz = document.getElementById('cfgItuz');
  if (fItuz) fItuz.value = window.appState.profile.ituz || '';
  const fPower = document.getElementById('cfgPower');
  if (fPower) fPower.value = window.appState.profile.power || '100';
  const fLat = document.getElementById('cfgLat');
  if (fLat) fLat.value = window.appState.profile.lat || 0.0;
  const fLon = document.getElementById('cfgLon');
  if (fLon) fLon.value = window.appState.profile.lon || 0.0;
  const fRig = document.getElementById('cfgRigName');
  if (fRig) fRig.value = window.appState.profile.rigName || '';
  const fAnt = document.getElementById('cfgAntenna');
  if (fAnt) fAnt.value = window.appState.profile.antenna || '';
  const fSoft = document.getElementById('cfgRadioSoftware');
  if (fSoft) fSoft.value = window.appState.radioSoftware;
  const fPort = document.getElementById('cfgRadioPort');
  if (fPort) fPort.value = window.appState.radioPort;

  if (typeof window.renderSettingsPanesList === 'function') window.renderSettingsPanesList();
  window.switchSettingsTab(tab);
  document.getElementById('settingsModal')?.classList.remove('hidden');
};

window.switchSettingsTab = function(tabKey) {
  ['profile', 'rig', 'panes', 'backup'].forEach(t => {
    const btn = document.getElementById(`tabBtn-${t}`);
    const content = document.getElementById(`tabContent-${t}`);
    if (btn && content) {
      if (t === tabKey) {
        btn.className = 'px-4 py-2.5 border-b-2 border-amber-500 text-amber-400 font-bold';
        content.classList.remove('hidden');
      } else {
        btn.className = 'px-4 py-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-200';
        content.classList.add('hidden');
      }
    }
  });
};

window.saveAllSettings = function() {
  const call = document.getElementById('cfgCallsign')?.value.trim().toUpperCase() || 'N0CALL';
  const licClass = document.getElementById('cfgClass')?.value || 'TECHNICIAN';
  const meterProfile = document.getElementById('cfgMeterProfile')?.value || 'auto';
  const grid = document.getElementById('cfgGrid')?.value.trim().toUpperCase() || 'AA00aa';
  const city = document.getElementById('cfgCity')?.value.trim() || '';
  const state = document.getElementById('cfgState')?.value.trim().toUpperCase() || '';
  const country = document.getElementById('cfgCountry')?.value.trim().toUpperCase() || 'USA';
  const cqz = document.getElementById('cfgCqz')?.value.trim() || '';
  const ituz = document.getElementById('cfgItuz')?.value.trim() || '';
  const power = document.getElementById('cfgPower')?.value.trim() || '100';
  const lat = parseFloat(document.getElementById('cfgLat')?.value) || 0.0;
  const lon = parseFloat(document.getElementById('cfgLon')?.value) || 0.0;
  const rigName = document.getElementById('cfgRigName')?.value.trim() || '';
  const antenna = document.getElementById('cfgAntenna')?.value.trim() || '';
  const software = document.getElementById('cfgRadioSoftware')?.value || 'flrig';
  const port = parseInt(document.getElementById('cfgRadioPort')?.value, 10) || 8088;

  window.appState.profile = { 
    callsign: call, 
    licenseClass: licClass,
    meterProfile: meterProfile,
    grid, 
    lat, 
    lon, 
    city, 
    state, 
    country, 
    cqz, 
    ituz,
    power, 
    rigName, 
    antenna 
  };
  window.appState.radioSoftware = software;
  window.appState.radioPort = port;

  window.setupHeaderTelemetry();
  if (typeof window.renderPanes === 'function') window.renderPanes();
  window.saveStateToStorage();
  window.closeModal('settingsModal');
  window.showToast('Settings saved & applied.');
};

window.calculateCoordsFromCurrentGrid = function() {
  const gridVal = document.getElementById('cfgGrid')?.value.trim().toUpperCase();
  if (typeof window.maidenheadToLatLon === 'function') {
    const coords = window.maidenheadToLatLon(gridVal);
    if (coords) {
      document.getElementById('cfgLat').value = coords.lat.toFixed(4);
      document.getElementById('cfgLon').value = coords.lon.toFixed(4);

      if (typeof window.estimateZonesFromLocation === 'function') {
        const stateVal = document.getElementById('cfgState')?.value || '';
        const countryVal = document.getElementById('cfgCountry')?.value || '';
        const zones = window.estimateZonesFromLocation({
          state: stateVal,
          country: countryVal,
          lat: coords.lat,
          lon: coords.lon
        });
        const fCqz = document.getElementById('cfgCqz');
        const fItuz = document.getElementById('cfgItuz');
        if (fCqz && !fCqz.value && zones.cqz) fCqz.value = zones.cqz;
        if (fItuz && !fItuz.value && zones.ituz) fItuz.value = zones.ituz;
      }

      window.showToast(`Calculated Lat: ${coords.lat.toFixed(2)}, Lon: ${coords.lon.toFixed(2)}`);
    } else {
      window.showToast('Invalid Maidenhead grid locator format.');
    }
  }
};

window.updateLatLonFromGrid = function(val) {
  if (val && val.length >= 4 && typeof window.maidenheadToLatLon === 'function') {
    const coords = window.maidenheadToLatLon(val);
    if (coords) {
      const fLat = document.getElementById('cfgLat');
      const fLon = document.getElementById('cfgLon');
      if (fLat) fLat.value = coords.lat.toFixed(4);
      if (fLon) fLon.value = coords.lon.toFixed(4);

      if (typeof window.estimateZonesFromLocation === 'function') {
        const stateVal = document.getElementById('cfgState')?.value || '';
        const countryVal = document.getElementById('cfgCountry')?.value || '';
        const zones = window.estimateZonesFromLocation({
          state: stateVal,
          country: countryVal,
          lat: coords.lat,
          lon: coords.lon
        });
        const fCqz = document.getElementById('cfgCqz');
        const fItuz = document.getElementById('cfgItuz');
        if (fCqz && !fCqz.value && zones.cqz) fCqz.value = zones.cqz;
        if (fItuz && !fItuz.value && zones.ituz) fItuz.value = zones.ituz;
      }
    }
  }
};

window.exportConfigJson = function() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(window.appState, null, 2));
  const dl = document.createElement('a');
  dl.setAttribute('href', dataStr);
  dl.setAttribute('download', `EZShack_Backup_${window.appState.profile.callsign || 'config'}.json`);
  dl.click();
  window.showToast('Exported dashboard configuration JSON.');
};

window.importConfigJson = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      window.appState = {
        ...window.appState,
        ...parsed,
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        bandFrequencies: { ...(parsed.bandFrequencies || {}) }
      };
      window.applyUiZoom(window.appState.uiZoom || 1.0);
      window.saveStateToStorage();
      window.setupHeaderTelemetry();
      if (typeof window.renderPanes === 'function') window.renderPanes();
      window.closeModal('settingsModal');
      window.showToast('Configuration successfully restored!');
    } catch (err) {
      window.showToast('Failed to parse config file: Invalid JSON.');
    }
  };
  reader.readAsText(file);
};

window.resetFactoryDefaults = function() {
  localStorage.removeItem('EZSHACK_STATE_V1');
  localStorage.removeItem('RIGDECK_V2_STATE');
  window.appState.panes = [];
  window.appState.bandFrequencies = {};
  window.applyUiZoom(1.0);
  if (typeof window.loadDefaultPreset === 'function') window.loadDefaultPreset();
  window.setupHeaderTelemetry();
  window.closeModal('settingsModal');
  window.showToast('Reset to factory default presets.');
};

window.purgeAdifLogFile = function() {
  const confirmMsg = "DANGER: This will permanently erase ALL QSO records from your log file (shack_log.adi) on disk.\n\nMake sure you have exported an ADIF backup first!\n\nType OK to completely wipe your logbook:";
  if (!window.confirm(confirmMsg)) {
    return;
  }

  // 1. Tell bridge daemon to wipe shack_log.adi on disk
  if (window.bridgeSocket && window.bridgeSocket.readyState === WebSocket.OPEN) {
    window.bridgeSocket.send(JSON.stringify({ action: "clear_adif_log" }));
  }

  // 2. Wipe memory & browser storage
  window.appState.qsos = [];
  if (typeof window.saveStateToStorage === 'function') {
    window.saveStateToStorage();
  }

  // 3. Clear table UI
  if (typeof window.renderQsoTable === 'function') {
    window.renderQsoTable();
  }

  if (typeof window.showToast === 'function') {
    window.showToast("Station log file purged & reset.");
  }
};

/* =====================================================================
   UI HELPERS & MODALS
   ===================================================================== */
window.openFrameShieldModal = function(title, url) {
  const t = document.getElementById('shieldModalTitle');
  if (t) t.innerText = title;
  const u = document.getElementById('shieldModalUrl');
  if (u) u.innerText = url;
  const btn = document.getElementById('shieldOpenWindowBtn');
  if (btn) {
    btn.onclick = function() {
      window.open(url, '_blank', 'width=1100,height=750');
      window.closeModal('frameShieldModal');
    };
  }
  document.getElementById('frameShieldModal')?.classList.remove('hidden');
};

window.toggleNightMode = function() {
  window.appState.nightMode = !window.appState.nightMode;
  if (window.appState.nightMode) {
    document.body.classList.add('night-mode');
    window.showToast('Tactical Red Night Mode enabled');
  } else {
    document.body.classList.remove('night-mode');
    window.showToast('Standard Day/Shack Mode restored');
  }
  window.saveStateToStorage();
};

window.toggleDropdown = function(id) {
  const elem = document.getElementById(id);
  if (elem) elem.classList.toggle('hidden');
};

window.openAddPaneModal = function() {
  if (typeof window.populatePaneCatalog === 'function') {
    window.populatePaneCatalog();
  }
  document.getElementById('addPaneModal')?.classList.remove('hidden');
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
};

window.showToast = function(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'bg-shack-800 border border-amber-500/60 text-slate-100 px-3.5 py-2 rounded shadow-2xl text-xs font-mono flex items-center gap-2 pointer-events-auto transition transform translate-y-2 opacity-0 duration-200';
  toast.innerHTML = `<span class="text-amber-400">⚡</span> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
};
