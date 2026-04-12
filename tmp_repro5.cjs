const fs = require('fs');
const file = 'src/components/events/ReproductionForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// First, make sure to import computeReproStatus
if (!content.includes('import { computeReproStatus }')) {
  // Insert it after `import { Label } from "@/components/ui/label";`
  content = content.replace(
    /import { Label } from "@\/components\/ui\/label";/,
    'import { Label } from "@/components/ui/label";\nimport { computeReproStatus } from "@/lib/reproduction/status";'
  );
}

// Second, rewrite the useLiveQuery for animalObj to instead be for animalReproStatus
const animalObjQueryRegex = /const animalObj = useLiveQuery\(\(\) => animalId \? db\.state_animais\.get\(animalId\) : null, \[animalId\]\);/;

const newReproStatusQuery = `
  const animalReproStatus = useLiveQuery(async () => {
    if (!animalId) return null;
    const services = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .toArray();

    const joined = await Promise.all(
      services.map(async (s) => ({
        ...s,
        details: await db.event_eventos_reproducao.get(s.id),
      }))
    );

    return computeReproStatus(joined);
  }, [animalId]);
`;

content = content.replace(animalObjQueryRegex, newReproStatusQuery);

// Third, fix the hasOpenService logic
const hasOpenServiceRegex = /const statusFemea = animalObj\?\.payload\?\.status_reprodutivo_femea;\s*const hasOpenService = statusFemea === "coberta" \|\| statusFemea === "prenhe";/;

const newHasOpenService = `
              const statusFemea = animalReproStatus?.status;
              const hasOpenService = statusFemea === "SERVIDA" || statusFemea === "PRENHA";
`;

content = content.replace(hasOpenServiceRegex, newHasOpenService);

// Also remove the TypeScript error risk of ReproEventJoined not having some fields correctly
// The `computeReproStatus` expects `ReproEventJoined`. Let's ensure typescript likes it by casting.
// Actually, `joined` without cast might fail. Let's cast it in the query:
content = content.replace(
  /return computeReproStatus\(joined\);/,
  'return computeReproStatus(joined as any);'
);

fs.writeFileSync(file, content);
console.log('Script concluded.');
