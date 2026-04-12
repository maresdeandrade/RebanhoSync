const fs = require('fs');
const file = 'src/pages/AnimalEditar.tsx';
let data = fs.readFileSync(file, 'utf8');

// The marker where we will inject the useLiveQuery
const targetMarker = 'const lotes = useLotes(animal?.fazenda_id);';

const newQuery = `const lotes = useLotes(animal?.fazenda_id);

  const temCriaRecente = useLiveQuery(async () => {
    if (!animal?.id) return false;
    const crias = await db.state_animais
      .where("mae_id")
      .equals(animal.id)
      .filter((a) => !a.deleted_at)
      .toArray();
      
    const umAnoAtras = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return crias.some((c) => {
      if (!c.data_nascimento) return true; // se nao tem data, por precaucao consideramos vinculo valido
      return new Date(c.data_nascimento).getTime() > umAnoAtras;
    });
  }, [animal?.id]) ?? false;

  const dataUltimoParto = animal?.payload?.data_ultimo_parto;
  let tevePartoRecente = false;
  if (dataUltimoParto) {
    const umAnoAtras = Date.now() - 365 * 24 * 60 * 60 * 1000;
    tevePartoRecente = new Date(dataUltimoParto).getTime() > umAnoAtras;
  }
  
  const isLactationEligible = (tevePartoRecente || temCriaRecente || animal?.payload?.em_lactacao === true);
`;

data = data.replace(targetMarker, newQuery);

// Replace the condition area
data = data.replace(
  /\{sexo === "F" && \(\s*(<div className="grid grid-cols-1 gap-4 md:grid-cols-2">)/g,
  `{sexo === "F" && isLactationEligible && (\n            $1`
);

fs.writeFileSync(file, data);
console.log('Script concluded.');
