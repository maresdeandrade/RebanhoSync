const fs = require('fs');
const file = 'src/pages/AnimalEditar.tsx';
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const idx = lines.findIndex(l => l.includes('<Button onClick={handleSave} className="w-full" disabled={isSaving}>'));
if (idx > -1) {
    const insert = [
        '      {role === "owner" && (',
        '        <Card className="border-destructive/50 shadow-sm mb-6">',
        '          <CardHeader>',
        '            <CardTitle className="text-destructive flex items-center">',
        '              <Trash2 className="h-5 w-5 mr-2" />',
        '              Zona de Perigo',
        '            </CardTitle>',
        '            <p className="text-sm text-muted-foreground">',
        '              A exclusão remove este animal dos relatórios, contadores do painel e registros visuais. Para preservar a consistência causal, esta ação aplica um silenciamento permanente (soft-delete).',
        '            </p>',
        '          </CardHeader>',
        '          <CardContent>',
        '            <Button',
        '              variant="destructive"',
        '              onClick={handleDelete}',
        '              disabled={isSaving}',
        '              className="w-full sm:w-auto"',
        '            >',
        '              {isSaving ? (',
        '                <Loader2 className="h-4 w-4 mr-2 animate-spin" />',
        '              ) : (',
        '                <Trash2 className="h-4 w-4 mr-2" />',
        '              )}',
        '              Excluir animal permanentemente',
        '            </Button>',
        '          </CardContent>',
        '        </Card>',
        '      )}',
        ''
    ];
    lines.splice(idx, 0, ...insert);
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Successfully inserted block');
} else {
    console.log('not found');
}
