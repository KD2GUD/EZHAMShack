/* =====================================================================
   EZSHACK - CENTRAL WIDGET DISPATCHER (widgets/widgets.js)
   Central registry initializer & native widget factory router
   ===================================================================== */

if (!window.EZWidgets) window.EZWidgets = {};

/* =====================================================================
   DISPATCHER
   ===================================================================== */
window.buildNativeWidget = function(type, instanceId) {
  if (window.EZWidgets && window.EZWidgets[type]) {
    try {
      return window.EZWidgets[type].render(instanceId);
    } catch (err) {
      console.error(`[EZWidgets] Error rendering widget ${type}:`, err);
    }
  }
  const fallback = document.createElement('div');
  fallback.className = 'p-4 text-slate-400 text-xs font-mono';
  fallback.innerText = `Widget [${type}] not found in EZWidgets.`;
  return fallback;
};