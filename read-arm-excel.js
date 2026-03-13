const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const base = path.join(__dirname, '..');
const name = 'Автоматическая_поперечка_).xlsx';
const filePath = path.join(base, name);
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
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 80); R++) {
    let row = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = cell && (cell.f ? '=' + cell.f : cell.v !== undefined ? cell.v : '');
      row.push(val);
    }
    console.log(row.join('\t'));
  }
  if (range.e.r > range.s.r + 80) console.log('...');
});
