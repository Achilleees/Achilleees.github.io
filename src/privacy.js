/** Local privacy preference control.
 * Stores an origin-scoped audience-measurement preference without loading remote content.
 */
const optOutKey = 'roubiniol.analyticsOptOut';
const pendingKey = 'roubiniol.analyticsOptInPending';
const state = (window) => window.__roubiniolAnalyticsState ||= { excluded: false };
const queueOptOut = (window) => window._paq?.push([function () { this.optUserOut(); }]);

export function initializePrivacy(window, document = window.document) {
  const control = document.querySelector('[data-analytics-opt-out]');
  const status = document.querySelector('[data-analytics-status]');
  if (!control || !status) return false;
  try {
    control.checked = window.localStorage.getItem(optOutKey) === '1'; state(window).excluded = control.checked;
    control.hidden = false;
    status.textContent = control.checked ? 'This browser is excluded on this hostname.' : 'This preference applies on your next page load.';
  } catch { state(window).excluded = true; control.checked = true; status.textContent = 'This browser cannot persist this preference, so this page stays excluded.'; return false; }
  control.addEventListener('change', () => {
    if (control.checked) {
      state(window).excluded = true;
      try { window.localStorage.setItem(optOutKey, '1'); window.localStorage.removeItem(pendingKey); } catch { control.checked = true; queueOptOut(window); status.textContent = 'This browser cannot persist this preference, so this page stays excluded.'; return; }
      queueOptOut(window); status.textContent = 'This browser is excluded on this hostname.';
    } else {
      state(window).excluded = true;
      try { window.localStorage.removeItem(optOutKey); window.localStorage.setItem(pendingKey, '1'); } catch { control.checked = true; queueOptOut(window); status.textContent = 'This browser cannot persist this preference, so this page stays excluded.'; return; }
      status.textContent = 'This preference applies on your next page load.';
    }
  });
  return true;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') initializePrivacy(window, document);
