const fs = require('fs');
const file = 'src/components/events/ReproductionForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. IMPORT BUTTON
if (!content.includes('import { Button }')) {
  // Try to insert after Input
  content = content.replace(
    /import { Input } from "@\/components\/ui\/input";/,
    'import { Input } from "@/components/ui/input";\nimport { Button } from "@/components/ui/button";\nimport { cn } from "@/lib/utils";'
  );
}

// 2. MACHO FILTER
content = content.replace(
  /animal\.sexo === "M" &&\s*animal\.status === "ativo" &&\s*\(\!animal\.deleted_at \|\| animal\.deleted_at === null\)/g,
  'animal.sexo === "M" && animal.status === "ativo" && animal.habilitado_monta === true && (!animal.deleted_at || animal.deleted_at === null)'
);

// 3. TIPO SELECTOR (Toggle Buttons + DPP Auto-calc)
const selectRegex = /<Label htmlFor="repro-tipo">Tipo de evento<\/Label>\s*<Select[\s\S]*?<\/SelectContent>\s*<\/Select>/;

const newTipoUI = `<Label className="mb-3 block">Estagio do Ciclo</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={data.tipo === "cobertura" ? "default" : "outline"}
                className={cn("h-auto py-3", data.tipo === "cobertura" && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => {
                  const dpp = new Date(Date.now() + 283 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  onChange({
                    ...data,
                    tipo: "cobertura",
                    episodeEventoId: null,
                    episodeLinkMethod: undefined,
                    dataPrevistaParto: data.dataPrevistaParto || dpp
                  });
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">Cobertura</div>
                  <div className="text-xs opacity-80">(Monta natural)</div>
                </div>
              </Button>

              <Button
                type="button"
                variant={data.tipo === "IA" ? "default" : "outline"}
                className={cn("h-auto py-3", data.tipo === "IA" && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => {
                  const dpp = new Date(Date.now() + 283 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  onChange({
                    ...data,
                    tipo: "IA",
                    episodeEventoId: null,
                    episodeLinkMethod: undefined,
                    dataPrevistaParto: data.dataPrevistaParto || dpp
                  });
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">Inseminacao</div>
                  <div className="text-xs opacity-80">(IA / IATF)</div>
                </div>
              </Button>

              <Button
                type="button"
                variant={data.tipo === "diagnostico" ? "default" : "outline"}
                className="h-auto py-3"
                onClick={() => {
                  onChange({
                    ...data,
                    tipo: "diagnostico",
                    episodeEventoId: null,
                    episodeLinkMethod: undefined,
                  });
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">Diagnostico</div>
                  <div className="text-xs opacity-80">(Toque / US)</div>
                </div>
              </Button>

              <Button
                type="button"
                variant={data.tipo === "parto" ? "default" : "outline"}
                className="h-auto py-3"
                onClick={() => {
                  onChange({
                    ...data,
                    tipo: "parto",
                    episodeEventoId: null,
                    episodeLinkMethod: undefined,
                  });
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">Parto</div>
                  <div className="text-xs opacity-80">(Nascimento)</div>
                </div>
              </Button>
            </div>
            
            {(data.tipo === "cobertura" || data.tipo === "IA") && (
               <div className="mt-3 rounded border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                 <strong>Data Provavel de Parto (DPP):</strong> {data.dataPrevistaParto ? new Date(data.dataPrevistaParto).toLocaleDateString('pt-BR') : 'Calculando...'} (projetada 283 dias)
               </div>
            )}`;

content = content.replace(selectRegex, newTipoUI);

// 4. DEPENDENT OPTIONS - TECNICA
// Let's replace the whole SelectContent map for Tecnica
const tecnicaRegex = /\{REPRODUCTION_TECHNIQUE_OPTIONS\.map\(\(option\) => \([\s\S]*?<\/SelectItem>\s*\)\)\}/;
const newTecnica = `{REPRODUCTION_TECHNIQUE_OPTIONS
                    .filter(opt => {
                       if (data.tipo === "cobertura") return opt.value.includes("monta") || opt.value.includes("repasse");
                       if (data.tipo === "IA") return opt.value.includes("ia") || opt.value.includes("semen");
                       return true;
                    })
                    .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}`;
content = content.replace(tecnicaRegex, newTecnica);

// 5. DEPENDENT OPTIONS - REPRODUTOR TAG
const tagRegex = /\{REPRODUCTION_BULL_REFERENCE_OPTIONS\.map\(\(option\) => \([\s\S]*?<\/SelectItem>\s*\)\)\}/;
const newTag = `{REPRODUCTION_BULL_REFERENCE_OPTIONS
                    .filter(opt => {
                       if (data.tipo === "cobertura") return !opt.value.includes("semen_lote");
                       if (data.tipo === "IA") return opt.value.includes("semen_lote");
                       return true;
                    })
                    .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}`;
content = content.replace(tagRegex, newTag);

fs.writeFileSync(file, content);
console.log('Script concluded.');
