const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '41. Пилон в осях 2.6_Бс-Вс.xlsm');
if (!fs.existsSync(filePath)) {
  console.log('File not found:', filePath);
  process.exit(1);
}
const workbook = XLSX.readFile(filePath, { cellFormula: true });

console.log('=== Листы ===');
workbook.SheetNames.forEach(n => console.log(n));

workbook.SheetNames.forEach(sheetName => {
  console.log('\n=== Лист:', sheetName, '===');
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  const maxRows = Math.min(range.e.r, range.s.r + 150);
  for (let R = range.s.r; R <= maxRows; R++) {
    let row = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = cell && (cell.f ? '=' + cell.f : cell.v !== undefined ? String(cell.v) : '');
      row.push(val);
    }
    console.log((R + 1) + '\t' + row.join('\t'));
  }
});
