const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const base = path.join(__dirname, '..');
const name = '41. Пилон в осях 2.6_Бс-Вс.xlsm';
const filePath = path.join(base, name);
if (!fs.existsSync(filePath)) {
  console.log('Not found:', filePath);
  process.exit(1);
}
const workbook = XLSX.readFile(filePath, { cellFormula: true });

console.log('Sheets:', workbook.SheetNames.join(', '));

['Продавливание', 'Усилия'].forEach(sheetName => {
  if (!workbook.SheetNames.includes(sheetName)) return;
  console.log('\n=== ', sheetName, ' ===\n');
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 120); R++) {
    let row = [];
    for (let C = range.s.c; C <= Math.min(range.e.c, range.s.c + 30); C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = cell && (cell.f ? '=' + cell.f : cell.v !== undefined ? cell.v : '');
      row.push(val);
    }
    console.log(row.join('\t'));
  }
  if (range.e.r > range.s.r + 120) console.log('...');
});
