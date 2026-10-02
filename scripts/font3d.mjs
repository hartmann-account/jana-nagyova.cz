// Converts the glyphs needed for the 3D name into the JSON format of three.js' FontLoader.
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';

export function font3d(file, chars) {
  const buf = readFileSync(file);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72);
  const glyphs = {};
  for (const ch of new Set(chars)) {
    const g = font.charToGlyph(ch);
    if (!g || !g.unicode) throw new Error(`glyph missing in font: ${ch}`);
    // glyph.path is in font units with y up, same as the typeface format; only rescale
    const p = (v) => Math.round(v * scale);
    const o = g.path.commands.map((c) => {
      switch (c.type) {
        case 'M': return `m ${p(c.x)} ${p(c.y)}`;
        case 'L': return `l ${p(c.x)} ${p(c.y)}`;
        case 'Q': return `q ${p(c.x)} ${p(c.y)} ${p(c.x1)} ${p(c.y1)}`;
        case 'C': return `b ${p(c.x)} ${p(c.y)} ${p(c.x1)} ${p(c.y1)} ${p(c.x2)} ${p(c.y2)}`;
        default: return '';
      }
    }).filter(Boolean).join(' ');
    glyphs[ch] = { ha: Math.round(g.advanceWidth * scale), x_min: Math.round((g.xMin ?? 0) * scale), x_max: Math.round((g.xMax ?? 0) * scale), o };
  }
  return {
    glyphs,
    familyName: font.names.fontFamily?.en || 'font',
    ascender: Math.round(font.ascender * scale),
    descender: Math.round(font.descender * scale),
    underlinePosition: 0, underlineThickness: 0,
    boundingBox: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
    resolution: 1000,
    original_font_information: { format: 0 },
  };
}
