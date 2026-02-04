import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Animais = () => {
  const [search, setSearch] = useState("");
  
  const animais = useLiveQuery(async () => {
    let query = db.state_animais.toCollection();
    if (search) {
      return db.state_animais.filter(a => a.identificacao.toLowerCase().includes(search.toLowerCase())).toArray();
    }
    return query.toArray();
  }, [search]);

  const lotes = useLiveQuery(() => db.state_lotes.toArray());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Rebanho</h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar identificação..." 
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
          <Link to="/registrar">
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Manejo</Button>
          </Link>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">Identificação</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {animais?.map((animal) => (
              <TableRow key={animal.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-bold">{animal.identificacao}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={animal.sexo === 'M' ? 'text-blue-600' : 'text-pink-600'}>
                    {animal.sexo === 'M' ? 'Macho' : 'Fêmea'}
                  </Badge>
                </TableCell>
                <TableCell>{lotes?.find(l => l.id === animal.lote_id)?.nome || '-'}</TableCell>
                <TableCell>
                  <Badge className={animal.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : ''}>
                    {animal.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/animais/${animal.id}`}>
                    <Button variant="ghost" size="sm">Ver <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Animais;