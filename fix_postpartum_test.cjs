const fs = require('fs');
const file = 'src/lib/reproduction/__tests__/postPartum.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('expect(result.ops).toHaveLength(15);', 'expect(result.ops).toHaveLength(19);');

const replacement = `
    const firstAnimalUpdate = result.ops.find(op => op.table === "animais" && op.record.id === "cria-1");
    expect(firstAnimalUpdate).toMatchObject({
`;

content = content.replace(`    expect(result.ops[0]).toMatchObject({`, replacement);
content = content.replace(`    expect(result.ops[0]?.record.payload.neonatal_setup).toMatchObject({`, `    expect(firstAnimalUpdate?.record.payload.neonatal_setup).toMatchObject({`);

const pesagemEventReplacement = `
    const pesagemEvent = result.ops.find(op => op.table === "eventos" && op.record.dominio === "pesagem" && op.record.animal_id === "cria-1");
    expect(pesagemEvent).toMatchObject({
`;
content = content.replace(`    expect(result.ops[1]).toMatchObject({`, pesagemEventReplacement);

const pesagemDetailsReplacement = `
    const pesagemDetails = result.ops.find(op => op.table === "eventos_pesagem" && op.action === "INSERT");
    expect(pesagemDetails).toMatchObject({
`;
content = content.replace(`    expect(result.ops[2]).toMatchObject({`, pesagemDetailsReplacement);

const sanitarioEventReplacement = `
    const sanitarioEvent = result.ops.find(op => op.table === "eventos" && op.record.dominio === "sanitario" && op.record.animal_id === "cria-1");
    expect(sanitarioEvent).toMatchObject({
`;
content = content.replace(`    expect(result.ops[3]).toMatchObject({`, sanitarioEventReplacement);

const sanitarioDetailsReplacement = `
    const sanitarioDetails = result.ops.find(op => op.table === "eventos_sanitario" && op.action === "INSERT");
    expect(sanitarioDetails).toMatchObject({
`;
content = content.replace(`    expect(result.ops[4]).toMatchObject({`, sanitarioDetailsReplacement);

fs.writeFileSync(file, content);
