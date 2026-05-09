import fs from 'fs';
import path from 'path';

// Advanced Mojibake Map (handles double/triple encoding)
const MOJIBAKE_MAP = {
  // Triple/Double Mojibake patterns found in ROADMAP.md and others
  'âÂ€Â”': '—',
  'ââ‚¬â€': '—',
  'âÂ€Â': '—', 
  'ÀÂ§': 'ç',
  'ÀÂ£': 'ã',
  'ÀÂ©': 'é',
  'ÀÂª': 'ê',
  'ÀÂ­': 'í',
  'ÀÂ³': 'ó',
  'ÀÂµ': 'õ',
  'ÀÂ´': 'ô',
  'ÀÂº': 'ú',
  'ÀÂ¡': 'á',
  'ÀÂ ': 'à',
  'ÀÂ¢': 'â',
  'Ã€Â': 'À',
  'ÃÂ ': 'Á',
  'ÀÂ': 'Ã', // Base for many double encodings

  // Standard Mojibake (UTF-8 bytes interpreted as ISO-8859-1)
  'Ã§': 'ç',
  'Ã£': 'ã',
  'Ã©': 'é',
  'Ãª': 'ê',
  'Ã­': 'í',
  'Ã³': 'ó',
  'Ãµ': 'õ',
  'Ã´': 'ô',
  'Ãº': 'ú',
  'Ã¡': 'á',
  'Ã ': 'à',
  'Ã¢': 'â',
  'Ã‰': 'É',
  'Ã‡': 'Ç',
  'Ãƒ': 'Ã',
  'ÃŠ': 'Ê',
  'Ã“': 'Ó',
  'Ã•': 'Õ',
  'Ã”': 'Ô',
  'Ãš': 'Ú',
  'Ã‚': 'Â',
  'Ã±': 'ñ',
  'Ã‘': 'Ñ',
  'Ã¼': 'ü',
  'Ãœ': 'Ü',
  
  // Special symbols
  'âœ…': '✅',
  'âœ¨': '✨',
  'âš ï¸': '⚠️',
  'âš ': '⚠️',
  'â Œ': '❌',
  'â†’': '→',
  'â‰ ': '≠',
  'âˆˆ': '∈',
  'â€”': '—',
  'Â­': '', // Soft hyphen
  
  // Catch-all for remaining single-byte mojibake if preceded by Ã or À
  'Ã ': 'À', 
  'À': 'í', // Found in "ConcluÀdo" and "superfÀcie"
};

function fixWithMap(text) {
  let result = text;
  // Sort keys by length descending to replace longer sequences first
  const keys = Object.keys(MOJIBAKE_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    result = result.split(key).join(MOJIBAKE_MAP[key]);
  }
  return result;
}

const docsDir = '.';

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        processDir(fullPath);
      }
    } else if (entry.name.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const fixed = fixWithMap(content);
      if (content !== fixed) {
        fs.writeFileSync(fullPath, fixed, 'utf8');
        console.log(`Fixed ${fullPath}`);
      }
    }
  }
}

processDir(docsDir);
console.log('Done!');
