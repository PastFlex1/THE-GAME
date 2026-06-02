"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent } from '@/components/ui/card';
import { 
  History, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User, 
  Building2,
  ArrowRightLeft,
  ArrowRight,
  Filter,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, onSnapshot } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getEcuadorDate } from '@/lib/utils';

export default function GlobalMovementsPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isOwner = resolvedIdentification === '1793221927' || userProfile?.roleId === 'OWNER';
  const myBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isOwner) return query(collection(firestore, 'branches'));
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isOwner]);
  const { data: branches } = useCollection(branchesQuery);

  const movementsQuery = useMemoFirebase(() => {
    if (!firestore || loadingProfile) return null;
    const baseCol = collection(firestore, 'inventory_movements');
    
    if (isOwner) {
      return query(baseCol, limit(1500));
    }
    
    if (myBranchIds.length > 0 && myBranchIds.length <= 30) {
      return query(baseCol, where('branchId', 'in', myBranchIds), limit(1500));
    }
    
    return query(baseCol, where('branchId', '==', 'none'));
  }, [firestore, isOwner, myBranchIds, loadingProfile, companyId]);
  
  const { data: baseRawMovements, isLoading: baseLoading } = useCollection(movementsQuery);

  const [multiChunkData, setMultiChunkData] = useState<any[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);

  useEffect(() => {
    if (!firestore || loadingProfile || isOwner || myBranchIds.length <= 30) return;
    
    setMultiLoading(true);
    const unsubs: any[] = [];
    const combinedData: Record<string, any> = {};
    let activeChunks = 0;

    const chunks = [];
    for (let i = 0; i < myBranchIds.length; i += 30) {
      chunks.push(myBranchIds.slice(i, i + 30));
    }
    activeChunks = chunks.length;

    chunks.forEach(chunk => {
      const q = query(collection(firestore, 'inventory_movements'), where('branchId', 'in', chunk));
      const sub = onSnapshot(q, (snap: any) => {
        snap.docChanges().forEach((change: any) => {
           if (change.type === 'removed') {
             delete combinedData[change.doc.id];
           } else {
             combinedData[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
           }
        });
        setMultiChunkData(Object.values(combinedData));
        setMultiLoading(false);
      });
      unsubs.push(sub);
    });

    return () => unsubs.forEach(u => u());
  }, [firestore, myBranchIds, isOwner, loadingProfile]);

  const rawMovements = (myBranchIds.length > 30 && !isOwner) ? multiChunkData : baseRawMovements;
  const isLoading = (myBranchIds.length > 30 && !isOwner) ? multiLoading : baseLoading;

  const normalizeText = (str: string) => {
    return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredMovements = useMemo(() => {
    if (!rawMovements) return [];

    const isMatrizId = (id: string) => {
      if (id === 'matrix' || id === 'matriz' || id === 'none') return true;
      const b = branches?.find(branch => branch.id === id);
      const name = normalizeText(b?.name || '');
      return name.includes('republica') || name.includes('salvador');
    };

    return rawMovements.filter(m => {
      const s = searchTerm.toLowerCase().trim();
      const matchesSearch = !s || 
                            m.productName?.toLowerCase().includes(s) || 
                            m.userName?.toLowerCase().includes(s) ||
                            m.branchName?.toLowerCase().includes(s) ||
                            m.reason?.toLowerCase().includes(s);
      
      const matchesType = typeFilter === 'all' || m.type === typeFilter;
      const matchesBranch = filterBranchId === 'all' || m.branchId === filterBranchId || (isMatrizId(filterBranchId) && isMatrizId(m.branchId));
      
      const mDate = getEcuadorDate(m.createdAt);
      
      let matchesDate = true;
      if (startDate && endDate) {
        matchesDate = mDate >= startDate && mDate <= endDate;
      } else if (startDate) {
        matchesDate = mDate === startDate;
      } else if (endDate) {
        matchesDate = mDate === endDate;
      }
      
      const isAuthorized = isOwner || myBranchIds.includes(m.branchId) || (myBranchIds.some((id: string) => isMatrizId(id)) && isMatrizId(m.branchId));

      return matchesSearch && matchesType && matchesBranch && matchesDate && isAuthorized;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [rawMovements, searchTerm, typeFilter, filterBranchId, startDate, endDate, isOwner, myBranchIds, branches]);

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const paginatedData = filteredMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedBranchName = useMemo(() => {
    if (filterBranchId === 'all') return "Todas las Sedes";
    return branches?.find(b => b.id === filterBranchId)?.name || "Sucursal";
  }, [filterBranchId, branches]);

  return (
    <DashboardShell>
      <div className="space-y-6 md:space-y-10 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-1">
              <Badge className="bg-black text-white rounded-full font-black text-[9px] uppercase px-3 py-1 tracking-widest">
                {isOwner ? 'AUDITORÍA GLOBAL' : 'AUDITORÍA DE MI SEDE'}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Historial de Movimientos</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Registro maestro de entradas, salidas y transferencias en red.</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Input 
              type="date" 
              className="h-11 w-full sm:w-40 bg-slate-50 border-none rounded-xl font-bold text-xs" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
            />
            <ArrowRight className="hidden sm:block w-4 h-4 text-slate-200" />
            <Input 
              type="date" 
              className="h-11 w-full sm:w-40 bg-slate-50 border-none rounded-xl font-bold text-xs" 
              value={endDate} 
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
            />
          </div>
          
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input 
              placeholder="Buscar por producto, sede o motivo..." 
              className="h-11 bg-slate-50 border-none rounded-xl pl-12 font-bold text-sm" 
              value={searchTerm} 
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {(isOwner || myBranchIds.length > 0) && (
              <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 bg-slate-50 border-none rounded-xl font-bold min-w-[200px] justify-between shadow-sm">
                    <div className="flex items-center gap-2 max-w-[150px]">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate uppercase text-[10px] md:text-xs">{selectedBranchName}</span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform shrink-0", isBranchMenuOpen && "rotate-180")} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                  <div className="p-3 border-b border-slate-50 bg-white">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                      <Input placeholder="Filtrar sedes..." className="h-9 bg-slate-50 border-none rounded-xl pl-9 text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} />
                    </div>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="p-2 space-y-1">
                      <button onClick={() => { setFilterBranchId('all'); setIsBranchMenuOpen(false); setCurrentPage(1); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold transition-colors text-left", filterBranchId === 'all' ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>Todas las Sedes {filterBranchId === 'all' && <Check className="w-3.5 h-3.5" />}</button>
                      {(branches || []).filter(b => isOwner || myBranchIds.includes(b.id)).filter(b => normalizeText(b.name).includes(normalizeText(branchSearchInput))).map(b => (
                        <button key={b.id} onClick={() => { setFilterBranchId(b.id); setIsBranchMenuOpen(false); setCurrentPage(1); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold transition-colors text-left", filterBranchId === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>
                          <span className="truncate pr-2 uppercase">{b.name}</span>
                          {filterBranchId === b.id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold w-full sm:w-32 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all">Ver Todos</SelectItem>
                <SelectItem value="IN">Entradas (+)</SelectItem>
                <SelectItem value="OUT">Salidas (-)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="w-10 h-10 animate-spin text-slate-100" /><p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Sincronizando Auditoría...</p></div>
            ) : filteredMovements.length === 0 ? (
              <div className="text-center py-24 text-slate-300 font-bold italic">No hay movimientos registrados para esta selección.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-50">
                        <th className="p-8 font-black uppercase tracking-widest text-[10px]">Fecha / Hora</th>
                        <th className="p-8 font-black uppercase tracking-widest text-[10px]">Producto</th>
                        <th className="p-8 font-black uppercase tracking-widest text-center text-[10px]">Tipo</th>
                        <th className="p-8 font-black uppercase tracking-widest text-right text-[10px]">Cant.</th>
                        <th className="p-8 font-black uppercase tracking-widest text-[10px]">Sede / Punto</th>
                        <th className="p-8 font-black uppercase tracking-widest text-[10px]">Responsable</th>
                        <th className="p-8 font-black uppercase tracking-widest text-[10px]">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedData.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{new Date(m.createdAt).toLocaleDateString()}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-black">{new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </td>
                          <td className="p-8 py-6 font-black text-slate-700 uppercase">{m.productName}</td>
                          <td className="p-8 py-6 text-center">
                            <Badge className={cn("border-none text-[8px] font-black uppercase px-2 py-0.5", m.type === 'IN' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                              {m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                            </Badge>
                          </td>
                          <td className={cn("p-8 py-6 text-right font-black text-sm", m.type === 'IN' ? "text-green-600" : "text-red-600")}>
                            {m.type === 'IN' ? '+' : '-'}{m.quantity}
                          </td>
                          <td className="p-8 py-6 font-bold text-slate-600 uppercase text-[10px]">{m.branchName}</td>
                          <td className="p-8 py-6 font-black text-slate-400 uppercase text-[9px]">{m.userName}</td>
                          <td className="p-8 py-6 text-slate-400 font-medium italic truncate max-w-[200px]">"{m.reason}"</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-slate-50">
                  {paginatedData.map((m) => (
                    <div key={m.id} className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("border-none text-[8px] font-black uppercase px-2 py-0.5", m.type === 'IN' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                              {m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <span className="font-black text-slate-900 text-sm uppercase block leading-tight pt-1">{m.productName}</span>
                        </div>
                        <div className={cn("text-right font-black text-lg", m.type === 'IN' ? "text-green-600" : "text-red-600")}>
                          {m.type === 'IN' ? '+' : '-'}{m.quantity}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1"><Building2 className="w-2.5 h-2.5" /> Sede</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{m.branchName}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1"><User className="w-2.5 h-2.5" /> Responsable</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{m.userName}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center gap-2 mb-1">
                          <Info className="w-3 h-3 text-slate-300" />
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Motivo de Auditoría</span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">"{m.reason}"</p>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="p-6 md:p-8 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:block">Página {currentPage} de {totalPages}</p>
                    <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="rounded-xl h-10 w-10 bg-white"><ChevronLeft className="w-4 h-4" /></Button>
                      <div className="flex items-center px-6 text-xs font-black bg-slate-50 rounded-xl">{currentPage} / {totalPages}</div>
                      <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="rounded-xl h-10 w-10 bg-white"><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
