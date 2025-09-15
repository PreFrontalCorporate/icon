// scripts/desktop/write-dist-pkg.cjs
// Postbuild fixer for Electron packaging:
// - rename preload.js -> preload.cjs  (CJS for sandbox/preload)
// - create entry.cjs bootstrap that requires the compiled CJS main at dist/src/main.js
// - write a small dist/package.json set to commonjs

const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(process.cwd(), 'dist');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function safeRename(from, to, label) {
  if (exists(from)) {
    fs.renameSync(from, to);
    console.log(`✓ renamed ${label}`);
  }
}

function write(file, contents, label) {
  fs.writeFileSync(file, contents);
  console.log(`→ wrote ${label}`);
}

if (!exists(dist)) {
  console.error('dist/ not found; did you run build?');
  process.exit(1);
}

// 1) preload.js -> preload.cjs
safeRename(path.join(dist, 'preload.js'), path.join(dist, 'preload.cjs'), 'preload.js → preload.cjs');

// 2) Create entry.cjs that loads the compiled CJS main at dist/src/main.js
const entryCjs = `
/* Electron CJS bootstrap -> CJS main */
try {
  require('./src/main.js');
} catch (err) {
  console.error('[bootstrap] failed to require ./src/main.js', err);
  throw err;
}
`.trimStart();

write(path.join(dist, 'entry.cjs'), entryCjs, 'dist/entry.cjs bootstrap');

// 3) Make dist default to commonjs
const distPkg = {
  type: 'commonjs'
};
write(path.join(dist, 'package.json'), JSON.stringify(distPkg, null, 2) + '\n', 'dist/package.json with {"type":"commonjs"}');
