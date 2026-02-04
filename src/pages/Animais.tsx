import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const Animais = () => {
  const [search, setSearch] = useState("");
  
  const animais = useLiveQuery(async () => {
    if (search) {
      return db.state_animais.filter(a => a.identificacao.toLowerCase().includes(search.toLowerCase())).toArray();
    }
    return db.state_animais.toArray();
  }, [search]);

  const lotes = useLiveQuery(() => db.state_lotes.toArray());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Animais</h1>
        <Link to="/registrar">
          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo</Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por identificação..." 
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {animais?.map((animal) => (
              <TableRow key={animal.id}>
                <TableCell className="font-medium">{animal.identificacao}</TableCell>
                <TableCell>
                  {animal.lote_id ? (
                    lotes?.find(l => l.id === animal.lote_id)?.nome || 'Carregando...'
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Sem lote</span>
                  )}
                </TableCell>
                <TableCell><Badge variant="outline">{animal.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link to={`/animais/${animal.id}`}>
                    <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
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