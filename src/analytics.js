/** Cookieless audience measurement.
 * Loads Matomo only for a verified public origin after every local exclusion check passes.
 */
const allowedOrigins = new Map([['https://sidearm.roubiniol.eu', 'Sidearm'], ['https://achille.roubiniol.eu', 'Roubiniol']]);
const optOutKey = 'roubiniol.analyticsOptOut';
const pendingKey = 'roubiniol.analyticsOptInPending';
function excluded(window) { if (window.__roubiniolAnalyticsState?.excluded || window.navigator?.globalPrivacyControl || ['1', 'yes'].includes(window.navigator?.doNotTrack) || ['1', 'yes'].includes(window.doNotTrack)) return true; try { return window.localStorage.getItem(optOutKey) === '1'; } catch { return true; } }

export function startAnalytics(window, document = window.document) {
  if (window.__roubiniolAnalyticsStarted) return false;
  window.__roubiniolAnalyticsStarted = true;
  const script = document.currentScript || document.querySelector('script[data-endpoint][data-site-id][data-origin][data-ready]');
  const origin = window.location?.origin;
  const siteId = Number(script?.dataset.siteId);
  if (!script || script.dataset.ready !== 'true' || !allowedOrigins.has(origin) || script.dataset.origin !== origin || script.dataset.endpoint !== 'https://stats.roubiniol.eu/' || !/^[1-9]\d*$/.test(script.dataset.siteId || '') || !Number.isSafeInteger(siteId) || siteId <= 0 || excluded(window)) return false;
  let pending = false;
  try { pending = window.localStorage.getItem(pendingKey) === '1'; } catch { return false; }
  const pathname = window.location.pathname === '/privacy/' ? '/privacy/' : window.location.pathname === '/' ? '/' : null;
  if (!pathname) return false;
  let referrer = '';
  if (document.referrer) { try { const parsed = new URL(document.referrer); if (!/^https?:$/.test(parsed.protocol)) return false; referrer = `${parsed.origin}/`; } catch { return false; } }
  const queue = window._paq = window._paq || [];
  queue.push(['setTrackerUrl', 'https://stats.roubiniol.eu/matomo.php'], ['setSiteId', String(siteId)], ['disableCookies'], ['disableBrowserFeatureDetection'], ['disableCampaignParameters'], ['disablePerformanceTracking'], ['setDoNotTrack', true], ['setCustomUrl', `${origin}${pathname}`]);
  if (referrer) queue.push(['setReferrerUrl', referrer]);
  queue.push([function () {
    if (excluded(window)) return;
    if (pending) {
      try { if (window.localStorage.getItem(pendingKey) === '1') { this.forgetUserOptOut(); window.localStorage.removeItem(pendingKey); } }
      catch { window.__roubiniolAnalyticsState = { excluded: true }; return; }
    }
    if (!excluded(window)) this.trackPageView(`${allowedOrigins.get(origin)}${pathname === '/privacy/' ? ' · Privacy' : ''}`);
  }]);
  window.matomoHeatmapSessionRecordingAsyncInit = () => window.Matomo?.HeatmapSessionRecording?.disable();
  const remote = document.createElement('script'); remote.async = true; remote.referrerPolicy = 'no-referrer'; remote.src = 'https://stats.roubiniol.eu/matomo.js';
  document.head.append(remote);
  const counterpart = origin === 'https://sidearm.roubiniol.eu' ? 'https://achille.roubiniol.eu/' : 'https://sidearm.roubiniol.eu/'; const destination = allowedOrigins.get(new URL(counterpart).origin);
  let counterpartEventSent = false;
  document.querySelectorAll(`a[href="${counterpart}"]`).forEach((link) => link.addEventListener('click', () => {
    if (counterpartEventSent || excluded(window)) return; counterpartEventSent = true; queue.push([function () { if (!excluded(window)) this.trackEvent('Project', 'open', destination); }]);
  }, { once: true }));
  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') startAnalytics(window, document);
