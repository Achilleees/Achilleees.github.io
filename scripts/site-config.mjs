/** Personal site configuration.
 * Defines the fixed personal origin, output directories, and preview-only option.
 */
export const site = Object.freeze({
  content: 'content/site.json', template: 'index.html', stylesheet: 'styles.css',
  productionOutput: 'dist', previewOutput: 'preview',
  productionUrl: 'https://achille.roubiniol.eu/', previewUrl: 'http://127.0.0.1:4192/',
  sidearmUrl: 'https://sidearm.roubiniol.eu/', sidearmPreviewUrl: 'http://127.0.0.1:4191/',
});

export function parseArguments(argv) {
  if (argv.length === 0) return { preview: false };
  if (argv.length === 1 && argv[0] === '--preview') return { preview: true };
  throw new Error('Only --preview is supported.');
}
