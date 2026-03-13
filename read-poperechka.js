const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const fileName = 'Автоматическая_поперечка_).xlsx';
let filePath = path.join(__dirname, fileName);
if (!fs.existsSync(filePath)) {
  filePath = path.join(__dirname, '..', fileName);
}
if (!fs.existsSync(filePath)) {
  console.log('Not found:', fileName, 'in', __dirname, 'or parent');
  process.exit(1);
}
console.log('Reading:', filePath);
const workbook = XLSX.readFile(filePath, { cellFormula: true });

console.log('Sheets:', workbook.SheetNames.join(', '));

workbook.SheetNames.forEach(sheetName => {
  console.log('\n=== ', sheetName, ' (A1:AC) ===\n');
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  const maxCol = Math.min(28, range.e.c); // AC = column 28
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 80); R++) {
    let row = [];
    for (let C = 0; C <= maxCol; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = '';
      if (cell) {
        if (cell.f) val = '=' + cell.f;
        else if (cell.v !== undefined) val = cell.v;
      }
      row.push(String(val));
    }
    console.log(R + 1, '\t', row.join('\t'));
  }
  if (range.e.r > range.s.r + 80) console.log('...');
});
