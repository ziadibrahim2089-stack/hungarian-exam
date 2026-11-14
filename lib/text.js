// Text helpers shared by the app, the build script and the tests. No DOM here.

export const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lowercase, no accents, no punctuation, hyphens -> spaces, single spaces.
export function norm(s) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[‐-―−-]/g, ' ')
    .replace(/[.,;:!?„“”"'’`´()[\]{}…_/\\،؟«»<>|*+=~^%$#@&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// norm() + drop a leading Hungarian article ("a", "az").
export function canon(s) {
  return norm(s).replace(/^(az?)\s+/, '');
}

// ---------- Hungarian -> Arabic letters (pronunciation aid) ----------
// sz = س, s = ش, cs = تش, zs = ژ (ج شامي), gy = دج, ly = ي, ny = ني, ty = تي, c = تس
const EXC = {
  beethoven: 'بيتهوفن', ludwig: 'لودفيج', van: 'فان', von: 'فون', mozart: 'موتسارت',
  shakespeare: 'شكسبير', william: 'ويليام', schiller: 'شيلر', friedrich: 'فريدريش',
  habsburg: 'هابسبورج', habsburgok: 'هابسبورجوك', janus: 'يانوس', pannonius: 'پانونيوس',
  kölcsey: 'كؤلتشي', széchenyi: 'سيتشيني', batthyány: 'باتياني', görgei: 'جؤرجِي', görgey: 'جؤرجِي',
  egressy: 'إجرِشّي', eu: 'إي يو', svájc: 'شڤايتس', voltaire: 'ڤولتير', goethe: 'جؤتِه',
};
const VOW = { a: 'ا', á: 'ا', e: 'ِ', é: 'ي', i: 'ي', í: 'ي', o: 'و', ó: 'و', ö: 'ؤ', ő: 'ؤ', u: 'و', ú: 'و', ü: 'يو', ű: 'يو' };
const VOW0 = { a: 'أ', á: 'آ', e: 'إ', é: 'إي', i: 'إي', í: 'إي', o: 'أو', ó: 'أو', ö: 'أؤ', ő: 'أؤ', u: 'أو', ú: 'أو', ü: 'إيو', ű: 'إيو' };
const MULTI = [['dzs', 'دج'], ['cs', 'تش'], ['ch', 'تش'], ['cz', 'تس'], ['dz', 'دز'], ['gy', 'دج'],
  ['ly', 'ي'], ['ny', 'ني'], ['sz', 'س'], ['ty', 'تي'], ['zs', 'ژ'], ['th', 'ت']];
const CONS = { b: 'ب', c: 'تس', d: 'د', f: 'ف', g: 'ج', h: 'ه', j: 'ي', k: 'ك', l: 'ل', m: 'م', n: 'ن',
  p: 'پ', q: 'ك', r: 'ر', s: 'ش', t: 'ت', v: 'ڤ', w: 'و', x: 'كس', y: 'ي', z: 'ز' };
const SHADDA = 'ّ';

function translitWord(word) {
  if (/^[IVXLC]+\.?$/.test(word)) return word;          // Roman numerals stay (XI. század)
  const w = word.toLowerCase();
  if (EXC[w]) return EXC[w];
  let out = '';
  let i = 0;
  let start = true;
  while (i < w.length) {
    const ch = w[i];
    if (VOW[ch]) {
      if (ch === 'e' && w[i + 1] === 'y' && i + 2 === w.length) { out += 'ي'; i += 2; start = false; continue; }
      out += start ? VOW0[ch] : VOW[ch];
      i++; start = false; continue;
    }
    let hit = false;
    for (const [g, ar] of MULTI) {
      if (w.startsWith(g, i)) { out += ar; i += g.length; hit = true; break; }
      if (g.length === 2 && w[i] === g[0] && w.startsWith(g, i + 1)) { out += ar + SHADDA; i += 3; hit = true; break; }
    }
    if (hit) { start = false; continue; }
    if (CONS[ch]) {
      if (w[i + 1] === ch) { out += CONS[ch] + SHADDA; i += 2; } else { out += CONS[ch]; i++; }
      start = false; continue;
    }
    out += ch; i++;
  }
  return out.replace(/يي+/g, 'ي');
}

export function translit(s) {
  return String(s ?? '').split(/(\s+|-|–|\/|,|;|\(|\))/).map((part) =>
    /[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(part) ? translitWord(part) : part,
  ).join('');
}
