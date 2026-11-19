// Turns the single-file build (dist/index.html) into a page for a private Claude link.
// Claude wraps the page in its own <html>/<head>/<body>, so this keeps only the content:
// title, fonts, styles, the app root and the app script.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist/index.html', 'utf8');
const grab = (re, label) => {
  const m = src.match(re);
  if (!m) throw new Error(`make-artifact: could not find ${label} in dist/index.html`);
  return m[0];
};

const fonts = grab(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/, 'the font link');
const style = grab(/<style[^>]*>[\s\S]*?<\/style>/, 'the stylesheet');
const script = grab(/<script type="module"[^>]*>[\s\S]*?<\/script>/, 'the app script');

const out = [
  '<title>Trebuchet Lab</title>',
  fonts,
  style,
  '<div id="root"></div>',
  script,
  '',
].join('\n');

const dest = process.argv[2] ?? 'dist/trebuchet-lab.html';
writeFileSync(dest, out);
console.log(`wrote ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
