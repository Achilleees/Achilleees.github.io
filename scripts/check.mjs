/** Personal static site verification.
 * Checks generated metadata, local assets, confinement, contact gating, and output size.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArguments, site } from './site-config.mjs';
import { checkPrivacy } from './check-privacy.mjs';
import { loadAnalyticsConfig } from './privacy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { preview } = parseArguments(process.argv.slice(2));
const output = resolve(root, preview ? site.previewOutput : site.productionOutput);
const [html, css, content] = await Promise.all([readFile(resolve(output, 'index.html'), 'utf8'), readFile(resolve(output, 'styles.css'), 'utf8'), readFile(resolve(root, site.content), 'utf8')]);
const data = JSON.parse(content);
const analyticsConfig = await loadAnalyticsConfig(root);
const errors = [];
const byteCeiling = 461_120;
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length) errors.push('Duplicate HTML IDs.');
if ((html.match(/<h1\b/g) ?? []).length !== 1) errors.push('The page must have one primary heading.');
for (const target of html.matchAll(/\baria-(?:controls|labelledby|describedby)="([^"]+)"/g)) for (const id of target[1].split(/\s+/)) if (!ids.includes(id)) errors.push(`Missing accessibility target: ${id}`);
if (/\{\{[A-Z_]+\}\}/.test(html)) errors.push('Unresolved template token.');
if (!html.includes(`rel="canonical" href="${site.productionUrl}"`)) errors.push('Canonical URL does not match the site contract.');
if (!html.includes(`property="og:url" content="${site.productionUrl}"`)) errors.push('Open Graph URL does not match the canonical URL.');
if (preview ? !html.includes('<meta name="robots" content="noindex">') : /(?:127\.0\.0\.1|localhost|\[::1\])/i.test(html)) errors.push(preview ? 'Preview output must be noindex.' : 'Production output must not contain localhost.');
if (!html.includes(`href="${preview ? site.sidearmPreviewUrl : site.sidearmUrl}"`)) errors.push('Expected Sidearm navigation is missing.');
if (!html.includes('https://github.com/Achilleees')) errors.push('Expected GitHub contact is missing.');
if (!html.includes('atlas-symbol-bef')) errors.push('Sidearm bicep mark is missing.');
if (data.contact.emailVerified ? !html.includes(`mailto:${data.contact.email}`) : html.includes(data.contact.email) || html.includes('mailto:')) errors.push('Email rendering does not match contact verification.');
if ((html.match(/<script\b/g) ?? []).length !== (analyticsConfig.enabled && !preview ? 1 : 0)) errors.push('Homepage script count must match the verified analytics gate.');
if (/\b(?:google-analytics|googletagmanager|gtag\(|plausible\.|fathom\.|segment\.com|mixpanel|hotjar)\b/i.test(`${html}\n${css}`)) errors.push('Unapproved tracking provider is forbidden.');
const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
const description = /<meta name="description" content="([^"]+)"/.exec(html)?.[1];
if (!title || !html.includes(`property="og:title" content="${title}"`) || !description || !html.includes(`property="og:description" content="${description}"`)) errors.push('Page metadata is inconsistent.');
if (/<(?:script|img|iframe)\b[^>]*\bsrc="https?:\/\//i.test(html) || /<link\b(?=[^>]*\brel="(?:stylesheet|icon|preload)")(?=[^>]*\bhref="https?:\/\/)/i.test(html) || /url\(['"]?(?:https?:)?\/\//i.test(css)) errors.push('Remote runtime assets are forbidden.');
const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
refs.push(...[...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map((match) => match[1]));
for (const ref of refs) {
  if (ref.startsWith('#')) { if (!ids.includes(ref.slice(1))) errors.push(`Missing anchor: ${ref}`); continue; }
  if (/^https:\/\//.test(ref) || (preview && [site.previewUrl, site.sidearmPreviewUrl].includes(ref)) || (data.contact.emailVerified && ref === `mailto:${data.contact.email}`)) continue;
  if (/^(?:https?:)?\/\//.test(ref)) { errors.push(`External runtime asset is forbidden: ${ref}`); continue; }
  const file = resolve(output, decodeURIComponent(ref.split(/[?#]/)[0]));
  const path = relative(output, file);
  if (path.startsWith('..') || isAbsolute(path)) { errors.push(`Asset escapes output: ${ref}`); continue; }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() && !(info?.isDirectory() && (await stat(resolve(file, 'index.html')).catch(() => null))?.isFile())) errors.push(`Missing asset: ${ref}`);
}
if (!(await stat(resolve(output, '.nojekyll')).catch(() => null))?.isFile()) errors.push('Missing .nojekyll.');
if (await stat(resolve(output, '__checks')).catch(() => null)) errors.push('Review fixtures must not remain in generated output.');
if ((await readFile(resolve(output, 'assets/favicon.svg'), 'utf8')) !== (await readFile(resolve(root, 'public/assets/favicon.svg'), 'utf8'))) errors.push('Favicon does not match the personal identity.');
await checkPrivacy({ root, output, preview, site, errors });
for (const font of ['manrope.ttf', 'space-grotesk.ttf']) {
  const signature = (await readFile(resolve(output, 'assets/fonts', font))).subarray(0, 4).toString('hex');
  if (!['00010000', '4f54544f'].includes(signature)) errors.push(`Invalid font: ${font}`);
}
for (const name of ['manrope-OFL.txt', 'space-grotesk-OFL.txt']) if (!(await stat(resolve(output, 'assets/fonts', name)).catch(() => null))?.isFile()) errors.push(`Missing font license: ${name}`);
async function outputBytes(directory) { let total = 0; for (const entry of await readdir(directory, { withFileTypes: true })) { const path = resolve(directory, entry.name); total += entry.isDirectory() ? await outputBytes(path) : entry.isFile() ? (await stat(path)).size : 0; } return total; }
const totalBytes = await outputBytes(output);
if (totalBytes > byteCeiling) errors.push(`Generated output is ${totalBytes} bytes; the ceiling is ${byteCeiling}.`);
for (const file of ['scripts/site-config.mjs', 'scripts/build.mjs', 'scripts/check.mjs', 'scripts/graphics.mjs', 'scripts/privacy.mjs', 'scripts/check-privacy.mjs', 'src/privacy.js', 'src/analytics.js']) { const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' }); if (result.status !== 0) errors.push(result.stderr || `Syntax check failed: ${file}`); }
if (!preview && !errors.length) { const result = spawnSync(process.execPath, ['--test', resolve(root, 'src/tests/analytics.test.mjs'), resolve(root, 'src/tests/privacy-build.test.mjs')], { encoding: 'utf8' }); if (result.status !== 0) errors.push(result.stderr || result.stdout || 'Privacy tests failed.'); }
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`PASS: personal site local assets, metadata, contact gate, and output confinement. ${totalBytes} generated bytes.`);
