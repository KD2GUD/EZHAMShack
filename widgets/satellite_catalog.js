/* =====================================================================
   EZSHACK - AMATEUR SATELLITE CATALOG & SYNC ENGINE
   widgets/satellite_catalog.js
   ===================================================================== */

const CATALOG_MAX_AGE_DAYS = 7; // Auto-update cadence (default: every 7 days)
const CATALOG_STORAGE_KEY = 'EZSHACK_SATELLITE_CATALOG_V1';
const CATALOG_SYNC_TIME_KEY = 'EZSHACK_CATALOG_LAST_SYNC_TS';

// Baseline default transponder catalog (offline fallback)
const DEFAULT_CATALOG = [
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

// Initialize and restore catalog from localStorage
function initSatelliteCatalog() {
  try {
    const stored = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (stored) {
      window.SATELLITE_CATALOG = JSON.parse(stored);
    } else {
      window.SATELLITE_CATALOG = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(window.SATELLITE_CATALOG));
    }
  } catch (e) {
    console.warn('[Satellite Catalog] Storage read failed, falling back to default:', e);
    window.SATELLITE_CATALOG = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
  }
}

// Check staleness and execute auto-update routine
window.checkAndAutoUpdateCatalog = async function() {
  const lastSync = parseInt(localStorage.getItem(CATALOG_SYNC_TIME_KEY) || '0', 10);
  const now = Date.now();
  const maxAgeMs = CATALOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  if (isNaN(lastSync) || (now - lastSync) > maxAgeMs) {
    console.info(`[Satellite Catalog] Catalog is older than ${CATALOG_MAX_AGE_DAYS} days. Running auto-sync...`);
    await window.syncCatalogTLEs(false);
  } else {
    const ageDays = ((now - lastSync) / (1000 * 60 * 60 * 24)).toFixed(1);
    console.info(`[Satellite Catalog] Catalog cache is fresh (${ageDays} days old).`);
  }
};

// Update TLE orbital elements from CelesTrak and persist to localStorage
window.syncCatalogTLEs = async function(interactive = true) {
  if (interactive && typeof window.showToast === 'function') {
    window.showToast('Connecting to CelesTrak to update orbital elements...');
  }

  try {
    const resp = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const lines = text.split('\n');

    let updatedCount = 0;
    window.SATELLITE_CATALOG.forEach(sat => {
      const noradStr = String(sat.norad);
      for (let i = 0; i < lines.length - 2; i++) {
        if (lines[i+1].includes(noradStr) || lines[i+2].includes(noradStr)) {
          sat.tle1 = lines[i+1].trim();
          sat.tle2 = lines[i+2].trim();
          updatedCount++;
          break;
        }
      }
    });

    // Save updated catalog and timestamp
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(window.SATELLITE_CATALOG));
    localStorage.setItem(CATALOG_SYNC_TIME_KEY, Date.now().toString());

    // Notify any active widgets (e.g., satellite tracker) to refresh calculations
    window.dispatchEvent(new CustomEvent('ezshack:catalog_updated', {
      detail: { updatedCount, timestamp: Date.now() }
    }));

    if (interactive && typeof window.showToast === 'function') {
      window.showToast(`🛰️ Catalog Updated: ${updatedCount} satellites refreshed.`);
    }
    return true;
  } catch (err) {
    console.warn('[Satellite Catalog] Live update failed:', err);
    if (interactive && typeof window.showToast === 'function') {
      window.showToast('TLE update skipped (network offline or blocked). Using cached elements.');
    }
    return false;
  }
};

// Immediate execution on script load
initSatelliteCatalog();
window.checkAndAutoUpdateCatalog();