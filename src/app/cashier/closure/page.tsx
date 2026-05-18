
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Receipt,
  Wallet,
  User,
  Building2,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  LayoutGrid,
  Search,
  ChevronRight,
  Check,
  AlertCircle,
  MapPin
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function CashierClosurePage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { resolvedIdentification, logout, companyId } = useUser();
  const [isClosing, setIsClosing] = useState(false);
  
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [branchSearchInput, setBranchSearchInput] = useState('');

  const [formData, setFormData] = useState({
    totalSales: 0,
    expectedCash: 0,
    cardSales: 0,
    transferSales: 0,
    otherMethods: 0,
    countedCash: 0,
    observations: '',
    transactionCount: 0
  });

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile } = useDoc(userDocRef);

  const isOwner = resolvedIdentification === '1793221927' || userProfile?.roleId === 'OWNER';
  const assignedBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);
  const isRegional = userProfile?.isPayless === true || assignedBranchIds.length > 1;

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isOwner) return query(collection(firestore, 'branches'));
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isOwner]);
  const { data: allBranches } = useCollection(branchesQuery);

  useEffect(() => {
    if (!selectedBranchId && allBranches && allBranches.length > 0) {
      if (isOwner) {
        const matriz = allBranches.find(b => b.name?.toUpperCase().includes('REPUBLICA') || b.name?.toUpperCase().includes('SALVADOR'));
        setSelectedBranchId(matriz?.id || allBranches[0].id);
      } else if (assignedBranchIds.length > 0) {
        setSelectedBranchId(assignedBranchIds[0]);
      }
    }
  }, [allBranches, isOwner, assignedBranchIds, selectedBranchId]);

  const currentBranch = useMemo(() => {
    return allBranches?.find(b => b.id === selectedBranchId) || null;
  }, [allBranches, selectedBranchId]);

  const closuresQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return query(collection(firestore, 'cash_closures'), where('cashierId', '==', resolvedIdentification));
  }, [firestore, resolvedIdentification]);
  const { data: closuresData } = useCollection(closuresQuery);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return query(collection(firestore, 'invoices'), where('cashierId', '==', resolvedIdentification));
  }, [firestore, resolvedIdentification]);
  const { data: myInvoices, isLoading } = useCollection(invoicesQuery);

  useEffect(() => {
    if (!myInvoices || !selectedBranchId) return;
    
    const branchClosures = (closuresData || []).filter(c => c.branchId === selectedBranchId);
    const sortedClosures = [...branchClosures].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastBranchClosureDate = sortedClosures[0]?.createdAt ? new Date(sortedClosures[0].createdAt) : null;
    
    const currentShiftInvoices = myInvoices.filter(inv => {
      if (!inv.createdAt || inv.status === 'CANCELLED' || inv.branchId !== selectedBranchId) return false;
      const invoiceDate = new Date(inv.createdAt);
      return lastBranchClosureDate ? invoiceDate > lastBranchClosureDate : invoiceDate >= new Date(new Date().setHours(0,0,0,0));
    });
    
    const total = currentShiftInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const cashTotal = currentShiftInvoices.filter(inv => inv.paymentMethod === '01').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const cardTotal = currentShiftInvoices.filter(inv => inv.paymentMethod === '16' || inv.paymentMethod === '19').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const transferTotal = currentShiftInvoices.filter(inv => inv.paymentMethod === '20').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const others = total - (cashTotal + cardTotal + transferTotal);

    setFormData(prev => ({
      ...prev, totalSales: total, expectedCash: cashTotal, cardSales: cardTotal, 
      transferSales: transferTotal, otherMethods: others, transactionCount: currentShiftInvoices.length, countedCash: 0
    }));
  }, [myInvoices, closuresData, selectedBranchId]);

  const difference = useMemo(() => formData.countedCash - formData.totalSales, [formData.countedCash, formData.totalSales]);

  const statusInfo = useMemo(() => {
    const absDiff = Math.abs(difference);
    if (absDiff < 0.01) return { label: "SISTEMA CUADRADO", color: "bg-green-600", textColor: "text-green-600", bgColor: "bg-green-50", icon: <CheckCircle2 className="w-6 h-6" /> };
    if (absDiff <= 5) return { label: "DESCUADRE LEVE", color: "bg-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50", icon: <AlertTriangle className="w-6 h-6" /> };
    return { label: "DESCUADRE CRÍTICO", color: "bg-red-600", textColor: "text-red-600", bgColor: "bg-red-50", icon: <XCircle className="w-6 h-6" /> };
  }, [difference]);

  const handleFinalClosure = async () => {
    if (!userProfile || !selectedBranchId || !currentBranch) return;
    setIsClosing(true);
    addDocumentNonBlocking(collection(firestore, 'cash_closures'), {
      cashierId: resolvedIdentification, cashierName: `${userProfile.firstName} ${userProfile.lastName}`,
      companyId: companyId || '1793221927001', branchId: selectedBranchId, branchName: currentBranch.name,
      createdAt: new Date().toISOString(), totalSales: formData.totalSales, cashSales: formData.expectedCash,
      cardSales: formData.cardSales, transferSales: formData.transferSales, otherMethods: formData.otherMethods,
      totalExpectedCash: formData.totalSales, countedCash: formData.countedCash, difference,
      observations: formData.observations, statusLabel: statusInfo.label, transactionCount: formData.transactionCount
    });

    setTimeout(() => {
      if (assignedBranchIds.length > 1 || isOwner) {
        setIsClosing(false);
        setFormData(prev => ({ ...prev, observations: '', countedCash: 0 }));
        router.refresh();
      } else {
        logout();
        router.push('/');
      }
    }, 1500);
  };

  const selectableBranches = useMemo(() => {
    if (!allBranches) return [];
    if (isOwner) return allBranches;
    return allBranches.filter(b => assignedBranchIds.includes(b.id));
  }, [allBranches, isOwner, assignedBranchIds]);

  const canSwitchBranch = isOwner || isRegional;

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest px-3 py-1">CIERRE DE TURNO</Badge>
              {canSwitchBranch ? (
                <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 rounded-xl px-4 bg-white border-slate-200 text-[10px] font-black uppercase gap-2 hover:bg-black hover:text-white transition-all shadow-sm">
                      <Building2 className="w-3.5 h-3.5" /> LIQUIDANDO EN: <span className="text-blue-600">{currentBranch?.name || 'SELECCIONAR SEDE'}</span>
                      <ChevronRight className={cn("w-3 h-3 opacity-30 transition-transform", isBranchMenuOpen && "rotate-90")} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
                    <div className="p-3 border-b border-slate-50 bg-white">
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" /><Input placeholder="Buscar sede..." className="h-9 bg-slate-50 border-none rounded-xl pl-9 text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} /></div>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="p-2 space-y-1">
                        {selectableBranches.filter(b => b.name?.toLowerCase().includes(branchSearchInput.toLowerCase())).map(b => (
                          <button key={b.id} onClick={() => { setSelectedBranchId(b.id); setIsBranchMenuOpen(false); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold transition-colors text-left", selectedBranchId === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}><span className="truncate pr-2">{b.name}</span>{selectedBranchId === b.id && <Check className="w-3.5 h-3.5" />}</button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              ) : (
                <Badge className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase px-3 py-1 gap-2"><MapPin className="w-3 h-3" /> CIERRE EN: {currentBranch?.name}</Badge>
              )}
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Cierre de Caja Integral</h1>
            <p className="text-slate-500 font-medium">Cuadre su facturación sumando efectivo, vouchers y transferencias en la sede actual.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!selectedBranchId || formData.transactionCount === 0} className={cn("h-16 rounded-2xl text-white font-black px-12 shadow-2xl transition-all hover:scale-[1.02]", statusInfo.color)}>
                {isClosing ? <Loader2 className="w-5 h-5 animate-spin" /> : "FINALIZAR MI TURNO"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl">
              <AlertDialogHeader>
                <div className="flex flex-col items-center text-center mb-4">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-6", statusInfo.bgColor)}>{statusInfo.icon}</div>
                  <AlertDialogTitle className="text-2xl font-black tracking-tight">¿Confirmar Cierre en {currentBranch?.name}?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-500 font-medium py-2">Estado: <strong className={statusInfo.textColor}>{statusInfo.label}</strong>.<br />Diferencia detectada: <strong className={cn("text-lg", Math.abs(difference) > 5 ? "text-red-600" : (Math.abs(difference) > 0 ? "text-amber-600" : "text-green-600"))}>${difference.toFixed(2)}</strong>.</AlertDialogDescription>
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="h-14 rounded-2xl px-8 font-bold border-slate-100">REVISAR</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinalClosure} className="h-14 rounded-2xl px-8 font-black bg-black text-white">CERRAR Y CONTINUAR</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <Card className="md:col-span-7 border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 pb-4"><Badge className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase px-3 py-1 w-fit mb-2">VENTAS EN: {currentBranch?.name || '...'}</Badge><CardTitle className="text-xl font-black">Resumen por Método de Pago</CardTitle></CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <div className="p-6 bg-slate-900 rounded-3xl border-none shadow-xl shadow-black/10"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Facturado en Sede</span><Receipt className="w-4 h-4 text-slate-500" /></div><h3 className="text-4xl font-black text-white">${formData.totalSales.toFixed(2)}</h3><p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-tighter">{formData.transactionCount} Transacciones procesadas hoy</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-green-50 rounded-2xl border border-green-100"><span className="text-[9px] font-black text-green-600 uppercase block mb-1">Efectivo (01)</span><div className="flex items-center gap-2"><Banknote className="w-4 h-4 text-green-500" /><span className="text-lg font-black text-green-700">${formData.expectedCash.toFixed(2)}</span></div></div>
                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100"><span className="text-[9px] font-black text-blue-600 uppercase block mb-1">Tarjetas (16/19)</span><div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /><span className="text-lg font-black text-blue-700">${formData.cardSales.toFixed(2)}</span></div></div>
                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100"><span className="text-[9px] font-black text-amber-600 uppercase block mb-1">Transferencias (20)</span><div className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-amber-500" /><span className="text-lg font-black text-amber-700">${formData.transferSales.toFixed(2)}</span></div></div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Otros SRI</span><div className="flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-slate-300" /><span className="text-lg font-black text-slate-600">${formData.otherMethods.toFixed(2)}</span></div></div>
              </div>
            </CardContent>
          </Card>
          <div className="md:col-span-5 space-y-8">
            <Card className="border-none shadow-sm rounded-[2.5rem] bg-black text-white overflow-hidden">
              <CardHeader className="p-8 pb-4"><Badge className="bg-white/10 text-white/60 font-black text-[9px] uppercase px-3 py-1 w-fit mb-2">AUDITORÍA FÍSICA EN {currentBranch?.name || '...'}</Badge><CardTitle className="text-xl font-black">Dinero y Comprobantes</CardTitle></CardHeader>
              <CardContent className="p-8 pt-4 space-y-8">
                <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-white/40 tracking-widest">Ingrese el Total Contado para esta sede</Label><div className="relative"><Wallet className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-white/20" /><Input type="number" placeholder="0.00" className="h-24 bg-white/10 border-white/10 rounded-[2rem] pl-16 font-black text-4xl text-white" value={formData.countedCash || ''} onChange={(e) => setFormData({...formData, countedCash: parseFloat(e.target.value) || 0})} /></div></div>
                <div className={cn("p-6 rounded-[1.5rem] flex items-center justify-between transition-all duration-500", statusInfo.bgColor)}><div className="flex items-center gap-4"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", statusInfo.color)}>{statusInfo.icon}</div><div><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diferencia de Sede</p><p className={cn("text-xl font-black", statusInfo.textColor)}>${difference.toFixed(2)}</p></div></div><Badge className={cn("border-none font-black text-[8px] uppercase", statusInfo.color, "text-white")}>{statusInfo.label}</Badge></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
