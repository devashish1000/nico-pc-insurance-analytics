import { gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const assetsDirectory = resolve('dist/assets');
const entries = (await readdir(assetsDirectory)).filter((name) => /\.(?:js|css)$/.test(name));

if (!entries.length) throw new Error('No production JavaScript or CSS assets were found. Run the build first.');

const assets = await Promise.all(entries.map(async (name) => {
  const bytes = await readFile(resolve(assetsDirectory, name));
  return {
    name,
    type: name.endsWith('.js') ? 'js' : 'css',
    rawBytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
  };
}));

const summarize = (type) => {
  const matching = assets.filter((asset) => asset.type === type);
  return {
    count: matching.length,
    rawBytes: matching.reduce((sum, asset) => sum + asset.rawBytes, 0),
    gzipBytes: matching.reduce((sum, asset) => sum + asset.gzipBytes, 0),
    largestRawBytes: Math.max(...matching.map((asset) => asset.rawBytes), 0),
    largestGzipBytes: Math.max(...matching.map((asset) => asset.gzipBytes), 0),
  };
};

const summary = { js: summarize('js'), css: summarize('css') };
const limits = {
  js: { rawBytes: 1_050_000, gzipBytes: 340_000, largestRawBytes: 420_000, largestGzipBytes: 130_000 },
  css: { rawBytes: 100_000, gzipBytes: 25_000, largestRawBytes: 80_000, largestGzipBytes: 20_000 },
};

const failures = [];
for (const type of ['js', 'css']) {
  for (const [metric, limit] of Object.entries(limits[type])) {
    if (summary[type][metric] > limit) failures.push(`${type}.${metric} ${summary[type][metric]} exceeds ${limit}`);
  }
}

console.log(JSON.stringify({ summary, limits, largestAssets: assets.sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 5) }));
if (failures.length) throw new Error(`Production bundle budget failed: ${failures.join('; ')}`);
