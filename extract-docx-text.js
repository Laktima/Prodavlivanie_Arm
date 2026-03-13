const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'temp_docx', 'word', 'document.xml');
const xml = fs.readFileSync(xmlPath, 'utf8');

// Extract all <w:t>...</w:t> content (handle optional attributes and XML entities)
const textRunRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
// Split by paragraphs <w:p> - get content between <w:p> and </w:p>
const paragraphRegex = /<w:p\s[^>]*>([\s\S]*?)<\/w:p>/g;

const paragraphs = [];
let match;
while ((match = paragraphRegex.exec(xml)) !== null) {
  const pContent = match[1];
  let pText = '';
  let tMatch;
  const runRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  while ((tMatch = runRegex.exec(pContent)) !== null) {
    pText += tMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
  paragraphs.push(pText);
}

const fullText = paragraphs.join('\n');
fs.writeFileSync(path.join(__dirname, 'docx-extracted.txt'), fullText, 'utf8');
console.log('Extracted', paragraphs.length, 'paragraphs');
console.log('Length', fullText.length);
// First 3000 chars to check
console.log('---PREVIEW---');
console.log(fullText.substring(0, 3000));
