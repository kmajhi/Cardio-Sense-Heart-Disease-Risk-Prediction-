// Ad blockers hide elements whose class or id looks like an advert ("ad-side",
// "ad-banner", "sponsored"...), whatever the page's own CSS says. The admin
// console once used an "ad-" prefix and showed as a blank page for anyone with
// an ad blocker. This keeps such names out of the app.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RISKY = /(^|[^A-Za-z0-9_-])(ad|ads|advert|advertisement|sponsor|sponsored|adbox|adsbox|banner-ad)[-_](?=[a-z])/gm;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : files(path);
    return /\.(jsx?|css)$/.test(name) && !name.endsWith('.test.js') ? [path] : [];
  });
}

describe('class names ad blockers would hide', () => {
  it('are not used anywhere in the app', () => {
    const found = [];
    for (const path of files(ROOT)) {
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(RISKY)) {
        const line = text.slice(0, match.index).split('\n').length;
        found.push(`${relative(ROOT, path)}:${line} "${match[0].trim()}…"`);
      }
    }
    expect(found).toEqual([]);
  });
});
