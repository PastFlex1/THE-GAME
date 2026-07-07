'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Download, 
  Loader2, 
  ArrowRight,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Check,
  Receipt,
  Package,
  History,
  Calculator,
  LayoutGrid,
  FileDigit,
  User,
  Clock,
  MapPin,
  X,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, where, limit } from 'firebase/firestore';
import { 
  Area, 
  AreaChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { InvoiceRideView } from '@/components/InvoiceRideView';
import { generateConsolidatedAnalyticsPDF } from '@/lib/reports-pdf-generator';
import { useBranchCollection } from '@/hooks/useBranchCollection';

export default function ReportsPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId, isUserLoading } = useUser();
  
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');

  // ESTADOS DE PAGINACIÓN
  const [pageVentas, setPageVentas] = useState(1);
  const [pageArqueos, setPageArqueos] = useState(1);
  const [pageMovimientos, setPageMovimientos] = useState(1);
  const itemsPerPage = 10;

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isSuperAdmin = resolvedIdentification === '1793221927';
  const isOwner = isSuperAdmin || userProfile?.roleId === 'OWNER';
  const myBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || loadingProfile) return null;
    const baseCol = collection(firestore, 'branches');
    if (isSuperAdmin) return query(baseCol);
    return query(baseCol, where('companyId', '==', companyId));
  }, [firestore, companyId, loadingProfile, isSuperAdmin]);
  const { data: allBranches, isLoading: loadingBranches } = useCollection(branchesQuery);

  const normalizeText = (str: string) => {
    return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const matricesId = useMemo(() => {
    if (!allBranches) return null;
    return allBranches.find(b => {
      const n = normalizeText(b.name || '');
      return n.includes('republica') || n.includes('salvador') || n.includes('matriz');
    })?.id || null;
  }, [allBranches]);

  useEffect(() => {
    if (matricesId && !isInitialized) {
      // setSelectedBranch(matricesId); // We now keep it as 'all' by default so multi-branch users can see their aggregates immediately.
      setIsInitialized(true);
    }
  }, [matricesId, isInitialized]);

  // REINICIAR PÁGINAS AL CAMBIAR FILTROS
  useEffect(() => {
    setPageVentas(1);
    setPageArqueos(1);
    setPageMovimientos(1);
  }, [selectedBranch, startDate, endDate, productSearch]);

  const { data: allInvoices, isLoading: loadingInvoices } = useBranchCollection(
    firestore, 'invoices', isOwner, myBranchIds, companyId, loadingProfile, 10000, 10000, isSuperAdmin
  );

  const { data: allClosures, isLoading: loadingClosures } = useBranchCollection(
    firestore, 'cash_closures', isOwner, myBranchIds, companyId, loadingProfile, 10000, 10000, isSuperAdmin
  );

  const { data: allMovements, isLoading: loadingMovements } = useBranchCollection(
    firestore, 'inventory_movements', isOwner, myBranchIds, companyId, loadingProfile, 10000, 10000, isSuperAdmin
  );

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

  const filteredData = useMemo(() => {
    if (!allInvoices) return { stats: { totalSales: 0, count: 0 }, paymentMethods: {}, dailyTrend: [], transactions: [], byProduct: [], closures: [], movements: [] };

    const ps = productSearch.toLowerCase().trim();
    const isMatrizId = (id: string) => {
      if (id === matricesId || id === 'matrix' || id === 'matriz') return true;
      const b = allBranches?.find(branch => branch.id === id);
      return normalizeText(b?.name || '').includes('republica');
    };

    const paymentMap: Record<string, number> = { '01': 0, '16': 0, '19': 0, '20': 0 };
    const trendMap: Record<string, { billed: number, annulled: number }> = {};
    const prodMap: Record<string, { name: string, qty: number, rev: number }> = {};

    const baseFiltered = allInvoices.filter(inv => {
      const invDate = getEcuadorDate(inv.createdAt);
      
      let matchesDate = true;
      if (startDate && endDate) {
        matchesDate = invDate >= startDate && invDate <= endDate;
      } else if (startDate) {
        matchesDate = invDate === startDate;
      }

      const matchesBranch = selectedBranch === 'all' || inv.branchId === selectedBranch || (isMatrizId(selectedBranch) && isMatrizId(inv.branchId));
      let isAuthorized = isOwner || myBranchIds.includes(inv.branchId) || (myBranchIds.some((id: string) => isMatrizId(id)) && isMatrizId(inv.branchId));
      if (userProfile?.roleId === 'CASHIER') {
        isAuthorized = isAuthorized && (inv.cashierId === resolvedIdentification || inv.userId === resolvedIdentification);
      }
      const matchesProduct = !ps || inv.items?.some((item: any) => {
        const n = normalizeText(item.productName || '');
        return n.includes(ps);
      });

      if (matchesDate && matchesBranch && isAuthorized && matchesProduct) {
        if (!trendMap[invDate]) trendMap[invDate] = { billed: 0, annulled: 0 };
        const amt = Number(inv.totalAmount) || 0;

        if (inv.status !== 'CANCELLED') {
          trendMap[invDate].billed += amt;
          if (inv.paymentMethod === '01') paymentMap['01'] += amt;
          else if (inv.paymentMethod === '16') paymentMap['16'] += amt;
          else if (inv.paymentMethod === '19') paymentMap['19'] += amt;
          else if (inv.paymentMethod === '20') paymentMap['20'] += amt;

          inv.items?.forEach((i: any) => {
            let n = (i.productName || 'S/N').toUpperCase();
            
            if (n.includes('LIBRO') || n.includes('ALBUM')) {
              n = 'ALBUM';
            } else if (n.includes('CAJA') && n.includes('50')) {
              n = 'CAJA 50 SOBRES';
            } else if (n.includes('CAJA') && n.includes('100')) {
              n = 'CAJA 100 SOBRES';
            } else if (n.includes('SOBRE')) {
              n = 'SOBRE CROMO';
            } else if (n.includes('CROMO') && !n.includes('SOBRE')) {
              n = 'CROMOS';
            }

            if (!prodMap[n]) prodMap[n] = { name: n, qty: 0, rev: 0 };
            prodMap[n].qty += (i.quantity || 0);
            prodMap[n].rev += (i.lineTotal || 0);
          });
        } else {
          trendMap[invDate].annulled += amt;
        }
        return true;
      }
      return false;
    });

    const dailyTrend = Object.entries(trendMap)
      .map(([date, v]) => ({ date, billed: v.billed, annulled: -v.annulled }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalSales = Object.values(trendMap).reduce((acc, v) => acc + v.billed, 0);
    const count = baseFiltered.filter(inv => inv.status !== 'CANCELLED').length;

    const filteredClosures = (allClosures || []).filter(c => {
      const cDate = getEcuadorDate(c.createdAt);
      const matchesDate = (!startDate || cDate >= startDate) && (!endDate || cDate <= endDate);
      const matchesBranch = selectedBranch === 'all' || c.branchId === selectedBranch || (isMatrizId(selectedBranch) && isMatrizId(c.branchId));
      
      let isAuthorizedClosure = isOwner || myBranchIds.includes(c.branchId) || (myBranchIds.some((aid: string) => isMatrizId(aid)) && isMatrizId(c.branchId));
      if (userProfile?.roleId === 'CASHIER') {
        isAuthorizedClosure = isAuthorizedClosure && c.cashierId === resolvedIdentification;
      }
      
      return matchesDate && matchesBranch && isAuthorizedClosure;
    });

    const filteredMovements = (allMovements || []).filter(m => {
      const mDate = getEcuadorDate(m.createdAt);
      const matchesDate = (!startDate || mDate >= startDate) && (!endDate || mDate <= endDate);
      const matchesBranch = selectedBranch === 'all' || m.branchId === selectedBranch || (isMatrizId(selectedBranch) && isMatrizId(m.branchId));
      const matchesProduct = !ps || normalizeText(m.productName || '').includes(ps);
      
      let isAuthorizedMove = isOwner || myBranchIds.includes(m.branchId) || (myBranchIds.some((aid: string) => isMatrizId(aid)) && isMatrizId(m.branchId));
      if (userProfile?.roleId === 'CASHIER') {
        isAuthorizedMove = isAuthorizedMove && (m.userId === resolvedIdentification || m.cashierId === resolvedIdentification);
      }
      
      return matchesDate && matchesBranch && matchesProduct && isAuthorizedMove;
    });

    return {
      stats: { totalSales, count },
      paymentMethods: paymentMap,
      dailyTrend,
      transactions: baseFiltered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      byProduct: Object.values(prodMap).sort((a, b) => b.rev - a.rev),
      closures: filteredClosures.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      movements: filteredMovements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
  }, [allInvoices, allClosures, allMovements, selectedBranch, startDate, endDate, productSearch, allBranches, matricesId, isOwner, myBranchIds, userProfile, resolvedIdentification]);

  const paginatedVentas = useMemo(() => filteredData.transactions.slice((pageVentas - 1) * itemsPerPage, pageVentas * itemsPerPage), [filteredData.transactions, pageVentas]);
  const totalPagesVentas = Math.ceil(filteredData.transactions.length / itemsPerPage);

  const paginatedArqueos = useMemo(() => filteredData.closures.slice((pageArqueos - 1) * itemsPerPage, pageArqueos * itemsPerPage), [filteredData.closures, pageArqueos]);
  const totalPagesArqueos = Math.ceil(filteredData.closures.length / itemsPerPage);

  const paginatedMovimientos = useMemo(() => filteredData.movements.slice((pageMovimientos - 1) * itemsPerPage, pageMovimientos * itemsPerPage), [filteredData.movements, pageMovimientos]);
  const totalPagesMovimientos = Math.ceil(filteredData.movements.length / itemsPerPage);

  const handleDownloadPDF = () => {
    const branchName = selectedBranch === 'all' ? "Red de Sedes Nacional" : allBranches?.find(b => b.id === selectedBranch)?.name || "Sucursal";
    generateConsolidatedAnalyticsPDF({
      companyName: "THEGAMEEC S.A.S",
      period: startDate && endDate ? `${startDate} - ${endDate}` : (startDate || 'Histórico'),
      branchName: branchName,
      summary: { totalSales: filteredData.stats.totalSales, transactionCount: filteredData.stats.count, avgTicket: filteredData.stats.totalSales / (filteredData.stats.count || 1) },
      paymentMethods: { '01': filteredData.paymentMethods['01'], 'CARDS': (filteredData.paymentMethods['16'] || 0) + (filteredData.paymentMethods['19'] || 0), '20': filteredData.paymentMethods['20'], 'OTHERS': 0 },
      reconciliation: { expected: filteredData.stats.totalSales, counted: filteredData.closures.reduce((acc, c) => acc + (c.countedCash || 0), 0), difference: 0 },
      byBranch: [], byType: [], byProduct: filteredData.byProduct.map(p => ({ name: p.name, quantity: p.qty, revenue: p.rev })),
      transactions: filteredData.transactions, closures: filteredData.closures
    });
  };

  const filteredBranchesList = useMemo(() => {
    if (!allBranches) return [];
    const search = branchSearchInput.trim().toLowerCase();
    const base = isOwner ? allBranches : allBranches.filter(b => myBranchIds.includes(b.id));
    return base
      .filter(b => normalizeText(b.name || '').includes(search))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allBranches, branchSearchInput, isOwner, myBranchIds]);

  if (isUserLoading || loadingInvoices || loadingBranches || loadingProfile || loadingClosures || loadingMovements) {
    return <DashboardShell><div className="flex justify-center py-40"><Loader2 className="animate-spin w-12 h-12 text-slate-200" /></div></DashboardShell>;
  }

  const avgTicket = filteredData.stats.totalSales / (filteredData.stats.count || 1);

  return (
    <DashboardShell>
      <div className="space-y-8 md:space-y-12 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 md:gap-8">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Analítica Ejecutiva</h1>
            <p className="text-slate-500 font-medium text-sm md:text-lg">Consolidado Real vs Auditoría SRI</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 md:gap-4 bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-50">
            <div className="flex items-center gap-2">
              <Input type="date" className="h-10 md:h-11 flex-1 sm:w-36 md:w-40 bg-slate-50 border-none rounded-xl font-bold text-[10px] md:text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <ArrowRight className="w-3 md:w-4 h-3 md:h-4 text-slate-200" />
              <Input type="date" className="h-10 md:h-11 flex-1 sm:w-36 md:w-40 bg-slate-50 border-none rounded-xl font-bold text-[10px] md:text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>

            <div className="relative flex-1 sm:w-48 md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors" />
              <Input placeholder="Filtrar producto..." className="h-10 md:h-11 bg-slate-50 border-none rounded-xl pl-12 font-bold text-[10px] md:text-xs shadow-inner w-full" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 md:h-11 min-w-[180px] md:min-w-[220px] bg-slate-50 border-none rounded-xl font-bold text-[10px] md:text-xs justify-between shadow-sm">
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-3.5 md:w-4 h-3.5 md:h-4 text-slate-400 shrink-0" />
                      <span className="uppercase truncate">{selectedBranch === 'all' ? "Todas las Sedes" : allBranches?.find(b => b.id === selectedBranch)?.name}</span>
                    </div>
                    <ChevronDown className={cn("w-3 md:w-4 h-3 md:h-4 text-slate-300 transition-transform shrink-0", isBranchMenuOpen && "rotate-180")} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                  <div className="p-4 border-b border-slate-50 bg-white">
                    <Input placeholder="Filtrar sede..." className="h-10 bg-slate-50 border-none rounded-xl text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} />
                  </div>
                  <ScrollArea className="h-72">
                    <div className="p-2 space-y-1">
                      <button onClick={() => { setSelectedBranch('all'); setIsBranchMenuOpen(false); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold text-left", selectedBranch === 'all' ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>Todas las Sedes</button>
                      {filteredBranchesList.map(b => (
                        <button key={b.id} onClick={() => { setSelectedBranch(b.id); setIsBranchMenuOpen(false); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold text-left uppercase", selectedBranch === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>
                          <span className="truncate">{b.name}</span>
                          {b.id === matricesId && <Check className="w-3.5 h-3.5 ml-2 text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <Button onClick={handleDownloadPDF} className="h-10 md:h-11 px-4 md:px-6 bg-black text-white rounded-xl font-black text-[9px] md:text-[10px] uppercase gap-2 shadow-lg active:scale-95 transition-all w-full sm:w-auto">
                <Download className="w-3.5 md:w-4 h-3.5 md:h-4" /> PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-6">
          <Card className="col-span-2 md:col-span-1 border-none bg-black text-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl relative overflow-hidden group">
            <p className="text-[9px] md:text-[10px] text-white/40 font-black uppercase mb-2 tracking-[0.1em] md:tracking-[0.2em]">Recaudación</p>
            <h3 className="text-xl md:text-2xl font-black tracking-tighter leading-none">${filteredData.stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </Card>
          
          <Card className="border-none bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border-l-4 border-slate-100">
            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase mb-2 tracking-[0.1em] md:tracking-[0.2em]">Promedio Venta</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-none">${avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </Card>

          <Card className="border-none bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-l-4 border-green-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-3 h-3 md:w-3.5 md:h-3.5 text-green-500" />
              <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">Efectivo (01)</p>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-green-600 leading-none">${(filteredData.paymentMethods['01'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </Card>

          <Card className="border-none bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-l-4 border-blue-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-500" />
              <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">T. Débito (16)</p>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-blue-600 leading-none">${(filteredData.paymentMethods['16'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </Card>

          <Card className="border-none bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-l-4 border-purple-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-500" />
              <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">T. Crédito (19)</p>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-purple-600 leading-none">${(filteredData.paymentMethods['19'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </Card>

          <Card className="border-none bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-l-4 border-amber-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-500" />
              <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">Transf. (20)</p>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-amber-600 leading-none">${(filteredData.paymentMethods['20'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </Card>
        </div>

        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[3rem] bg-white p-6 md:p-12 border border-slate-50 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-4">
            <div>
              <CardTitle className="text-xl md:text-3xl font-black tracking-tight uppercase">Tendencia de Auditoría</CardTitle>
              <p className="text-slate-400 text-xs md:text-sm font-medium">Ventas (altos) vs Anulaciones (bajos).</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <div className="flex items-center gap-2"><div className="w-3 h-1 bg-red-500 rounded-full" /><span className="text-[9px] md:text-[10px] font-black uppercase text-red-500 tracking-widest">Anulaciones</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-1 bg-black rounded-full" /><span className="text-[9px] md:text-[10px] font-black uppercase text-slate-900 tracking-widest">Venta Neta</span></div>
            </div>
          </div>
          <div className="h-[250px] md:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData.dailyTrend}>
                <defs>
                  <linearGradient id="colNetoR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colAnnulledR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} hide={window.innerWidth < 640} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '10px' }} 
                  itemStyle={{ fontWeight: '900', fontSize: '11px' }}
                  labelStyle={{ fontSize: '8px', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                  formatter={(value: number, name: string) => [
                    `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
                    name === 'billed' ? 'Venta Neta' : 'Anulaciones'
                  ]}
                />
                <Area type="monotone" name="billed" dataKey="billed" stroke="#000" strokeWidth={3} fill="url(#colNetoR)" />
                <Area type="monotone" name="annulled" dataKey="annulled" stroke="#ef4444" strokeWidth={2} fill="url(#colAnnulledR)" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[3rem] bg-white p-6 md:p-10 overflow-hidden">
          <div className="flex items-center justify-between mb-8 md:mb-10">
             <CardTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3">
               <Package className="w-5 h-5 md:w-6 md:h-6 text-slate-900" /> Desplazamiento
             </CardTitle>
             <Badge className="bg-slate-50 text-slate-400 border-none font-black text-[8px] md:text-[9px] uppercase px-3 py-1">RANKING</Badge>
          </div>
          <div className="space-y-6 md:space-y-8">
            {filteredData.byProduct.map((p, idx) => {
              const maxRev = Math.max(...filteredData.byProduct.map(x => x.rev), 1);
              return (
                <div key={idx} className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[10px] md:text-[11px] font-black uppercase text-slate-700 truncate flex-1">{p.name}</span>
                    <div className="flex items-center gap-3 md:gap-5 shrink-0">
                      <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.qty} UDS</span>
                      <span className="text-xs md:text-sm font-black text-slate-900 tracking-tighter">${p.rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="h-2 md:h-2.5 w-full bg-slate-50 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-black rounded-full transition-all duration-1000 ease-out" style={{ width: `${(p.rev / maxRev) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {filteredData.byProduct.length === 0 && (
              <div className="py-16 md:py-20 text-center text-slate-300 italic font-bold">Sin datos de venta.</div>
            )}
          </div>
        </Card>

        {/* AUDITORÍA DE VENTAS */}
        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[3rem] bg-white overflow-hidden">
          <div className="p-6 md:p-10 pb-4">
             <CardTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3">
               <Receipt className="w-5 h-5 md:w-6 md:h-6 text-slate-900" /> Ventas
             </CardTitle>
          </div>
          <CardContent className="p-0">
            {/* VISTA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-50">
                  <tr><th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Factura / Fecha</th><th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Cliente</th><th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Estado</th><th className="text-right p-10 pt-0 pb-6 font-black uppercase text-[10px]">Total</th><th className="text-center p-10 pt-0 pb-6 font-black uppercase text-[10px]">Ver</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedVentas.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic font-bold">Sin resultados.</td></tr>
                  ) : paginatedVentas.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="p-10 py-6"><div className="flex flex-col"><span className={cn("font-black text-slate-900", t.status === 'CANCELLED' && "line-through")}>{t.invoiceNumber}</span><span className="text-[10px] text-slate-400 font-bold">{getEcuadorDate(t.createdAt)}</span></div></td>
                      <td className="p-10 py-6 font-bold text-slate-600 uppercase truncate max-w-[150px]">{t.buyerInfo?.razonSocial || 'CONSUMIDOR FINAL'}</td>
                      <td className="p-10 py-6"><Badge className={cn("border-none text-[8px] font-black uppercase px-2 py-0.5", t.status === 'CANCELLED' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>{t.status}</Badge></td>
                      <td className="p-10 py-6 text-right font-black text-slate-900 text-lg">${(t.totalAmount || 0).toFixed(2)}</td>
                      <td className="p-10 py-6 text-center"><Button variant="ghost" size="icon" className="rounded-xl bg-slate-50" onClick={() => setSelectedInvoiceId(t.id)}><Eye className="w-4 h-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* VISTA MÓVIL */}
            <div className="md:hidden divide-y divide-slate-50">
              {paginatedVentas.length === 0 ? (
                <div className="p-10 text-center text-slate-300 italic font-bold">Sin ventas registradas.</div>
              ) : paginatedVentas.map(t => (
                <div key={t.id} className="p-6 flex items-center justify-between group active:bg-slate-50 transition-colors" onClick={() => setSelectedInvoiceId(t.id)}>
                   <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileDigit className="w-3.5 h-3.5 text-slate-400" />
                        <span className={cn("font-black text-slate-900 text-sm", t.status === 'CANCELLED' && "line-through")}>{t.invoiceNumber}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase truncate max-w-[180px]">{t.buyerInfo?.razonSocial || 'CONSUMIDOR FINAL'}</p>
                      <p className="text-[9px] text-slate-400 font-medium">{getEcuadorDate(t.createdAt)}</p>
                   </div>
                   <div className="text-right space-y-2">
                      <p className="font-black text-slate-900 text-base">${(t.totalAmount || 0).toFixed(2)}</p>
                      <Badge className={cn("border-none text-[8px] font-black uppercase px-2 py-0.5", t.status === 'CANCELLED' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>{t.status}</Badge>
                   </div>
                </div>
              ))}
            </div>

            {totalPagesVentas > 1 && (
              <div className="p-6 md:p-8 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:block">Página {pageVentas} de {totalPagesVentas}</p>
                <div className="flex gap-2 w-full sm:w-auto justify-center md:justify-end">
                  <Button variant="outline" size="icon" onClick={() => setPageVentas(prev => Math.max(prev - 1, 1))} disabled={pageVentas === 1} className="rounded-xl h-10 w-10"><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="flex items-center px-4 text-xs font-black bg-slate-50 rounded-xl">{pageVentas}</div>
                  <Button variant="outline" size="icon" onClick={() => setPageVentas(prev => Math.min(prev + 1, totalPagesVentas))} disabled={pageVentas === totalPagesVentas} className="rounded-xl h-10 w-10"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HISTORIAL DE ARQUEOS */}
        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[3rem] bg-white overflow-hidden">
          <div className="p-6 md:p-10 pb-4">
             <CardTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3">
               <History className="w-5 h-5 md:w-6 md:h-6 text-slate-900" /> Arqueos
             </CardTitle>
          </div>
          <CardContent className="p-0">
            {/* VISTA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-50">
                  <tr>
                    <th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Fecha / Hora</th>
                    <th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Cajero</th>
                    <th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Sede</th>
                    <th className="text-right p-10 pt-0 pb-6 font-black uppercase text-[10px]">Ventas</th>
                    <th className="text-right p-10 pt-0 pb-6 font-black uppercase text-[10px]">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedArqueos.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">No hay arqueos.</td></tr>
                  ) : paginatedArqueos.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="p-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900">{getEcuadorDate(c.createdAt)}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{new Date(c.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="p-10 py-6 font-bold text-slate-700 uppercase">{c.cashierName}</td>
                      <td className="p-10 py-6 font-bold text-slate-400 uppercase text-[10px]">{c.branchName}</td>
                      <td className="p-10 py-6 text-right font-black text-slate-900">${(c.totalSales || 0).toFixed(2)}</td>
                      <td className="p-10 py-6 text-right">
                        <Badge className={cn("border-none text-[8px] font-black px-2", Math.abs(c.difference || 0) > 5 ? "bg-red-50 text-red-600" : (Math.abs(c.difference || 0) > 0.01 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"))}>
                          ${(c.difference || 0).toFixed(2)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* VISTA MÓVIL */}
            <div className="md:hidden divide-y divide-slate-50">
               {paginatedArqueos.length === 0 ? (
                 <div className="p-10 text-center text-slate-300 italic font-bold">Sin arqueos registrados.</div>
               ) : paginatedArqueos.map(c => (
                 <div key={c.id} className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                       <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5 text-slate-400" />
                             <span className="font-black text-slate-900 text-sm">{getEcuadorDate(c.createdAt)}</span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><User className="w-3 h-3" /> {c.cashierName}</p>
                       </div>
                       <Badge className={cn("border-none text-[8px] font-black px-2 py-0.5 uppercase", Math.abs(c.difference || 0) > 5 ? "bg-red-50 text-red-600" : (Math.abs(c.difference || 0) > 0.01 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"))}>
                          DIFF: ${(c.difference || 0).toFixed(2)}
                       </Badge>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                       <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase"><MapPin className="w-3 h-3" /> {c.branchName}</div>
                       <p className="font-black text-slate-900 text-sm">${(c.totalSales || 0).toFixed(2)}</p>
                    </div>
                 </div>
               ))}
            </div>

            {totalPagesArqueos > 1 && (
              <div className="p-6 md:p-8 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:block">Página {pageArqueos} de {totalPagesArqueos}</p>
                <div className="flex gap-2 w-full sm:w-auto justify-center md:justify-end">
                  <Button variant="outline" size="icon" onClick={() => setPageArqueos(prev => Math.max(prev - 1, 1))} disabled={pageArqueos === 1} className="rounded-xl h-10 w-10"><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="flex items-center px-4 text-xs font-black bg-slate-50 rounded-xl">{pageArqueos}</div>
                  <Button variant="outline" size="icon" onClick={() => setPageArqueos(prev => Math.min(prev + 1, totalPagesArqueos))} disabled={pageArqueos === totalPagesArqueos} className="rounded-xl h-10 w-10"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HISTORIAL DE MOVIMIENTOS */}
        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[3rem] bg-white overflow-hidden">
          <div className="p-6 md:p-10 pb-4">
             <CardTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3">
               <History className="w-5 h-5 md:w-6 md:h-6 text-slate-900" /> Inventario
             </CardTitle>
          </div>
          <CardContent className="p-0">
            {/* VISTA DESKTOP */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-50">
                  <tr>
                    <th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Fecha</th>
                    <th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Producto</th>
                    <th className="text-center p-10 pt-0 pb-6 font-black uppercase text-[10px]">Tipo</th>
                    <th className="text-right p-10 pt-0 pb-6 font-black uppercase text-[10px]">Cant.</th>
                    <th className="text-left p-10 pt-0 pb-6 font-black uppercase text-[10px]">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedMovimientos.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">Sin movimientos.</td></tr>
                  ) : paginatedMovimientos.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="p-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900">{getEcuadorDate(m.createdAt)}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                      </td>
                      <td className="p-10 py-6 font-black text-slate-700 uppercase">{m.productName}</td>
                      <td className="p-10 py-6 text-center">
                        <Badge className={cn("border-none text-[8px] font-black uppercase", m.type === 'IN' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                          {m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                        </Badge>
                      </td>
                      <td className={cn("p-10 py-6 text-right font-black", m.type === 'IN' ? "text-green-600" : "text-red-600")}>
                        {m.type === 'IN' ? '+' : '-'}{m.quantity}
                      </td>
                      <td className="p-10 py-6 text-slate-400 font-medium truncate max-w-[400px]">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* VISTA MÓVIL */}
            <div className="md:hidden divide-y divide-slate-50">
               {paginatedMovimientos.length === 0 ? (
                 <div className="p-10 text-center text-slate-300 italic font-bold">Sin historial de inventario.</div>
               ) : paginatedMovimientos.map(m => (
                 <div key={m.id} className="p-6 space-y-3">
                    <div className="flex justify-between items-start gap-4">
                       <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase block leading-tight">{m.productName}</span>
                          <p className="text-[9px] text-slate-400 font-medium uppercase">{m.reason}</p>
                       </div>
                       <Badge className={cn("border-none text-[8px] font-black uppercase px-2 py-0.5 shrink-0", m.type === 'IN' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                          {m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                       </Badge>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                       <p className="text-[9px] font-bold text-slate-300 uppercase">{getEcuadorDate(m.createdAt)}</p>
                       <p className={cn("font-black text-base", m.type === 'IN' ? "text-green-600" : "text-red-600")}>
                          {m.type === 'IN' ? '+' : '-'}{m.quantity}
                       </p>
                    </div>
                 </div>
               ))}
            </div>

            {totalPagesMovimientos > 1 && (
              <div className="p-6 md:p-8 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:block">Página {pageMovimientos} de {totalPagesMovimientos}</p>
                <div className="flex gap-2 w-full sm:w-auto justify-center md:justify-end">
                  <Button variant="outline" size="icon" onClick={() => setPageMovimientos(prev => Math.max(prev - 1, 1))} disabled={pageMovimientos === 1} className="rounded-xl h-10 w-10"><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="flex items-center px-4 text-xs font-black bg-slate-50 rounded-xl">{pageMovimientos}</div>
                  <Button variant="outline" size="icon" onClick={() => setPageMovimientos(prev => Math.min(prev + 1, totalPagesMovimientos))} disabled={pageMovimientos === totalPagesMovimientos} className="rounded-xl h-10 w-10"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SHEET DE RIDE (PANTALLA COMPLETA EN MÓVIL) - UNIFICADO CON SECCIÓN FACTURAS */}
      <Sheet open={!!selectedInvoiceId} onOpenChange={o => !o && setSelectedInvoiceId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] border-none p-0 rounded-l-none md:rounded-l-[3.5rem] shadow-2xl overflow-hidden bg-white [&>button]:hidden">
          <div className="h-full flex flex-col">
            <div className="p-6 md:p-10 pb-6 bg-slate-900 text-white relative flex justify-between items-center shrink-0">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <SheetTitle className="text-2xl font-black tracking-tighter uppercase text-white leading-none">Comprobante RIDE</SheetTitle>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1">Sincronización Oficial SRI</p>
                  </div>
                </div>
              </SheetHeader>
              <button onClick={() => setSelectedInvoiceId(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <X className="w-6 h-6 text-white/50" />
              </button>
            </div>
            
            <ScrollArea className="flex-1 bg-slate-100">
              {selectedInvoiceId && (
                <div className="p-4 md:p-10">
                  <InvoiceRideView invoiceId={selectedInvoiceId} />
                </div>
              )}
            </ScrollArea>
            
            <div className="p-6 md:p-10 pt-4 bg-white border-t border-slate-100 mt-auto md:hidden">
               <Button onClick={() => setSelectedInvoiceId(null)} className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest active:scale-95 transition-all">
                 CERRAR VISOR
               </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardShell>
  );
}