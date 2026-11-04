// Turns the build in dist/ into a claude.ai artifact in artifact/: the page
// without its document wrapper, which the artifact host adds, plus the script files.
// Run it with `npm run artifact`, then publish artifact/index.html with assets/ as its files.
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const page = readFileSync('dist/index.html', 'utf8')
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?(html|head|body)\b[^>]*>\s*/gi, '')
  .replace(/<meta\b[^>]*>\s*/gi, '');

rmSync('artifact', { recursive: true, force: true });
cpSync('dist/assets', 'artifact/assets', { recursive: true });
writeFileSync('artifact/index.html', page);

const files = Object.fromEntries(readdirSync('artifact/assets').map((f) => [`assets/${f}`, `artifact/assets/${f}`]));
console.log(JSON.stringify(files, null, 2));
