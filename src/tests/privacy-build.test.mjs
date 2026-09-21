import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAnalyticsConfig, analyticsTag, writePrivacy } from '../../scripts/privacy.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const site = { name: 'Sidearm', productionUrl: 'https://sidearm.roubiniol.eu/', previewUrl: 'http://127.0.0.1:4191/', counterpartUrl: 'https://achille.roubiniol.eu/', counterpartPreviewUrl: 'http://127.0.0.1:4192/' };

test('privacy build enforces activation and resolves emitted script paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'roubiniol-privacy-'));
  try {
    await mkdir(join(root, 'content')); await mkdir(join(root, 'src'));
    for (const file of ['privacy.html', 'privacy.css', 'privacy.js', 'analytics.js']) await cp(join(sourceRoot, 'src', file), join(root, 'src', file));
    for (const config of [{ enabled: true, siteId: null, serverVerified: true }, { enabled: true, siteId: 7, serverVerified: false }, { enabled: false, siteId: 1.2, serverVerified: false }]) {
      await writeFile(join(root, 'content/analytics.json'), JSON.stringify(config));
      await assert.rejects(loadAnalyticsConfig(root));
    }
    for (const [name, enabled, preview] of [['disabled', false, false], ['enabled', true, false], ['preview', true, true]]) {
      const config = { enabled, siteId: enabled ? 7 : null, serverVerified: enabled };
      await writeFile(join(root, 'content/analytics.json'), JSON.stringify(config));
      const validated = await loadAnalyticsConfig(root), output = join(root, name);
      await writePrivacy({ root, output, preview, site, config: validated });
      const html = await readFile(join(output, 'privacy/index.html'), 'utf8');
      const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(scripts.length, enabled && !preview ? 2 : 1);
      for (const ref of scripts) assert.equal((await stat(resolve(output, 'privacy', ref))).isFile(), true, ref);
      assert.equal(Boolean(await stat(join(output, 'analytics.js')).catch(() => null)), enabled && !preview);
      assert.ok(html.includes(`${preview ? site.counterpartPreviewUrl : site.counterpartUrl}privacy/`));
      assert.equal(analyticsTag(validated, preview, { origin: new URL(site.productionUrl).origin }).includes('data-ready="true"'), enabled && !preview);
    }
  } finally {
    assert.match(relative(tmpdir(), root), /^roubiniol-privacy-[^\\/]+$/);
    await rm(root, { recursive: true, force: true });
  }
});
