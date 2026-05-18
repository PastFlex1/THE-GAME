"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Search, 
  Building2, 
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Download,
  Check,
  ChevronDown,
  Calendar,
  User,
  FileText,
  Clock
} from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, where, limit, onSnapshot } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import { generateBranchDailyReportPDF } from '@/lib/reports-pdf-generator';

export default function UnifiedClosuresPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranchId, setFilterBranchId] = useState<string>('all');
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isOwner = resolvedIdentification === '1793221927' || userProfile?.roleId === 'OWNER';
  const isPayless = userProfile?.isPayless === true;
  const isCashier = userProfile?.roleId === 'CASHIER';
  const myBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isOwner) return query(collection(firestore, 'branches'));
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isOwner]);
  const { data: branches } = useCollection(branchesQuery);

  const normalizeText = (str: string) => {
    return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const getEcuadorDate = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      let d: Date;
      if (typeof dateVal === 'string') d = new Date(dateVal);
      else if (dateVal.seconds) d = new Date(dateVal.seconds * 1000);
      else d = new Date(dateVal);
      const ecDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));
      return ecDate.toISOString().split('T')[0];
    } catch (e) { return ''; }
  };

  const matricesId = useMemo(() => {
    if (!branches) return 'matrix';
    return branches.find(b => {
      const n = normalizeText(b.name);
      return n.includes('republica') || n.includes('salvador');
    })?.id || 'matrix';
  }, [branches]);

  const closuresQuery = useMemoFirebase(() => {
    if (!firestore || loadingProfile) return null;
    const baseCol = collection(firestore, 'cash_closures');
    
    if (isOwner || isPayless) {
       return query(baseCol, limit(2000));
    }
    
    if (isCashier) return query(baseCol, where('cashierId', '==', resolvedIdentification));
    
    if (myBranchIds.length > 0 && myBranchIds.length <= 30) {
      return query(baseCol, where('branchId', 'in', myBranchIds));
    }
    
    return query(baseCol, where('branchId', '==', 'none'));
  }, [firestore, resolvedIdentification, loadingProfile, isOwner, isPayless, isCashier, companyId, myBranchIds]);
  
  const { data: baseRawClosures, isLoading: baseLoadingHistory } = useCollection(closuresQuery);

  const [multiChunkData, setMultiChunkData] = useState<any[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);

  useEffect(() => {
    if (!firestore || loadingProfile || isOwner || isPayless || isCashier || myBranchIds.length <= 30) return;
    
    setMultiLoading(true);
    const unsubs: any[] = [];
    const combinedData: Record<string, any> = {};

    const chunks = [];
    for (let i = 0; i < myBranchIds.length; i += 30) {
      chunks.push(myBranchIds.slice(i, i + 30));
    }

    chunks.forEach(chunk => {
      const q = query(collection(firestore, 'cash_closures'), where('branchId', 'in', chunk));
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
  }, [firestore, myBranchIds, isOwner, isPayless, isCashier, loadingProfile]);

  const rawClosures = (myBranchIds.length > 30 && !isOwner && !isPayless && !isCashier) ? multiChunkData : baseRawClosures;
  const loadingHistory = (myBranchIds.length > 30 && !isOwner && !isPayless && !isCashier) ? multiLoading : baseLoadingHistory;

  const filteredHistory = useMemo(() => {
    if (!rawClosures) return [];
    
    const isMatrizId = (id: string) => 
      id === 'matrix' || 
      id === 'matriz' || 
      id === 'none' || 
      id === matricesId ||
      branches?.find(b => b.id === id)?.name?.toUpperCase().includes('REPUBLICA') ||
      branches?.find(b => b.id === id)?.name?.toUpperCase().includes('SALVADOR');

    let base = rawClosures;
    const s = searchTerm.toLowerCase().trim();

    return base.filter(c => {
      const matchesSearch = !s || 
                           c.cashierName?.toLowerCase().includes(s) || 
                           c.branchName?.toLowerCase().includes(s);
      
      const matchesBranch = filterBranchId === 'all' || c.branchId === filterBranchId || (isMatrizId(filterBranchId) && isMatrizId(c.branchId));
      
      const closureDate = getEcuadorDate(c.createdAt);
      
      let matchesDate = true;
      if (startDate && endDate) {
        matchesDate = closureDate >= startDate && closureDate <= endDate;
      } else if (startDate) {
        matchesDate = closureDate === startDate;
      }
      
      const isAuthorized = isOwner || myBranchIds.includes(c.branchId) || (myBranchIds.some((aid: string) => isMatrizId(aid)) && isMatrizId(c.branchId));

      return matchesSearch && matchesBranch && matchesDate && isAuthorized;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawClosures, searchTerm, filterBranchId, startDate, endDate, isOwner, myBranchIds, matricesId, branches]);

  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handleDownloadSinglePDF = (closure: any) => {
    const branch = branches?.find(b => b.id === closure.branchId);
    generateBranchDailyReportPDF({
      companyName: "THEGAMEEC S.A.S",
      branchName: closure.branchName || branch?.name || "Sucursal Local",
      branchCode: branch?.ptoEmi || "001",
      date: new Date(closure.createdAt).toLocaleDateString('es-ES'),
      responsible: closure.cashierName || "S/N",
      summary: {
        totalSales: closure.totalSales || 0,
        transactionCount: closure.transactionCount || 0
      },
      paymentMethods: {
        cash: closure.cashSales || (closure.totalSales - (closure.cardSales || 0) - (closure.transferSales || 0) - (closure.otherMethods || 0)),
        card: closure.cardSales || 0,
        transfer: closure.transferSales || 0,
        others: closure.otherMethods || 0
      },
      voids: { count: 0, total: 0 },
      productStats: [],
      cashReconciliation: {
        initialFund: 0,
        cashSales: closure.totalExpectedCash || closure.totalSales || 0,
        additionalIncome: 0,
        expenses: 0,
        expectedTotal: closure.totalExpectedCash || closure.totalSales || 0,
        countedTotal: closure.countedCash || 0,
        difference: closure.difference || 0
      }
    });
  };

  const selectedBranchName = filterBranchId === 'all' ? "Todas las Sedes" : branches?.find(b => b.id === filterBranchId)?.name || "Sucursal";

  if (!isOwner && !isPayless && !isCashier && !loadingProfile && myBranchIds.length === 0) {
    return <DashboardShell><div className="text-center py-20">Acceso Restringido</div></DashboardShell>;
  }

  return (
    <DashboardShell>
      <div className="space-y-6 md:space-y-10 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">Historial de Arqueos</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Liquidación de turnos y cumplimiento operativo en red.</p>
          </div>
          {(isOwner || isPayless || myBranchIds.length > 0) && (
            <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 md:h-14 bg-white border-none rounded-2xl font-bold shadow-sm w-full md:min-w-[240px] justify-between">
                  <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" /><span className="truncate uppercase text-xs md:text-sm">{selectedBranchName}</span></div>
                  <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform", isBranchMenuOpen && "rotate-180")} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] md:w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
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
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Input type="date" className="h-11 w-full sm:w-44 bg-slate-50 border-none rounded-xl font-bold text-xs" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} />
            <ArrowRight className="hidden sm:block w-4 h-4 text-slate-200" />
            <Input type="date" className="h-11 w-full sm:w-44 bg-slate-50 border-none rounded-xl font-bold text-xs" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input placeholder="Buscar por cajero o sede..." className="h-11 bg-slate-50 border-none rounded-xl pl-12 font-bold text-sm" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="w-10 h-10 animate-spin text-slate-200" /><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Arqueos...</p></div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-24 text-slate-300 font-bold italic">No hay cierres de caja registrados para esta selección.</div>
            ) : (
              <>
                {/* VISTA ESCRITORIO (TABLA) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-50">
                        <th className="p-8 pb-4 font-black uppercase tracking-widest text-[10px]">Tienda / Punto</th>
                        <th className="p-8 pb-4 font-black uppercase tracking-widest text-center text-[10px]">Fecha de Cierre</th>
                        <th className="p-8 pb-4 font-black uppercase tracking-widest text-[10px]">Ventas de Turno</th>
                        <th className="p-8 pb-4 font-black uppercase tracking-widest text-[10px]">Diferencia</th>
                        <th className="p-8 pb-4 font-black uppercase tracking-widest text-[10px]">Responsable</th>
                        <th className="p-8 pb-4 font-black uppercase tracking-widest text-center text-[10px]">Reporte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedHistory.map((closure) => (
                        <tr key={closure.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-8 py-10 font-bold text-slate-900 uppercase">{closure.branchName}</td>
                          <td className="p-8 py-10 text-center">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{getEcuadorDate(closure.createdAt)}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-black">{new Date(new Date(closure.createdAt).getTime() - 5*3600*1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="p-8 py-10 font-black text-slate-900 text-lg">${(closure.totalSales || 0).toFixed(2)}</td>
                          <td className="p-8 py-10">
                            <Badge className={cn("border-none px-3 py-1 rounded-full text-[10px] font-black", Math.abs(closure.difference || 0) > 5 ? "bg-red-50 text-red-600" : (Math.abs(closure.difference || 0) > 0.01 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"))}>
                              ${closure.difference?.toFixed(2) || '0.00'}
                            </Badge>
                          </td>
                          <td className="p-8 py-10 font-bold text-slate-600 uppercase text-[11px]">{closure.cashierName}</td>
                          <td className="p-8 py-10 text-center">
                            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 bg-slate-50 hover:bg-black hover:text-white transition-all shadow-sm" onClick={() => handleDownloadSinglePDF(closure)}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* VISTA MÓVIL (TARJETAS) */}
                <div className="md:hidden p-4 space-y-4">
                  {paginatedHistory.map((closure) => (
                    <div key={closure.id} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-5 shadow-sm relative overflow-hidden group">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Building2 className="w-3.5 h-3.5" /> {closure.branchName}
                          </span>
                          <div className="flex items-center gap-2 pt-1">
                            <Clock className="w-3 h-3 text-slate-300" />
                            <span className="font-bold text-slate-600 text-xs">{getEcuadorDate(closure.createdAt)}</span>
                          </div>
                        </div>
                        <Badge className={cn("border-none px-3 py-1 rounded-lg text-[9px] font-black uppercase", Math.abs(closure.difference || 0) > 5 ? "bg-red-50 text-red-600" : (Math.abs(closure.difference || 0) > 0.01 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"))}>
                          DIFF: ${closure.difference?.toFixed(2) || '0.00'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Ventas</span>
                          <span className="text-2xl font-black text-slate-900 tracking-tighter">${(closure.totalSales || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="flex flex-col items-end mr-2">
                              <span className="text-[8px] font-black text-slate-300 uppercase">Cajero</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[100px]">{closure.cashierName}</span>
                           </div>
                           <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm" onClick={() => handleDownloadSinglePDF(closure)}>
                             <FileText className="w-5 h-5 text-slate-400" />
                           </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="p-6 md:p-8 border-t border-slate-50 flex items-center justify-between">
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
