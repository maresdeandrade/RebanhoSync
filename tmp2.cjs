const fs = require('fs');
const file = 'src/pages/AnimalEditar.tsx';
let data = fs.readFileSync(file, 'utf8');

// 1. Remove lote selection field and replace with a Read-Only Input
data = data.replace(
  /<div className="space-y-2">\s*<Label>Lote \(Opcional\)<\/Label>\s*<Select value={loteId} onValueChange={setLoteId}>[\s\S]*?<\/Select>\s*<\/div>/g,
  `<div className="space-y-2">
            <Label>Lote</Label>
            <Input 
              value={lotes?.find((l) => l.id === loteId)?.nome ?? "Sem lote"} 
              disabled 
            />
            <p className="text-xs text-muted-foreground mt-1">Para alterar o lote, utilize o recurso de Movimentação do Animal.</p>
          </div>`
);

// 2. Hide Puberdade Confirmada if age < 8 months
data = data.replace(
  /<div className="space-y-2">\s*<Label>Puberdade confirmada<\/Label>\s*<Select\s*value={puberdadeConfirmada}\s*onValueChange={\(value: "null" \| "true" \| "false"\) =>\s*setPuberdadeConfirmada\(value\)\s*}\s*>\s*<SelectTrigger>\s*<SelectValue placeholder="Nao informado" \/>\s*<\/SelectTrigger>\s*<SelectContent>\s*<SelectItem value="null">Nao informado<\/SelectItem>\s*<SelectItem value="true">Sim<\/SelectItem>\s*<SelectItem value="false">Nao<\/SelectItem>\s*<\/SelectContent>\s*<\/Select>\s*<\/div>/g,
  `{(idadeMeses === null || idadeMeses >= 8) && (
          <div className="space-y-2">
            <Label>Puberdade confirmada</Label>
            <Select
              value={puberdadeConfirmada}
              onValueChange={(value: "null" | "true" | "false") =>
                setPuberdadeConfirmada(value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nao informado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nao informado</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}`
);

// 3. Hide Lactacao / Secagem if age < 18 months
data = data.replace(
  /\{sexo === "F" && \(\s*<div className="grid grid-cols-1 gap-4 md:grid-cols-2">[\s\S]*?<\/div>\s*\)\}/g,
  `{sexo === "F" && (idadeMeses === null || idadeMeses >= 18) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Em lactação</Label>
                <Select
                  value={emLactacao}
                  onValueChange={(value: "null" | "true" | "false") =>
                    setEmLactacao(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nao informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Nao informado</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Nao</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Secagem realizada</Label>
                <Select
                  value={secagemRealizada}
                  onValueChange={handleSecagemRealizadaChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nao informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Nao informado</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Nao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}`
);

// 4. Remove Lote logic from handleSave
data = data.replace(
  /const novoLoteId.*?\n.*?const loteAtualId.*?\n.*?const loteChanged.*?\n\n.*?if \(loteChanged && novoLoteId === null\) \{[\s\S]*?return;\n\s*\}/g,
  `// Lote alterado removido (read-only na UI)
    const novoLoteId = animal.lote_id ?? null;`
);

data = data.replace(
  /if \(loteChanged\) \{[\s\S]*?ops\.push\(\.\.\.built\.ops\);\n\s*animalUpdateRecord\.lote_id = novoLoteId;\n\s*\}/g,
  `animalUpdateRecord.lote_id = novoLoteId;`
);

fs.writeFileSync(file, data);
console.log('Script concluded.');
