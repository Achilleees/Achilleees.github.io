/** Privacy page publisher.
 * Validates the deliberately opt-in analytics receipt and renders local privacy pages.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const endpoint = 'https://stats.roubiniol.eu/';
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export async function loadAnalyticsConfig(root) {
  const config = JSON.parse(await readFile(resolve(root, 'content/analytics.json'), 'utf8'));
  if (typeof config.enabled !== 'boolean' || typeof config.serverVerified !== 'boolean') throw new Error('Analytics booleans must be explicit.');
  if (config.siteId !== null && (!Number.isSafeInteger(config.siteId) || config.siteId <= 0)) throw new Error('Analytics siteId must be a positive safe integer or null.');
  if (config.enabled && (!config.serverVerified || config.siteId === null)) throw new Error('Enabled analytics requires a verified server receipt and site ID.');
  return Object.freeze({ enabled: config.enabled, siteId: config.siteId, serverVerified: config.serverVerified });
}

export function analyticsTag(config, preview, { origin, prefix = './' }) {
  if (!config.enabled || preview) return '';
  if (!config.serverVerified || !Number.isSafeInteger(config.siteId) || config.siteId <= 0 || !['https://sidearm.roubiniol.eu', 'https://achille.roubiniol.eu'].includes(origin)) throw new Error('Analytics requires a verified public site.');
  return `<script type="module" src="${escape(prefix)}analytics.js" data-ready="true" data-origin="${escape(origin)}" data-site-id="${config.siteId}" data-endpoint="${endpoint}"></script>`;
}

export async function writePrivacy({ root, output, preview, site, config }) {
  const [template, css, script, analytics] = await Promise.all([
    readFile(resolve(root, 'src/privacy.html'), 'utf8'), readFile(resolve(root, 'src/privacy.css'), 'utf8'),
    readFile(resolve(root, 'src/privacy.js'), 'utf8'), readFile(resolve(root, 'src/analytics.js'), 'utf8'),
  ]);
  const home = preview ? site.previewUrl : site.productionUrl;
  const counterpart = preview ? site.counterpartPreviewUrl : site.counterpartUrl;
  const notice = config.enabled && !preview
    ? 'This site uses self-hosted Matomo audience measurement at stats.roubiniol.eu. Tracking cookies are disabled, and you can exclude your visits below.'
    : 'Audience measurement is disabled on this site. No browser analytics runs. You can still save an exclusion for future visits.';
  const details = config.enabled && !preview
    ? '<p>Measurement records the page visited, a referring hostname when present, and a fixed label when you follow the project link. Query strings and fragments are excluded. The two sites use separate measurement IDs; cross-site identification, advertising, individual profiles and session recordings are disabled. Measurement data is retained for 180 days.</p>'
    : '<p>There is no active audience collector in this build. An exclusion saved here also applies if audience measurement is enabled on a later visit.</p>';
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => ({
    SITE_NAME: escape(site.name), HOME_URL: escape(home), COUNTERPART_URL: escape(`${counterpart}privacy/`), DETAILS: details,
    CANONICAL_URL: `${escape(site.productionUrl)}privacy/`, NOTICE: escape(notice),
    ROBOTS: preview ? '<meta name="robots" content="noindex">' : '',
    ANALYTICS: analyticsTag(config, preview, { origin: site.productionUrl.replace(/\/$/, ''), prefix: '../' }),
  }[key] ?? (() => { throw new Error(`Unknown privacy token: ${key}`); })()));
  const destination = resolve(output, 'privacy');
  await mkdir(destination, { recursive: true });
  await Promise.all([writeFile(resolve(destination, 'index.html'), html), writeFile(resolve(destination, 'privacy.css'), css), writeFile(resolve(destination, 'privacy.js'), script)]);
  if (config.enabled && !preview) await writeFile(resolve(output, 'analytics.js'), analytics);
}
