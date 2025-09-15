// Generates build/icon.ico and build/icon.icns from build/icon.png
// Usage: pnpm --dir app/desktop run icons:gen

const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const root = path.join(__dirname, '..');
  const src = path.join(root, 'build', 'icon.png');
  const outIco = path.join(root, 'build', 'icon.ico');
  const outIcns = path.join(root, 'build', 'icon.icns');
  try {
    if (!fs.existsSync(src)) {
      console.error('Missing', src, '\nPlace your 1024x1024 PNG there and rerun.');
      process.exit(1);
    }
    const png2icons = require('png2icons');
    const buf = fs.readFileSync(src);
    // ICO (Windows)
    const ico = png2icons.createICO(buf, png2icons.BILINEAR, false, 0, false);
    if (ico) { fs.writeFileSync(outIco, ico); console.log('✓ Wrote', outIco); }
    else { console.warn('ICO generation returned empty buffer'); }
    // ICNS (macOS)
    const icns = png2icons.createICNS(buf, png2icons.BILINEAR, false, 0);
    if (icns) { fs.writeFileSync(outIcns, icns); console.log('✓ Wrote', outIcns); }
    else { console.warn('ICNS generation returned empty buffer'); }
  } catch (e) {
    console.error('icon generation failed:', e);
    process.exit(1);
  }
}

main();
