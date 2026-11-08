/**
 * EZShack Sub-Receiver Widget (js/widgets/sub_receiver_widget.js)
 * Standalone dual-watch VHF/UHF monitor widget.
 * Hardware-gated: Activates only when radio capabilities include 'sub_rx' (TS-2000).
 */

class SubReceiverWidget {
  constructor(containerId = "widget-container", wsClient = null) {
    this.container = document.getElementById(containerId) || document.body;
    this.ws = wsClient || window.ws;
    this.element = null;
    this.enabled = false;
    this.frequency = 146520000;
    this.muted = false;
    this.isSupported = false;

    this.render();
  }

  render() {
    this.element = document.createElement("div");
    this.element.id = "widget-sub-receiver";
    this.element.className = "card shadow-sm border-secondary mb-3 text-light font-monospace";
    this.element.style.cssText = "display: none; background: #12151c; min-width: 320px;";

    this.element.innerHTML = `
      <div class="card-header d-flex justify-content-between align-items-center py-2" style="background: #1c212d; border-bottom: 1px solid #2d3748;">
        <span class="fw-bold text-info small">
          <i class="bi bi-broadcast-pin me-1"></i>SUB-RECEIVER (VHF/UHF)
        </span>
        <div class="btn-group btn-group-sm">
          <button id="subrx-btn-pwr" class="btn btn-outline-secondary btn-sm py-0 px-2">OFF</button>
          <button id="subrx-btn-mute" class="btn btn-outline-warning btn-sm py-0 px-2">MUTE</button>
        </div>
      </div>
      <div class="card-body p-3">
        <div class="d-flex justify-content-between align-items-baseline mb-2">
          <div id="subrx-freq-val" class="display-6 fw-bold text-info" style="letter-spacing: 1px;">---.---.--</div>
          <span id="subrx-band-badge" class="badge bg-secondary">---</span>
        </div>

        <!-- Quick Repeater / Simplex Presets & Steppers -->
        <div class="btn-group btn-group-sm w-100 mb-2">
          <button class="btn btn-dark border-secondary subrx-qpick" data-freq="146520000">146.520</button>
          <button class="btn btn-dark border-secondary subrx-qpick" data-freq="147000000">147.000</button>
          <button class="btn btn-dark border-secondary subrx-qpick" data-freq="446000000">446.000</button>
          <button class="btn btn-outline-info subrx-step" data-step="-25000">-25k</button>
          <button class="btn btn-outline-info subrx-step" data-step="25000">+25k</button>
        </div>

        <!-- Sub S-Meter -->
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="small text-secondary" style="font-size: 0.75rem;">SIG</span>
          <div class="progress flex-grow-1 bg-black" style="height: 6px; border: 1px solid #2d3748;">
            <div id="subrx-smeter-fill" class="progress-bar bg-info" style="width: 0%; transition: width 0.15s ease;"></div>
          </div>
        </div>

        <!-- Sub Volume Slider -->
        <div class="d-flex align-items-center gap-2">
          <span class="small text-secondary" style="font-size: 0.75rem;">VOL</span>
          <input type="range" class="form-range flex-grow-1" id="subrx-vol-slider" min="0" max="100" value="50">
        </div>
      </div>
    `;

    this.container.appendChild(this.element);
    this.bindEvents();
  }

  bindEvents() {
    // Power Toggle
    this.element.querySelector("#subrx-btn-pwr").addEventListener("click", () => {
      this.send({ action: "set_sub_power", enabled: !this.enabled });
    });

    // Mute Toggle
    this.element.querySelector("#subrx-btn-mute").addEventListener("click", () => {
      this.send({ action: "set_sub_mute", muted: !this.muted });
    });

    // Frequency Quick-picks
    this.element.querySelectorAll(".subrx-qpick").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const freq = parseInt(e.target.getAttribute("data-freq"), 10);
        this.send({ action: "set_sub_freq", freq: freq });
      });
    });

    // Step Tuning
    this.element.querySelectorAll(".subrx-step").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const step = parseInt(e.target.getAttribute("data-step"), 10);
        this.send({ action: "set_sub_freq", freq: this.frequency + step });
      });
    });

    // AF Volume Slider
    this.element.querySelector("#subrx-vol-slider").addEventListener("input", (e) => {
      this.send({ action: "set_sub_volume", volume: parseInt(e.target.value, 10) });
    });
  }

  send(payload) {
    const socket = this.ws || window.ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  update(state) {
    if (!state) return;

    // Capability Gate: TS-2000 exposes 'sub_rx', FT-991A does not
    const supportsSub = state.capabilities && state.capabilities.includes("sub_rx");

    if (!supportsSub) {
      if (this.isSupported) {
        this.isSupported = false;
        this.element.style.display = "none";
      }
      return;
    }

    if (!this.isSupported) {
      this.isSupported = true;
      this.element.style.display = "block";
    }

    const sub = state.sub_rx;
    if (!sub) return;

    this.enabled = !!sub.enabled;
    this.frequency = sub.frequency || 146520000;
    this.muted = !!sub.muted;

    // Power Button
    const pwrBtn = this.element.querySelector("#subrx-btn-pwr");
    pwrBtn.textContent = this.enabled ? "ON" : "OFF";
    pwrBtn.className = this.enabled 
      ? "btn btn-success btn-sm py-0 px-2 fw-bold" 
      : "btn btn-outline-secondary btn-sm py-0 px-2";

    // Mute Button
    const muteBtn = this.element.querySelector("#subrx-btn-mute");
    muteBtn.className = this.muted
      ? "btn btn-warning btn-sm py-0 px-2 fw-bold"
      : "btn btn-outline-warning btn-sm py-0 px-2";

    // Frequency Readout (146520000 -> 146.520.00)
    const freqEl = this.element.querySelector("#subrx-freq-val");
    if (this.enabled && this.frequency) {
      const mhz = (this.frequency / 1000000).toFixed(4);
      const [whole, dec] = mhz.split(".");
      freqEl.textContent = `${whole}.${dec.slice(0, 3)}.${dec.slice(3) || "0"}`;
    } else {
      freqEl.textContent = "OFFLINE";
    }

    // Band/Mode Badge
    const badge = this.element.querySelector("#subrx-band-badge");
    badge.textContent = this.enabled ? `${sub.band} ${sub.mode}` : "STANDBY";
    badge.className = this.enabled ? "badge bg-info text-dark" : "badge bg-secondary";

    // S-Meter: Kenwood SM1 is 0-15
    const smeterFill = this.element.querySelector("#subrx-smeter-fill");
    const pct = this.enabled ? Math.min(100, Math.round((sub.smeter_val / 15.0) * 100)) : 0;
    smeterFill.style.width = `${pct}%`;
  }
}

// Auto-register widget instance
window.SubReceiverWidget = SubReceiverWidget;