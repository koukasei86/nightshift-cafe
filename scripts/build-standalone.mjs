import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = new URL('../', import.meta.url);
const build = new URL('dist/', project);
const output = new URL('../Nightshift-Cafe.html', import.meta.url);
const text = async (path, base = build) => readFile(new URL(path, base), 'utf8');
let html = await text('index.html');
const script = /<script type="module" crossorigin src="\/([^"]+)"><\/script>/u;
const stylesheet = /<link rel="stylesheet" crossorigin href="\/([^"]+)">/u;
const js = await text(html.match(script)[1]);
let css = await text(html.match(stylesheet)[1]);
if (/<\/script/iu.test(js) || /<\/style/iu.test(css)) throw new Error('Unsafe inline content');

for (const [match, asset, format] of [...css.matchAll(/url\(\/?(assets\/[^)]+\.(woff2?))\)/gu)]) {
  const bytes = await readFile(new URL(asset, build));
  css = css.replaceAll(match, `url(data:font/${format};base64,${bytes.toString('base64')})`);
}
if (css.includes('url(/assets/')) throw new Error('Unresolved stylesheet asset');
const packages = new URL('node_modules/', project);
const licenses = await Promise.all([
  text('phaser/LICENSE.md', packages),
  text('@fontsource-variable/dm-sans/LICENSE', packages),
  text('@fontsource/dm-serif-text/LICENSE', packages),
]);
html = html.replace(script, () => `<script type="module">${js}</script>`)
  .replace(stylesheet, () => `<style>${css}</style>`)
  .replace('</body>', () => `<!-- Third-party licenses\n${licenses.join('\n\n').replaceAll('-->', '--&gt;')}\n-->\n</body>`);
await writeFile(output, html);

console.log('Created offline Nightshift-Cafe.html');
