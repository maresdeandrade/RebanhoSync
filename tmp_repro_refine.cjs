const fs = require('fs');
const file = 'src/components/events/ReproductionForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the block rendering the buttons
// It starts with `{(() => {` and ends with `})()}`
// We'll replace it completely for safety!

const blockStartString = `{(() => {
              
              const statusFemea = animalReproStatus?.status;
              const hasOpenService = statusFemea === "SERVIDA" || statusFemea === "PRENHA";`;

const newBlock = `{(() => {
              const statusFemea = animalReproStatus?.status;
              const showService = !statusFemea || statusFemea !== "SERVIDA" && statusFemea !== "PRENHA";
              const showDiagnostico = statusFemea === "SERVIDA" || statusFemea === "PRENHA" || data.tipo === "diagnostico";
              const showParto = statusFemea === "PRENHA" || data.tipo === "parto";

              return (
                <div className="grid grid-cols-2 gap-2">
                  {showService && (
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
                          <div className="font-semibold">Inseminação</div>
                          <div className="text-xs opacity-80">(IA / IATF)</div>
                        </div>
                      </Button>
                    </>
                  )}

                  {showDiagnostico && (
                    <Button
                      type="button"
                      variant={data.tipo === "diagnostico" ? "default" : "outline"}
                      className="h-auto py-3"
                      onClick={() => {
                        onChange({
                          ...data,
                          tipo: "diagnostico", episodeEventoId: null, episodeLinkMethod: "auto_last_open_service",
                        });
                      }}
                    >
                      <div className="text-left">
                        <div className="font-semibold">Diagnóstico</div>
                        <div className="text-xs opacity-80">(Toque / US)</div>
                      </div>
                    </Button>
                  )}

                  {showParto && (
                    <Button
                      type="button"
                      variant={data.tipo === "parto" ? "default" : "outline"}
                      className="h-auto py-3"
                      onClick={() => {
                        onChange({
                          ...data,
                          tipo: "parto", episodeEventoId: null, episodeLinkMethod: "auto_last_open_service",
                        });
                      }}
                    >
                      <div className="text-left">
                        <div className="font-semibold">Parto</div>
                        <div className="text-xs opacity-80">(Nascimento)</div>
                      </div>
                    </Button>
                  )}
                </div>
              );
            })()}`;

const startIndex = content.indexOf('{(() => {');
const funcCode = content.substring(startIndex);
// Finding the ending '})()}' 
const regexMatch = /\{\(\(\) => \{[\s\S]*?\}\)\(\)\}/m.exec(content);

if (regexMatch) {
  content = content.replace(regexMatch[0], newBlock);
  fs.writeFileSync(file, content);
  console.log("Success");
} else {
  console.error("Could not find the lambda block");
}
