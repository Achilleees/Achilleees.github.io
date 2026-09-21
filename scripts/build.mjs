/** Personal static site publisher.
 * Renders validated authored content into a deterministic local public directory.
 */
import { cp, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roubiniolMark, sidearmBicep } from './graphics.mjs';
import { parseArguments, site } from './site-config.mjs';
import { loadAnalyticsConfig, analyticsTag, writePrivacy } from './privacy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { preview } = parseArguments(process.argv.slice(2));
const output = resolve(root, preview ? site.previewOutput : site.productionOutput);
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);

async function replaceOutput(path) {
  const info = await lstat(path).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
  const pathFromRoot = relative(root, path);
  if (info?.isSymbolicLink() || !pathFromRoot || pathFromRoot.startsWith('..') || pathFromRoot.split(/[\\/]/).includes('..')) throw new Error('Refusing to replace an output directory outside the project.');
  let ancestor = root;
  for (const segment of dirname(pathFromRoot).split(/[\\/]/)) {
    if (segment === '.') continue;
    ancestor = resolve(ancestor, segment);
    const ancestorInfo = await lstat(ancestor).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (ancestorInfo?.isSymbolicLink()) throw new Error('Refusing to replace output below a linked directory.');
    if (!ancestorInfo) await mkdir(ancestor);
  }
  await realpath(root);
  await rm(path, { recursive: true, force: true });
  await mkdir(path, { recursive: true });
  await cp(resolve(root, 'public'), path, { recursive: true });
}

const [template, css, raw] = await Promise.all([
  readFile(resolve(root, 'src', site.template), 'utf8'),
  readFile(resolve(root, 'src', site.stylesheet), 'utf8'),
  readFile(resolve(root, site.content), 'utf8'),
]);
const data = JSON.parse(raw);
const analyticsConfig = await loadAnalyticsConfig(root);
for (const field of ['name', 'title', 'description', 'tagline', 'github']) if (typeof data[field] !== 'string' || !data[field].trim()) throw new Error(`site.${field} must contain text.`);
for (const field of ['name', 'description', 'status', 'action']) if (typeof data.project?.[field] !== 'string' || !data.project[field].trim()) throw new Error(`project.${field} must contain text.`);
if (new URL(data.github).protocol !== 'https:') throw new Error('The GitHub link must use HTTPS.');
if (typeof data.contact?.email !== 'string' || !data.contact.email.trim() || typeof data.contact.emailVerified !== 'boolean') throw new Error('contact requires an email and boolean emailVerified value.');
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(data.contact.email)) throw new Error('Contact email must be a plain mailbox address.');
const contact = data.contact.emailVerified ? `<a class="contact-link" href="mailto:${escape(data.contact.email)}">${escape(data.contact.email)}</a>` : '';
const replacements = {
  NAME: escape(data.name), TITLE: escape(data.title), DESCRIPTION: escape(data.description), TAGLINE: escape(data.tagline),
  GITHUB: escape(data.github), MARK: roubiniolMark, SIDEARM_SYMBOL: sidearmBicep, STYLE_HASH: hash(css),
  CANONICAL_URL: site.productionUrl, HOME_URL: preview ? site.previewUrl : site.productionUrl,
  SIDEARM_URL: preview ? site.sidearmPreviewUrl : site.sidearmUrl, PROJECT_NAME: escape(data.project.name),
  PROJECT_DESCRIPTION: escape(data.project.description), PROJECT_STATUS: escape(data.project.status), PROJECT_ACTION: escape(data.project.action), CONTACT: contact,
};
const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
  if (!(key in replacements)) throw new Error(`Unknown template token: ${key}`);
  return replacements[key];
}).replace('</head>', `${preview ? '<meta name="robots" content="noindex">' : ''}${analyticsTag(analyticsConfig, preview, { origin: new URL(site.productionUrl).origin })}</head>`);
await replaceOutput(output);
await Promise.all([writeFile(resolve(output, 'index.html'), html), writeFile(resolve(output, 'styles.css'), css)]);
await writePrivacy({ root, output, preview, site: { ...site, name: data.name, counterpartUrl: site.sidearmUrl, counterpartPreviewUrl: site.sidearmPreviewUrl }, config: analyticsConfig });
console.log(`Built ${data.name}: dependency-free public homepage.`);
