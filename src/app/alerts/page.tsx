"use client";

import React, { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Loader2, 
  Search, 
  MapPin, 
  Filter, 
  Package, 
  ShieldCheck, 
  Boxes, 
  Factory,
  ArrowLeftRight,
  Building2,
  Check,
  Undo2,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, where, writeBatch, getDocs, increment, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function StockAlertsPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'out_any_branch' | 'low_matrix'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [selectedForReturn, setSelectedReturn] = useState<{
    branchId: string,
    branchName: string,
    productId: string,
    productName: string,
    currentStock: number,
    masterId: string,
    sku: string
  } | null>(null);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const normalizeText = (str: string) => {
    return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isSuperAdmin = resolvedIdentification === '1793221927';
  const isOwner = isSuperAdmin || userProfile?.roleId === 'OWNER';

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId || loadingProfile) return null;
    const baseCol = collection(firestore, 'branches');
    if (isSuperAdmin) return query(baseCol);
    return query(baseCol, where('companyId', '==', companyId));
  }, [firestore, companyId, loadingProfile, isSuperAdmin]);
  const { data: branches, isLoading: loadingBranches } = useCollection(branchesQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !companyId || loadingProfile) return null;
    const baseCol = collection(firestore, 'product_services');
    if (isSuperAdmin) return query(baseCol);
    return query(baseCol, where('companyId', '==', companyId));
  }, [firestore, companyId, loadingProfile, isSuperAdmin]);
  const { data: allProducts, isLoading: loadingProducts } = useCollection(productsQuery);

  const matricesId = useMemo(() => {
    if (!branches) return null;
    const matriz = branches.find(b => {
      const n = normalizeText(b.name || '');
      return n.includes('republica') || n.includes('salvador') || n.includes('matriz');
    });
    return matriz?.id || null;
  }, [branches]);

  const allGroupedLines = useMemo(() => {
    if (!allProducts || !branches) return [];
    
    const linesMap: Record<string, { 
      name: string, 
      sku: string, 
      masterId: string,
      matrixStock: number, 
      branches: any[],
      hasOutage: boolean
    }> = {};

    allProducts.forEach(p => {
      const key = p.masterId || `sku-${p.sku}`;
      if (!linesMap[key]) {
        linesMap[key] = {
          name: (p.name || 'SIN NOMBRE').toUpperCase(),
          sku: (p.sku || 'S/N').toUpperCase(),
          masterId: p.masterId || '',
          matrixStock: 0,
          branches: [],
          hasOutage: false
        };
      }

      const stock = Number(p.inventoryLevel) || 0;
      if (p.branchId === matricesId) {
        linesMap[key].matrixStock = stock;
      }
    });

    Object.keys(linesMap).forEach(key => {
      const masterId = linesMap[key].masterId;
      const sku = linesMap[key].sku;

      branches.forEach(bInfo => {
        const prodInBranch = allProducts.find(p => 
          p.branchId === bInfo.id && 
          (p.masterId === masterId || p.sku === sku)
        );

        const stock = prodInBranch ? (Number(prodInBranch.inventoryLevel) || 0) : 0;
        
        linesMap[key].branches.push({
          id: prodInBranch?.id || null,
          branchId: bInfo.id,
          name: bInfo.name,
          stock: stock,
          sku: sku,
          isMatrix: bInfo.id === matricesId
        });

        if (stock === 0) linesMap[key].hasOutage = true;
      });
    });

    return Object.values(linesMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts, branches, matricesId]);

  const filteredData = useMemo(() => {
    return allGroupedLines.filter(g => {
      const s = searchTerm.trim().toLowerCase();
      const matchesSearch = !s || g.name.toLowerCase().includes(s) || g.sku.toLowerCase().includes(s);
      
      let matchesStatus = true;
      if (statusFilter === 'out_any_branch') matchesStatus = g.hasOutage;
      else if (statusFilter === 'low_matrix') matchesStatus = g.matrixStock <= 10;

      return matchesSearch && matchesStatus;
    });
  }, [allGroupedLines, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleReturnToMatriz = async () => {
    if (!matricesId) {
      toast({ variant: "destructive", title: "Falla", description: "No se identificó la sede Matriz." });
      return;
    }
    setIsSubmittingReturn(true);
    try {
      if (!firestore || !selectedForReturn) throw new Error("No hay selección.");
      const qty = parseInt(returnQuantity);
      if (isNaN(qty) || qty <= 0) throw new Error("Cantidad inválida.");
      
      let matrizDoc = null;
      if (selectedForReturn.masterId) {
        const qId = query(collection(firestore, 'product_services'), where('masterId', '==', selectedForReturn.masterId), where('branchId', '==', matricesId), limit(1));
        const snap = await getDocs(qId);
        if (!snap.empty) matrizDoc = snap.docs[0];
      }

      if (!matrizDoc) throw new Error("Producto no existe en Matriz.");

      const batch = writeBatch(firestore);
      const now = new Date().toISOString();
      const userName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin';

      batch.update(doc(firestore, 'product_services', selectedForReturn.productId), { inventoryLevel: increment(-qty), updatedAt: now });
      batch.update(matrizDoc.ref, { inventoryLevel: increment(qty), updatedAt: now });

      const moveOutRef = doc(collection(firestore, 'inventory_movements'));
      batch.set(moveOutRef, {
        productId: selectedForReturn.productId, 
        productName: selectedForReturn.productName, 
        branchId: selectedForReturn.branchId, 
        branchName: selectedForReturn.branchName || 'Sede Origen',
        type: 'OUT', 
        quantity: qty, 
        reason: "RETORNO CORRECTIVO A MATRIZ", 
        createdAt: now, 
        userId: resolvedIdentification, 
        userName
      });

      const moveInRef = doc(collection(firestore, 'inventory_movements'));
      batch.set(moveInRef, {
        productId: matrizDoc.id, 
        productName: selectedForReturn.productName, 
        branchId: matricesId, 
        branchName: "REPUBLICA DEL SALVADOR",
        type: 'IN', 
        quantity: qty, 
        reason: `RECEPCIÓN DESDE ${selectedForReturn.branchName || 'Sucursal'}`, 
        createdAt: now, 
        userId: resolvedIdentification, 
        userName
      });

      await batch.commit();
      toast({ title: "Retorno Exitoso" });
      setIsReturnDialogOpen(false);
      setReturnQuantity('');
      setSelectedReturn(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  if (!isOwner && !loadingProfile) {
    return <DashboardShell><div className="h-[60vh] flex items-center justify-center text-slate-400 font-bold italic">Acceso Reservado</div></DashboardShell>;
  }

  const isLoading = loadingProducts || loadingBranches || loadingProfile;

  return (
    <DashboardShell>
      <div className="space-y-6 md:space-y-10 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Monitor de Existencias</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Control nacional de quiebres en red de {branches?.length || 0} sedes.</p>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex-1">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 mb-2 block">Estado</Label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl"><SelectItem value="all">Todo el Catálogo</SelectItem><SelectItem value="out_any_branch">Agotados en Sucursales</SelectItem><SelectItem value="low_matrix">Bajo Stock Matriz</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex-1 relative pt-6">
            <Search className="absolute left-4 top-[70%] -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input placeholder="Nombre o SKU..." className="h-11 bg-slate-50 border-none rounded-xl pl-12 font-bold" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <div className="flex-1 relative pt-6">
            <Building2 className="absolute left-4 top-[70%] -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input placeholder="Filtrar sucursales..." className="h-11 bg-slate-50 border-none rounded-xl pl-12 font-bold" value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-slate-100" /></div>
          ) : paginatedData.length === 0 ? (
            <div className="text-center py-24 text-slate-300 font-bold italic bg-white rounded-[2rem]">Sin resultados.</div>
          ) : (
            paginatedData.map((group, idx) => {
              const fBranches = group.branches.filter(b => normalizeText(b.name).includes(normalizeText(branchSearch)));
              return (
                <Card key={idx} className={cn("border-none shadow-sm rounded-[2rem] overflow-hidden bg-white border-l-8", group.matrixStock === 0 ? "border-l-red-600" : (group.matrixStock <= 10 ? "border-l-amber-500" : "border-l-green-500"))}>
                  <div className="flex flex-col lg:flex-row">
                    <div className="p-8 lg:w-1/3 bg-slate-50/50 border-r border-slate-100 space-y-6">
                      <div className="flex items-center gap-3">
                         <div className={cn("p-3 rounded-xl text-white", group.matrixStock === 0 ? "bg-red-600" : "bg-slate-900")}><Package className="w-5 h-5" /></div>
                         <div className="flex flex-col"><h3 className="font-black text-slate-900 uppercase leading-none">{group.name}</h3><span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">SKU: {group.sku}</span></div>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                         <p className="text-[9px] font-black uppercase text-slate-400 mb-2">STOCK MATRIZ</p>
                         <span className={cn("text-4xl font-black", group.matrixStock === 0 ? "text-red-600" : "text-slate-900")}>{group.matrixStock} <span className="text-xs text-slate-300">UDS</span></span>
                      </div>
                    </div>
                    <div className="p-8 flex-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-6 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Red de Puntos</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3">
                        {fBranches.map((b, bIdx) => (
                          <div key={bIdx} className={cn("p-4 rounded-2xl border transition-all flex flex-col items-center text-center", b.isMatrix ? "bg-slate-900 text-white border-black" : (b.stock === 0 ? "bg-red-50/30 border-red-100" : "bg-white border-slate-100"))}>
                            <span className={cn("text-[8px] font-black uppercase truncate w-full mb-2", b.isMatrix ? "text-white/60" : "text-slate-400")}>{b.isMatrix ? "★ MATRIZ" : b.name}</span>
                            <span className={cn("text-xl font-black", b.stock === 0 ? "text-red-600" : (b.isMatrix ? "text-white" : "text-slate-700"))}>{b.stock}</span>
                            {!b.isMatrix && b.stock > 0 && b.id && (
                              <Button size="sm" variant="ghost" className="h-7 w-full mt-2 text-[8px] font-black uppercase bg-slate-50 hover:bg-black hover:text-white" onClick={() => { 
                                setSelectedReturn({ 
                                  ...b, 
                                  branchName: b.name, // Aseguramos el mapeo correcto del nombre
                                  productId: b.id, 
                                  productName: group.name, 
                                  currentStock: b.stock, 
                                  masterId: group.masterId 
                                }); 
                                setIsReturnDialogOpen(true); 
                              }}>Retornar</Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white max-w-md">
          <DialogHeader><DialogTitle className="text-2xl font-black uppercase">Retorno Correctivo</DialogTitle></DialogHeader>
          <div className="space-y-6 py-6">
            <div className="p-5 bg-slate-50 rounded-2xl flex justify-between items-center">
               <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Sede</span><span className="font-bold text-slate-900 uppercase text-xs">{selectedForReturn?.branchName}</span></div>
               <ArrowRight className="w-4 h-4 text-slate-300" />
               <div className="flex flex-col items-end"><span className="text-[9px] font-black text-slate-400 uppercase">Destino</span><span className="font-bold text-slate-900 uppercase text-xs">MATRIZ</span></div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Cantidad a devolver</Label>
              <Input type="number" className="h-14 rounded-xl bg-slate-50 border-none font-black text-2xl text-center" value={returnQuantity} onChange={(e) => setReturnQuantity(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleReturnToMatriz} disabled={isSubmittingReturn} className="w-full h-14 bg-black text-white rounded-xl font-black uppercase">{isSubmittingReturn ? <Loader2 className="animate-spin" /> : 'Confirmar Retorno'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
