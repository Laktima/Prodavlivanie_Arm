const XLSX = require('xlsx');
const path = require('path');

const fs = require('fs');
const inProject = path.join(__dirname, 'Продавливание 2016.xlsx');
const inParent = path.join(__dirname, '..', 'Продавливание 2016.xlsx');
const filePath = fs.existsSync(inProject) ? inProject : inParent;
const workbook = XLSX.readFile(filePath, { cellFormula: true });

console.log('=== Листы ===');
workbook.SheetNames.forEach(name => console.log(name));

workbook.SheetNames.forEach(sheetName => {
  console.log('\n=== Лист:', sheetName, '===');
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    let row = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      let val = '';
      if (cell) {
        if (cell.f) val = '=' + cell.f;
        else if (cell.v !== undefined) val = cell.v;
        else val = '';
      }
      row.push(val);
    }
    console.log(row.join('\t'));
  }
});
