/** Construction page staging.
 * Stages construction/index.html with public/ (favicon, fonts, licences) into dist-construction/, the page also as 404.html so every old path lands on it.
 */
import { copyFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'dist-construction');
const page = join(root, 'construction', 'index.html');

await rm(output, { recursive: true, force: true });
await cp(join(root, 'public'), output, { recursive: true });
for (const name of ['index.html', '404.html']) await copyFile(page, join(output, name));
console.log(`Staged the construction page in ${output}`);
