"use client";

import React, { useMemo, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Calendar as CalendarIcon,
  Download,
  User as UserIcon,
  Scale,
  ArrowRight,
  FileText,
  Search,
  ShoppingCart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { generateBranchDailyReportPDF } from '@/lib/reports-pdf-generator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function CashierReportsPage() {
  const firestore = useFirestore();
  const { resolvedIdentification } = useUser();

  // FECHAS VACÍAS POR DEFECTO PARA ENTRADA MANUAL
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'branches');
  }, [firestore]);
  const { data: branches } = useCollection(branchesQuery);

  const closuresQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification || loadingProfile) return null;
    return query(
      collection(firestore, 'cash_closures'),
      where('cashierId', '==', resolvedIdentification)
    );
  }, [firestore, resolvedIdentification, loadingProfile]);
  const { data: historicalClosures, isLoading: loadingClosures } = useCollection(closuresQuery);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification || loadingProfile) return null;
    return query(
      collection(firestore, 'invoices'),
      where('cashierId', '==', resolvedIdentification)
    );
  }, [firestore, resolvedIdentification, loadingProfile]);
  const { data: myInvoices, isLoading: loadingInvoices } = useCollection(invoicesQuery);

  const allHistoricalSorted = useMemo(() => {
    if (!historicalClosures) return [];
    return [...historicalClosures].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [historicalClosures]);

  const filteredHistoricalClosures = useMemo(() => {
    if (!allHistoricalSorted) return [];
    return allHistoricalSorted.filter(c => {
      const closureDate = c.createdAt?.split('T')[0];
      return (!startDate || closureDate >= startDate) && (!endDate || closureDate <= endDate);
    });
  }, [allHistoricalSorted, startDate, endDate]);

  const filteredInvoices = useMemo(() => {
    if (!myInvoices) return [];
    return myInvoices
      .filter(inv => {
        const date = inv.createdAt?.split('T')[0];
        const inDate = (!startDate || date >= startDate) && (!endDate || date <= endDate);
        const matchesSearch = !invoiceSearch || inv.invoiceNumber?.includes(invoiceSearch) || inv.buyerInfo?.razonSocial?.toLowerCase().includes(invoiceSearch.toLowerCase());
        return inDate && matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myInvoices, startDate, endDate, invoiceSearch]);

  const stats = useMemo(() => {
    if (!myInvoices) return null;

    const lastClosureDate = allHistoricalSorted[0]?.createdAt ? new Date(allHistoricalSorted[0].createdAt) : null;

    const currentShiftInvoices = myInvoices.filter(inv => {
      if (!inv.createdAt) return false;
      const invDate = new Date(inv.createdAt);
      if (lastClosureDate) {
        return invDate > lastClosureDate;
      } else {
        const today = new Date();
        return invDate.toDateString() === today.toDateString();
      }
    });

    const activeInvoices = currentShiftInvoices.filter(inv => inv.status !== 'CANCELLED');
    const total = activeInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const count = activeInvoices.length;

    const methods: Record<string, number> = { '01': 0, 'cards': 0, 'transfer': 0, 'others': 0 };
    activeInvoices.forEach(inv => {
      if (inv.paymentMethod === '01') methods['01'] += inv.totalAmount;
      else if (inv.paymentMethod === '16' || inv.paymentMethod === '19') methods.cards += inv.totalAmount;
      else if (inv.paymentMethod === '20') methods.transfer += inv.totalAmount;
      else methods.others += inv.totalAmount;
    });

    return { total, count, methods, activeInvoices };
  }, [myInvoices, allHistoricalSorted]);

  const handleDownloadPDF = () => {
    if (!stats || !userProfile) return;
    const branch = branches?.find(b => userProfile.associatedBranchIds?.includes(b.id));
    const lastClosure = allHistoricalSorted[0];

    generateBranchDailyReportPDF({
      companyName: "THEGAMEEC S.A.S",
      branchName: branch?.name || "Sucursal Local",
      branchCode: branch?.ptoEmi || "001",
      date: new Date().toLocaleDateString('es-ES'),
      responsible: `${userProfile.firstName} ${userProfile.lastName}`,
      summary: {
        totalSales: stats.total,
        transactionCount: stats.count
      },
      paymentMethods: {
        cash: stats.methods['01'],
        card: stats.methods.cards,
        transfer: stats.methods.transfer,
        others: stats.methods.others
      },
      voids: { count: 0, total: 0 },
      productStats: [],
      cashReconciliation: lastClosure ? {
        initialFund: 0,
        cashSales: lastClosure.totalExpectedCash,
        additionalIncome: 0,
        expenses: 0,
        expectedTotal: lastClosure.totalExpectedCash,
        countedTotal: lastClosure.countedCash,
        difference: lastClosure.difference
      } : undefined
    });
  };

  const handleDownloadHistoricalPDF = (closure: any) => {
    if (!userProfile) return;
    const branch = branches?.find(b => b.id === closure.branchId);

    generateBranchDailyReportPDF({
      companyName: "THEGAMEEC S.A.S",
      branchName: closure.branchName || branch?.name || "Sucursal Local",
      branchCode: branch?.ptoEmi || "002",
      date: new Date(closure.createdAt).toLocaleDateString('es-ES'),
      responsible: closure.cashierName || `${userProfile.firstName} ${userProfile.lastName}`,
      summary: {
        totalSales: closure.totalSales,
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
        cashSales: closure.totalExpectedCash,
        additionalIncome: 0,
        expenses: 0,
        expectedTotal: closure.totalExpectedCash,
        countedTotal: closure.countedCash,
        difference: closure.difference
      }
    });
  };

  const isLoading = loadingClosures || loadingInvoices || loadingProfile;

  return (
    <DashboardShell>
      <div className="space-y-10 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Panel de Mi Turno</h1>
            <div className="flex items-center gap-3">
              <Badge className="bg-black text-white rounded-full font-black text-[9px] uppercase px-3 py-1 tracking-widest">
                PERSONAL
              </Badge>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                <UserIcon className="w-3 h-3" /> Cajero: {userProfile?.firstName} {userProfile?.lastName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 text-slate-400 font-black text-[9px] uppercase tracking-widest border-r border-slate-50">
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Rango</span>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  className="h-9 w-36 bg-slate-50 border-none rounded-xl font-bold text-xs" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
                <ArrowRight className="w-3 h-3 text-slate-200" />
                <Input 
                  type="date" 
                  className="h-9 w-36 bg-slate-50 border-none rounded-xl font-bold text-xs" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
            </div>
            <Button onClick={handleDownloadPDF} className="bg-black text-white hover:bg-slate-800 rounded-2xl h-12 px-8 font-black shadow-xl" disabled={!stats}>
              <Download className="w-5 h-5 mr-2" /> DESCARGAR TURNO
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-slate-200" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-none shadow-sm rounded-[2rem] bg-black text-white p-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Ventas del Turno</p>
                <h3 className="text-4xl font-black tracking-tighter">${stats?.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                <p className="text-[9px] font-bold text-white/20 mt-4 uppercase">Desde el último arqueo</p>
              </Card>
              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Ventas en Efectivo</p>
                <h3 className="text-4xl font-black tracking-tighter text-green-600">${stats?.methods['01'].toFixed(2)}</h3>
              </Card>
              <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Otros Métodos</p>
                <h3 className="text-4xl font-black tracking-tighter text-slate-900">${(stats?.methods.cards + stats?.methods.transfer + stats?.methods.others).toFixed(2)}</h3>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="p-10 pb-4 border-b border-slate-50 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl"><ShoppingCart className="w-6 h-6 text-slate-900" /></div>
                    <div>
                      <CardTitle className="text-2xl font-black tracking-tight">Mi Listado de Ventas</CardTitle>
                      <p className="text-slate-400 text-xs font-medium">Comprobantes emitidos en el período.</p>
                    </div>
                  </div>
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300" />
                    <Input 
                      placeholder="Filtrar ventas..." 
                      className="h-8 bg-slate-50 border-none rounded-lg pl-8 text-[10px] font-bold"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-50 sticky top-0 bg-white z-10">
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px]">Comprobante</th>
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px]">Cliente</th>
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px] text-right">Total</th>
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px] text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredInvoices.map((inv) => (
                          <tr key={inv.id} className="group hover:bg-slate-50/50 transition-all">
                            <td className="p-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900">{inv.invoiceNumber}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(inv.createdAt).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                            </td>
                            <td className="p-6 py-4 font-bold text-slate-600 uppercase truncate max-w-[120px]">{inv.buyerInfo?.razonSocial || 'Consumidor Final'}</td>
                            <td className="p-6 py-4 text-right font-black text-slate-900">${inv.totalAmount.toFixed(2)}</td>
                            <td className="p-6 py-4 text-center">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-black hover:text-white" asChild>
                                <Link href={`/invoices/${inv.id}/ride`} target="_blank"><FileText className="w-3.5 h-3.5" /></Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {filteredInvoices.length === 0 && (
                          <tr><td colSpan={4} className="p-10 text-center text-slate-300 italic font-bold">Sin ventas registradas.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="p-10 pb-4 border-b border-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-slate-50 rounded-2xl"><Scale className="w-6 h-6 text-slate-900" /></div>
                      <div>
                        <CardTitle className="text-2xl font-black tracking-tight">Historial de Turnos Cerrados</CardTitle>
                        <p className="text-slate-400 text-xs font-medium">Consulta tus arqueos filtrados por fecha.</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-50 sticky top-0 bg-white z-10">
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px]">Fecha y Hora</th>
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px] text-center">Ventas</th>
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px] text-right">Diferencia</th>
                          <th className="p-6 py-4 font-black uppercase tracking-widest text-[9px] text-center">Acta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredHistoricalClosures.map((closure) => {
                          const absDiff = Math.abs(closure.difference || 0);
                          return (
                            <tr key={closure.id} className="group hover:bg-slate-50/50 transition-all">
                              <td className="p-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-900">{new Date(closure.createdAt).toLocaleDateString('es-ES')}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(closure.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </td>
                              <td className="p-6 py-4 text-center font-black text-slate-900">${(closure.totalSales || 0).toFixed(2)}</td>
                              <td className="p-6 py-4 text-right">
                                <Badge className={cn("border-none font-black text-[8px] px-2", absDiff > 5 ? "bg-red-50 text-red-600" : (absDiff > 0.01 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"))}>
                                  ${closure.difference?.toFixed(2) || '0.00'}
                                </Badge>
                              </td>
                              <td className="p-6 py-4 text-center">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-black hover:text-white transition-all shadow-sm" onClick={() => handleDownloadHistoricalPDF(closure)}>
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredHistoricalClosures.length === 0 && (
                          <tr><td colSpan={4} className="p-10 text-center text-slate-300 italic font-bold">Sin cierres en el rango.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
