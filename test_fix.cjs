const fs = require('fs');
const file = 'src/lib/reproduction/postPartum.ts';
let content = fs.readFileSync(file, 'utf8');

// I made a mistake when doing string replacement before!
// Let's do it properly now.
const match = `        fromLoteId: calf.lote_id,
        toLoteId: draft.loteId,
        applyAnimalStateUpdate: false,`;

const replacement = `        fromLoteId: calf.lote_id,
        toLoteId: draft.loteId,
        allowDestinationNull: true,
        applyAnimalStateUpdate: false,`;

content = content.replace(match, replacement);
fs.writeFileSync(file, content);
