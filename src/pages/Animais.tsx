import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ChevronRight, FilterX } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";

const Animais = () => {
  const [search, setSearch] = useState("");
  const [loteFilter, setLoteFilter] = useState<string>("all");
  
  // P1.2 FIX: Debounce search to avoid query on every keystroke
  const debouncedSearch = useDebouncedValue(search, 300);
  
  // P2.4 FIX: Use centralized useLotes hook
  const lotes = useLotes();

  // P1.1 FIX: Pre-compute Map for O(n) lookup instead of O(n²)
  const lotesMap = useMemo(() => 
    new Map(lotes?.map(l => [l.id, l])),
    [lotes]
  );

  const animais = useLiveQuery(async () => {
    let collection = db.state_animais.toCollection();
    
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      collection = collection.filter(a => a.identificacao.toLowerCase().includes(searchLower));
    }

    let results = await collection.toArray();

    if (loteFilter === "none") {
      results = results.filter(a => !a.lote_id);
    } else if (loteFilter !== "all") {
      results = results.filter(a => a.lote_id === loteFilter);
    }

    return results;
  }, [debouncedSearch, loteFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Animais</h1>
        <Link to="/animais/novo">
          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Novo</Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por identificação..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por Lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Lotes</SelectItem>
              <SelectItem value="none">Sem Lote</SelectItem>
              {lotes?.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || loteFilter !== "all") && (
            <Button variant="ghost" size="icon" onClick={() => { setSearch(""); setLoteFilter("all"); }}>
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[150px]">Identificação</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {animais?.map((animal) => (
                <TableRow key={animal.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold">{animal.identificacao}</TableCell>
                  <TableCell>
                    {animal.lote_id ? (
                      <Badge variant="secondary" className="font-normal">
                        {lotesMap.get(animal.lote_id)?.nome || '...'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Sem lote</span>
                    )}
                  </TableCell>
                  <TableCell>{animal.sexo === 'M' ? 'Macho' : 'Fêmea'}</TableCell>
                  <TableCell>
                    <Badge variant={animal.status === 'ativo' ? 'outline' : 'secondary'} className="capitalize">
                      {animal.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/animais/${animal.id}`}>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {animais?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum animal encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Animais;