const fs = require('fs');
const file = 'src/pages/AnimalEditar.tsx';
let data = fs.readFileSync(file, 'utf8');

// 1. Puberty Condition
// Previously: {(idadeMeses === null || idadeMeses >= 8) && (
data = data.replace(
  /\{\(idadeMeses === null \|\| idadeMeses >= 8\) && \(\s*(<div className="space-y-2">\s*<Label>Puberdade confirmada<\/Label>)/g,
  `{(idadeMeses === null || (idadeMeses >= 7 && idadeMeses <= 12)) && (\n          $1`
);

// 2. Lactation Condition
// Previously: {sexo === "F" && (idadeMeses === null || idadeMeses >= 18) && (
data = data.replace(
  /\{sexo === "F" && \(idadeMeses === null \|\| idadeMeses >= 18\) && \(\s*(<div className="grid grid-cols-1 gap-4 md:grid-cols-2">)/g,
  `{sexo === "F" && (animal.payload?.data_ultimo_parto != null || animal.payload?.em_lactacao === true) && (\n            $1`
);

fs.writeFileSync(file, data);
console.log('Script concluded.');
