const fs = require('fs');
const file = 'src/components/events/ReproductionForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the "Vinculo com servico" box
const vinculoBoxRegex = /\{data\.tipo === "diagnostico" \|\| data\.tipo === "parto" \? \([\s\S]*?\) : null\}/;
content = content.replace(vinculoBoxRegex, '');

// 2. Update the buttons to automatically inject "auto_last_open_service"
// Replace `episodeLinkMethod: undefined` with `episodeLinkMethod: "auto_last_open_service"` ONLY for diagnostico and parto.
content = content.replace(
  /tipo: "diagnostico",\s*episodeEventoId: null,\s*episodeLinkMethod: undefined,/g,
  'tipo: "diagnostico", episodeEventoId: null, episodeLinkMethod: "auto_last_open_service",'
);

content = content.replace(
  /tipo: "parto",\s*episodeEventoId: null,\s*episodeLinkMethod: undefined,/g,
  'tipo: "parto", episodeEventoId: null, episodeLinkMethod: "auto_last_open_service",'
);

fs.writeFileSync(file, content);
console.log('Script concluded.');
