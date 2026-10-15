/** Privacy output verification.
 * Checks local preference assets and the explicit build-time analytics activation gate.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { loadAnalyticsConfig } from './privacy.mjs';

export async function checkPrivacy({ root, output, preview, site, errors }) {
  const config = await loadAnalyticsConfig(root);
  const active = config.enabled && !preview;
  const privacyRoot = resolve(output, 'privacy');
  const html = await readFile(resolve(privacyRoot, 'index.html'), 'utf8');
  const home = await readFile(resolve(output, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length || (html.match(/<h1\b/g) ?? []).length !== 1) errors.push('Privacy page heading or IDs are invalid.');
  if (/\{\{[A-Z_]+\}\}/.test(html)) errors.push('Privacy page contains an unresolved token.');
  for (const match of html.matchAll(/\baria-(?:labelledby|describedby|controls)="([^"]+)"/g)) for (const id of match[1].split(/\s+/)) if (!ids.includes(id)) errors.push(`Privacy accessibility target is missing: ${id}`);
  const canonical = `${site.productionUrl}privacy/`;
  if (!html.includes(`rel="canonical" href="${canonical}"`) || !html.includes(`property="og:url" content="${canonical}"`)) errors.push('Privacy canonical metadata is invalid.');
  if (!html.includes('data-analytics-opt-out') || !html.includes('role="status"')) errors.push('Privacy preference controls are missing.');
  if (!home.includes('href="./privacy/"')) errors.push('Homepage lacks the local privacy link.');
  for (const page of [home, html]) {
    if (!page.includes('<meta name="referrer" content="no-referrer">')) errors.push('A page lacks the no-referrer policy.');
    if (preview && !page.includes('<meta name="robots" content="noindex">')) errors.push('Preview pages must be noindex.');
    if (!preview && /localhost|127\.0\.0\.1|\[::1\]/i.test(page)) errors.push('Production privacy output contains localhost.');
    const tags = [...page.matchAll(/<script\b[^>]*\bsrc="[^"]*analytics\.js"[^>]*>/g)];
    if (tags.length !== (active ? 1 : 0)) errors.push('Analytics script count does not match its activation gate.');
    if (active && (!tags[0]?.[0].includes('data-ready="true"') || !tags[0]?.[0].includes(`data-site-id="${config.siteId}"`) || !tags[0]?.[0].includes(`data-origin="${new URL(site.productionUrl).origin}"`))) errors.push('Analytics receipt attributes are invalid.');
    if (/<(?:script|iframe|img)\b[^>]*\bsrc="https?:\/\//i.test(page)) errors.push('Direct remote privacy resources are forbidden.');
  }
  const trackerExists = Boolean(await stat(resolve(output, 'analytics.js')).catch(() => null));
  if (trackerExists !== active || await stat(resolve(privacyRoot, 'analytics.js')).catch(() => null)) errors.push('Analytics asset does not match the activation gate.');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (ref.startsWith('#')) { if (!ids.includes(ref.slice(1))) errors.push(`Missing privacy anchor: ${ref}`); continue; }
    if (ref.startsWith('https://')) continue;
    if (/^mailto:[a-z0-9._%+-]+@roubiniol\.eu$/i.test(ref)) continue;
    if (preview && /^http:\/\/127\.0\.0\.1:419[12]\/(?:privacy\/)?$/.test(ref)) continue;
    const file = resolve(privacyRoot, ref.split(/[?#]/)[0]);
    const path = relative(output, file);
    if (path.startsWith('..') || isAbsolute(path) || !(await stat(file).catch(() => null))?.isFile()) errors.push(`Missing or unconfined privacy asset: ${ref}`);
  }
}
