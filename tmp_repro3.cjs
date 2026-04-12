const fs = require('fs');
const file = 'src/components/events/ReproductionForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fetch animalObj to know its reproductive status
const queryBlock = 'const machos = useLiveQuery(() => {';
const animalObjQuery = `
  const animalObj = useLiveQuery(() => animalId ? db.state_animais.get(animalId) : null, [animalId]);
  
  const machos = useLiveQuery(() => {`;
if (!content.includes('const animalObj = useLiveQuery(')) {
  content = content.replace(queryBlock, animalObjQuery);
}

// 2. Determine visibility of buttons
// Find the Grid of buttons
const buttonsGridStart = /<div className="grid grid-cols-2 gap-2">/;

// We wrap the groups.
const replacementGrid = `
            {(() => {
              const statusFemea = animalObj?.payload?.status_reprodutivo_femea;
              const hasOpenService = statusFemea === "coberta" || statusFemea === "prenhe";
              
              return (
                <div className="grid grid-cols-2 gap-2">
                  {!hasOpenService && (
                    <>
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
                    </>
                  )}

                  {(hasOpenService || data.tipo === "diagnostico" || data.tipo === "parto") && (
                    <>
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
                    </>
                  )}
                </div>
              );
            })()}`;

// Replace the old button block from `<div className="grid grid-cols-2 gap-2">` to `...{(data.tipo === "cobertura" || data.tipo === "IA") && (`
// Need a precise regex to remove the existing buttons
const buttonsRegex = /<div className="grid grid-cols-2 gap-2">[\s\S]*?<\/div>(\s*\{\(data\.tipo === "cobertura" \|\| data\.tipo === "IA"\))/;

if (content.match(buttonsRegex)) {
  content = content.replace(buttonsRegex, replacementGrid + '$1');
}

// 3. Auto-select "cadastrado_no_rebanho" when machoId is selected
// Add an effect right before the component return
const useEffectMarker = `  const isMachoRequired =`;
const effectToInsert = `  useEffect(() => {
    if (data.tipo === "cobertura" && data.machoId && data.machoId !== "none" && data.reprodutorTag !== "cadastrado_no_rebanho") {
      const timer = setTimeout(() => {
        onChange({ ...data, reprodutorTag: "cadastrado_no_rebanho" });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [data.machoId, data.tipo, data.reprodutorTag, onChange]);

  const isMachoRequired =`;

content = content.replace(useEffectMarker, effectToInsert);

// Make sure `reprodutorTag` uses value from data securely, maybe disabled if machoId is selected.
// Look for `<Select value={data.reprodutorTag || "none"} onValueChange={`
const reproTagSelectRegex = /<Label htmlFor="repro-tag">Registro do reprodutor<\/Label>\s*<Select\s*value=\{data\.reprodutorTag \|\| "none"\}\s*onValueChange=\{[\s\S]*?\}/;
const reproTagReplacement = `<Label htmlFor="repro-tag">Registro do reprodutor</Label>
              <Select
                value={data.reprodutorTag || "none"}
                disabled={!!(data.machoId && data.machoId !== "none")}
                onValueChange={(value) =>
                  updateField("reprodutorTag", value === "none" ? undefined : value)
                }`;

content = content.replace(reproTagSelectRegex, reproTagReplacement);

fs.writeFileSync(file, content);
console.log('Script concluded.');
