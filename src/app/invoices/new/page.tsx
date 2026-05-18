"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  CheckCircle2, 
  Loader2,
  X,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  ShoppingCart,
  FileDigit,
  Building2,
  ChevronRight,
  ChevronDown,
  Check,
  Save,
  MapPin,
  Minus,
  Plus,
  Percent,
  Package,
  UserX,
  Trash2,
  Mail,
  Phone,
  Navigation
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, increment, orderBy, limit, writeBatch, onSnapshot, getDocs, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { emitirFactura } from '@/app/actions/sri-actions';
import { validateEcuadorianId } from '@/lib/id-validator';
import { generateInvoiceXML } from '@/lib/sri-xml-generator';
import { cn } from '@/lib/utils';

export default function NewInvoicePage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('01');
  const [transferNumber, setTransferNumber] = useState('');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>('002-002-000000001');
  
  const [selectedOverrideBranchId, setSelectedOverrideBranchId] = useState<string | null>(null);
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);

  const FIXED_MATRIZ_ADDRESS = "REPUBLICA DEL SALVADOR N36-110 Y N36 SUECIA - BQ.3 10 06 EDF METRO PLAZA";
  const UNIFIED_ESTAB = "002";
  const UNIFIED_PTO_EMI = "002";

  const [buyerInfo, setBuyerInfo] = useState({ 
    rucOrCedula: '', 
    razonSocial: '', 
    direccion: '', 
    email: '', 
    telefono: '' 
  });

  const [items, setItems] = useState<{ 
    productId: string; 
    quantity: number | ""; 
    price: number; 
    cost: number; 
    productName: string; 
    sku?: string;
    discountPercent: number;
  }[]>([]);

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
  
  const assignedBranchIds = useMemo(() => {
    if (!userProfile) return [];
    if (Array.isArray(userProfile.associatedBranchIds)) return userProfile.associatedBranchIds;
    return userProfile.branchId ? [userProfile.branchId] : [];
  }, [userProfile]);

  const idValidation = useMemo(() => validateEcuadorianId(buyerInfo.rucOrCedula), [buyerInfo.rucOrCedula]);
  const isConsumidorFinalSelected = buyerInfo.rucOrCedula === '9999999999999';

  useEffect(() => {
    const searchCustomer = async () => {
      const id = buyerInfo.rucOrCedula.trim();
      if ((id.length === 10 || id.length === 13) && !isConsumidorFinalSelected && firestore) {
        setIsSearchingCustomer(true);
        try {
          const q = query(collection(firestore, 'customers'), where('rucOrCedula', '==', id), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setBuyerInfo({
              rucOrCedula: data.rucOrCedula,
              razonSocial: data.razonSocial || '',
              direccion: data.direccion || '',
              email: data.email || '',
              telefono: data.telefono || ''
            });
          }
        } catch (e) {
          console.error("Error buscando cliente:", e);
        } finally {
          setIsSearchingCustomer(false);
        }
      }
    };
    const timer = setTimeout(searchCustomer, 500);
    return () => clearTimeout(timer);
  }, [buyerInfo.rucOrCedula, firestore, isConsumidorFinalSelected]);

  const handleSaveCustomer = async () => {
    if (!idValidation.isValid || !buyerInfo.razonSocial || !firestore || isConsumidorFinalSelected) return;
    setIsSavingCustomer(true);
    try {
      await setDoc(doc(firestore, 'customers', buyerInfo.rucOrCedula), {
        ...buyerInfo,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "Cliente Guardado" });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isSuperAdmin) return query(collection(firestore, 'branches'));
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isSuperAdmin]);
  const { data: allBranches } = useCollection(branchesQuery);

  const currentBranch = useMemo(() => {
    if (!allBranches || allBranches.length === 0) return null;
    if (selectedOverrideBranchId) return allBranches.find(b => b.id === selectedOverrideBranchId) || null;
    if (isOwner) {
      return allBranches.find(b => {
        const n = normalizeText(b.name || '');
        return n.includes('republica') && n.includes('salvador');
      }) || allBranches[0];
    }
    return allBranches.find(b => assignedBranchIds.includes(b.id)) || allBranches[0];
  }, [allBranches, isOwner, selectedOverrideBranchId, assignedBranchIds]);

  useEffect(() => {
    if (!firestore || !companyId) return;
    
    const q = query(
      collection(firestore, 'invoices'), 
      where('companyId', '==', companyId || '1793221927001'),
      limit(2000)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      let lastNum = 0;
      if (!snap.empty) {
        const sequences = snap.docs
          .map(d => d.data().invoiceNumber || '')
          .filter(n => n.startsWith(`${UNIFIED_ESTAB}-${UNIFIED_PTO_EMI}-`))
          .map(n => {
            const parts = n.split('-');
            return parts.length === 3 ? parseInt(parts[2]) : 0;
          });
        
        if (sequences.length > 0) {
          lastNum = Math.max(...sequences);
        }
      }
      setNextInvoiceNumber(`${UNIFIED_ESTAB}-${UNIFIED_PTO_EMI}-${(lastNum + 1).toString().padStart(9, '0')}`);
    }, (error) => {
      console.error("Error en secuencial maestro:", error);
    });

    return () => unsubscribe();
  }, [firestore, companyId]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !currentBranch) return null;
    return query(collection(firestore, 'product_services'), where('branchId', '==', currentBranch.id));
  }, [firestore, currentBranch]);
  const { data: availableProducts, isLoading: loadingProducts } = useCollection(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!availableProducts) return [];
    const s = productSearchTerm.toLowerCase().trim();
    return availableProducts.filter(p => 
      p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s)
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [availableProducts, productSearchTerm]);

  const addItem = (product: any) => {
    const existingIdx = items.findIndex(i => i.productId === product.id);
    if (existingIdx !== -1) {
      const updated = [...items];
      const currentQty = Number(updated[existingIdx].quantity || 0);
      updated[existingIdx].quantity = currentQty + 1;
      setItems(updated);
    } else {
      setItems([...items, { 
        productId: product.id, productName: product.name, price: product.defaultPrice || 0, 
        cost: product.cost || 0, quantity: "", sku: product.sku, discountPercent: 0 
      }]);
    }
  };

  const totalConIVA = useMemo(() => items.reduce((acc, item) => {
    const qty = Number(item.quantity === "" ? 1 : item.quantity);
    return acc + (item.price * qty * (1 - item.discountPercent / 100));
  }, 0), [items]);
  
  const subtotalNeto = totalConIVA / 1.15;

  const handleEmit = async () => {
    if (isSubmitting || items.length === 0 || !idValidation.isValid || !firestore || !currentBranch) return;
    setIsSubmitting(true);
    try {
      const invoiceNumber = nextInvoiceNumber;
      const secuencialStr = invoiceNumber.split('-')[2];
      
      const invoiceItems = items.map(i => {
        const qty = Number(i.quantity === "" ? 1 : i.quantity);
        return { 
          descripcion: i.productName, 
          cantidad: qty, 
          precioUnitario: i.price / 1.15, 
          descuento: (i.price / 1.15) * qty * (i.discountPercent / 100) 
        };
      });

      const unsignedXml = generateInvoiceXML({
        rucEmisor: "1793221927001", razonSocialEmisor: "THEGAMEEC S.A.S", dirMatriz: FIXED_MATRIZ_ADDRESS,
        estab: UNIFIED_ESTAB, ptoEmi: UNIFIED_PTO_EMI, secuencial: secuencialStr, fechaEmision: new Date().toLocaleDateString('es-ES'),
        cliente: { razonSocial: buyerInfo.razonSocial || 'CONSUMIDOR FINAL', identificacion: buyerInfo.rucOrCedula, direccion: buyerInfo.direccion || "QUITO", email: buyerInfo.email },
        items: invoiceItems, formaPago: paymentMethod
      });
      
      const resSRI = await emitirFactura(unsignedXml);
      if (!resSRI.success) throw new Error(resSRI.error);

      const batch = writeBatch(firestore);
      const newInvoiceRef = doc(collection(firestore, 'invoices'));
      
      batch.set(newInvoiceRef, {
        invoiceNumber, 
        companyId: companyId || '1793221927001', 
        buyerInfo: { ...buyerInfo, razonSocial: buyerInfo.razonSocial || 'CONSUMIDOR FINAL' }, 
        branchId: currentBranch.id, 
        branchName: currentBranch.name,
        cashierId: resolvedIdentification, 
        cashierName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Cajero',
        totalAmount: totalConIVA, 
        totalCost: items.reduce((acc, item) => acc + (item.cost * (item.quantity === "" ? 1 : item.quantity)), 0),
        status: 'EMITIDA', 
        createdAt: new Date().toISOString(),
        items: items.map(i => ({ 
          ...i, 
          quantity: i.quantity === "" ? 1 : i.quantity, 
          lineTotal: i.price * (i.quantity === "" ? 1 : i.quantity) * (1 - i.discountPercent / 100),
          unitPrice: i.price
        })),
        paymentMethod, 
        transferNumber: paymentMethod === '20' ? transferNumber : '',
        xmlContent: resSRI.autorizacion,
        sriResponse: { claveAcceso: resSRI.claveAcceso, autorizacion: resSRI.autorizacion }
      });

      for (const item of items) {
        const qty = Number(item.quantity === "" ? 1 : item.quantity);
        batch.update(doc(firestore, 'product_services', item.productId), { inventoryLevel: increment(-qty), updatedAt: new Date().toISOString() });
      }
      await batch.commit();
      setIsProcessModalOpen(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falla", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearBuyer = () => {
    setBuyerInfo({ rucOrCedula: '', razonSocial: '', direccion: '', email: '', telefono: '' });
  };

  const toggleConsumidorFinal = () => {
    if (isConsumidorFinalSelected) {
      clearBuyer();
    } else {
      setBuyerInfo({ 
        rucOrCedula: '9999999999999', 
        razonSocial: 'CONSUMIDOR FINAL', 
        direccion: 'QUITO', 
        email: 'cfinal@correo.com', 
        telefono: '9999999999' 
      });
    }
  };

  if (loadingProfile) return <DashboardShell><div className="flex justify-center py-40"><Loader2 className="animate-spin w-10 h-10 text-black" /></div></DashboardShell>;

  return (
    <DashboardShell>
      <div className="space-y-6 md:space-y-10 pb-20">
        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6 md:gap-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <Badge className="bg-black text-white font-black text-[9px] uppercase px-3 md:px-4 py-1.5 rounded-lg shadow-sm">PUNTO DE VENTA</Badge>
              {(isOwner || assignedBranchIds.length > 1) && (
                <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 md:h-10 rounded-xl px-3 md:px-4 bg-white border-slate-200 text-[9px] md:text-[10px] font-black uppercase gap-2 shadow-sm hover:bg-slate-50 transition-all">
                      <Building2 className="w-3.5 md:w-4 h-3.5 md:h-4 text-slate-400" />
                      OPERANDO DESDE: <span className="text-blue-600 truncate max-w-[100px] md:max-w-none">{currentBranch?.name || 'SELECCIONAR'}</span>
                      <ChevronDown className={cn("w-3 md:w-3.5 h-3 md:h-3.5 opacity-30 transition-transform", isBranchMenuOpen && "rotate-180")} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
                    <div className="p-4 border-b border-slate-50"><Input placeholder="Filtrar sede..." className="h-10 bg-slate-50 border-none rounded-xl text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} /></div>
                    <ScrollArea className="h-72">
                      <div className="p-2 space-y-1">
                        {(allBranches || [])
                          .filter(b => isOwner || assignedBranchIds.includes(b.id))
                          .filter(b => b.name?.toLowerCase().includes(branchSearchInput.toLowerCase()))
                          .map(b => (
                          <button key={b.id} onClick={() => { setSelectedOverrideBranchId(b.id); setIsBranchMenuOpen(false); }} className={cn("w-full flex items-center justify-between p-4 rounded-xl text-[11px] font-bold text-left transition-all", currentBranch?.id === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>
                            <span className="truncate pr-2 uppercase">{b.name}</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">Emisión SRI</h1>
              <div className="bg-blue-600 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3 w-fit shadow-lg shadow-blue-200">
                <FileDigit className="w-4 md:w-5 h-4 md:h-5" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-tight">SIGUIENTE: {nextInvoiceNumber}</span>
              </div>
            </div>
          </div>
          <Button onClick={handleEmit} disabled={isSubmitting || items.length === 0 || !idValidation.isValid} className="h-14 md:h-16 px-8 md:px-12 bg-black text-white rounded-xl md:rounded-[1.5rem] font-black shadow-2xl hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto text-sm md:text-base">
            {isSubmitting ? <Loader2 className="animate-spin" /> : `AUTORIZAR SRI`}
          </Button>
        </div>

        <Card className="border-none shadow-sm rounded-[1.5rem] md:rounded-[2.5rem] bg-white p-6 md:p-10 border border-slate-50">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 md:mb-10 gap-6">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900">Datos del Comprador</h2>
            <div className="flex flex-wrap gap-2 md:gap-3 w-full lg:w-auto">
              <Button 
                variant="ghost" 
                onClick={handleSaveCustomer} 
                disabled={isSavingCustomer || !idValidation.isValid || !buyerInfo.razonSocial || isConsumidorFinalSelected} 
                className="flex-1 lg:flex-none text-[9px] md:text-[10px] font-black text-blue-600 border border-blue-100 rounded-full h-10 md:h-11 px-4 md:px-8 gap-2 hover:bg-blue-50 disabled:opacity-30"
              >
                {isSavingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} <span className="hidden sm:inline">GUARDAR CLIENTE</span><span className="sm:hidden">GUARDAR</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={toggleConsumidorFinal} 
                className={cn(
                  "flex-1 lg:flex-none text-[9px] md:text-[10px] font-black rounded-full h-10 md:h-11 px-4 md:px-8 transition-all gap-2",
                  isConsumidorFinalSelected ? "bg-black text-white border-black" : "text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {isConsumidorFinalSelected ? <Check className="w-3 h-3 md:w-3.5 md:h-3.5" /> : null} <span className="hidden sm:inline">CONSUMIDOR FINAL</span><span className="sm:hidden">C. FINAL</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={clearBuyer} 
                className="lg:flex-none text-[9px] md:text-[10px] font-black text-red-400 border border-red-50 rounded-full h-10 md:h-11 px-4 md:px-8 hover:bg-red-50 gap-2"
              >
                <UserX className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden sm:inline">LIMPIAR</span>
              </Button>
            </div>
          </div>
          
          <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 tracking-widest">Identificación</Label>
                  <Badge className={cn("border-none px-3 py-1 text-[8px] md:text-[9px] font-black uppercase rounded-lg", idValidation.isValid ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                    {idValidation.isValid ? idValidation.type : "INVÁLIDO"}
                  </Badge>
                </div>
                <div className="relative group">
                   <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-slate-300" />
                   <input value={buyerInfo.rucOrCedula} onChange={e => setBuyerInfo({...buyerInfo, rucOrCedula: e.target.value.replace(/\D/g, '')})} className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 pl-12 md:pl-14 pr-6 outline-none font-bold text-lg md:text-xl text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner" placeholder="Cédula o RUC" />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest">Nombre / Razón Social</Label>
                <input value={buyerInfo.razonSocial} onChange={e => setBuyerInfo({...buyerInfo, razonSocial: e.target.value.toUpperCase()})} className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 px-6 outline-none font-bold text-lg md:text-xl text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner" placeholder="Nombre completo" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest flex items-center gap-2">
                  <Mail className="w-3 h-3" /> Correo Electrónico
                </Label>
                <input 
                  type="email"
                  value={buyerInfo.email} 
                  onChange={e => setBuyerInfo({...buyerInfo, email: e.target.value.toLowerCase()})} 
                  className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 px-6 outline-none font-bold text-sm md:text-base text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner" 
                  placeholder="ejemplo@correo.com" 
                />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest flex items-center gap-2">
                  <Phone className="w-3 h-3" /> Teléfono de Contacto
                </Label>
                <input 
                  type="text"
                  value={buyerInfo.telefono} 
                  onChange={e => setBuyerInfo({...buyerInfo, telefono: e.target.value.replace(/\D/g, '')})} 
                  className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 px-6 outline-none font-bold text-sm md:text-base text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner" 
                  placeholder="0999999999" 
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest flex items-center gap-2">
                <Navigation className="w-3 h-3" /> Dirección Domiciliaria
              </Label>
              <input 
                value={buyerInfo.direccion} 
                onChange={e => setBuyerInfo({...buyerInfo, direccion: e.target.value.toUpperCase()})} 
                className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 px-6 outline-none font-bold text-sm md:text-base text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner" 
                placeholder="Calle Principal y Secundaria..." 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-4 border-t border-slate-50">
              <div className="space-y-3">
                <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest flex items-center gap-2">
                  <CreditCard className="w-3 h-3" /> Método de Pago (SRI)
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 px-6 font-bold text-sm md:text-base text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner">
                    <SelectValue placeholder="Seleccione método" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold border-none shadow-xl">
                    <SelectItem value="01">Efectivo</SelectItem>
                    <SelectItem value="16" disabled={userProfile?.isPayless}>Tarjeta de Débito</SelectItem>
                    <SelectItem value="19" disabled={userProfile?.isPayless}>Tarjeta de Crédito</SelectItem>
                    <SelectItem value="20">Transferencia / De Una</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === '20' && (
                <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                  <Label className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 px-1 tracking-widest flex items-center gap-2">
                    <FileDigit className="w-3 h-3" /> No. de Comprobante
                  </Label>
                  <input 
                    type="text"
                    value={transferNumber} 
                    onChange={e => setTransferNumber(e.target.value)} 
                    className="h-12 md:h-14 w-full rounded-xl md:rounded-2xl bg-slate-50 px-6 outline-none font-bold text-sm md:text-base text-slate-900 border border-transparent focus:bg-white focus:border-slate-200 transition-all shadow-inner border-blue-200 focus:border-blue-400" 
                    placeholder="Ej. 12345678" 
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
          {/* CATÁLOGO */}
          <div className="lg:col-span-5 space-y-6 md:order-1">
            <Card className="border-none shadow-sm rounded-[1.5rem] md:rounded-[3rem] bg-white flex flex-col lg:h-[800px] overflow-hidden lg:sticky lg:top-24 border border-slate-100 ring-1 ring-slate-50">
              <CardHeader className="p-6 md:p-8 pb-4">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><Package className="w-4 md:w-5 h-4 md:h-5" /></div>
                   <CardTitle className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900">Catálogo</CardTitle>
                </div>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 md:h-5 w-4 md:w-5 text-slate-300 transition-colors" />
                  <input placeholder="Buscar ítem o SKU..." className="h-12 md:h-14 w-full rounded-xl md:rounded-[1.2rem] bg-slate-50 pl-12 pr-6 border-none outline-none font-bold text-slate-900 placeholder:text-slate-300 shadow-inner focus:bg-white focus:ring-1 focus:ring-slate-100 transition-all" value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-10 md:pb-12 space-y-3 md:space-y-4 mt-2 custom-scrollbar">
                {loadingProducts ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8 text-slate-200" /></div>
                ) : filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addItem(p)} disabled={(p.inventoryLevel || 0) <= 0} className={cn("w-full flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[1.8rem] transition-all text-left bg-white border border-transparent hover:border-slate-200 hover:bg-slate-50/50 shadow-sm", (p.inventoryLevel || 0) <= 0 && "opacity-40 grayscale cursor-not-allowed")}>
                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                      <span className="font-black text-[11px] md:text-sm uppercase text-slate-700 leading-tight truncate">{p.name}</span>
                      <Badge variant="outline" className="text-[7px] md:text-[8px] font-black uppercase px-1.5 py-0 border-slate-100 text-slate-300 w-fit">STOCK: {p.inventoryLevel || 0}</Badge>
                    </div>
                    <span className="font-black text-base md:text-xl text-slate-900 tracking-tighter shrink-0">${(p.defaultPrice || 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* RESUMEN VENTA (CARRITO) */}
          <div className="lg:col-span-7 space-y-6 md:order-2">
            <Card className="border-none shadow-sm rounded-[1.5rem] md:rounded-[2.5rem] bg-white p-6 md:p-10 border border-slate-50">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <h2 className="text-xl md:text-2xl font-black uppercase flex items-center gap-3 md:gap-4 text-slate-900"><ShoppingCart className="w-5 md:w-6 h-5 md:h-6" /> Resumen de Venta</h2>
                <Badge className="bg-slate-100 text-slate-500 font-black text-[8px] md:text-[10px] uppercase border-none px-3 md:px-4 py-1 md:py-1.5">{items.length} ÍTEMS</Badge>
              </div>
              <div className="space-y-4 md:space-y-6">
                {items.length === 0 ? (
                  <div className="h-48 md:h-64 flex flex-col items-center justify-center text-slate-300 font-bold italic border-2 border-dashed border-slate-50 rounded-[2rem] md:rounded-[3.5rem] bg-slate-50/20 gap-4">
                    <ShoppingCart className="w-10 md:w-12 h-10 md:h-12 opacity-10" />
                    <p className="text-[10px] md:text-sm font-black uppercase tracking-widest text-slate-400">Carrito vacío</p>
                  </div>
                ) : items.map((item, idx) => (
                  <div key={idx} className="flex flex-col p-5 md:p-6 bg-slate-50/50 rounded-2xl md:rounded-[2.5rem] gap-4 md:gap-6 relative border border-slate-50 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <span className="font-black text-sm md:text-lg uppercase text-slate-900 leading-tight block truncate">{item.productName}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-900 text-white text-[8px] md:text-[9px] font-black px-2 py-0.5 border-none shadow-sm">${item.price.toFixed(2)} / ud</Badge>
                          <Badge variant="outline" className="text-[7px] md:text-[8px] font-bold border-slate-200">IVA 15% INC.</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-white text-slate-300 hover:text-red-500 shadow-sm border border-slate-100 shrink-0" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8 pt-4 border-t border-slate-100">
                      <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                        <Label className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 ml-1">Cantidad</Label>
                        <div className="flex items-center bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm h-12 sm:h-10 focus-within:border-slate-300 transition-colors">
                           <input type="number" className="w-full sm:w-24 h-full text-center font-black text-base md:text-lg outline-none bg-transparent" value={item.quantity} onChange={(e) => { const u = [...items]; u[idx].quantity = e.target.value === "" ? "" : parseInt(e.target.value); setItems(u); }} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 flex-1 w-full sm:w-auto">
                        <Label className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 ml-1">Descuento (%)</Label>
                        <div className="flex items-center bg-white rounded-xl border border-slate-100 pl-3 h-12 sm:h-10 shadow-sm focus-within:border-slate-300 transition-colors">
                           <Percent className="w-3 h-3 text-slate-300 mr-2 shrink-0" />
                           <input 
                             type="number" 
                             min="0" 
                             max="100" 
                             placeholder="0"
                             className="w-full h-full pr-3 font-black text-sm md:text-base outline-none bg-transparent" 
                             value={item.discountPercent || ''} 
                             onChange={(e) => { 
                               const u = [...items]; 
                               const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                               u[idx].discountPercent = val; 
                               setItems(u); 
                             }} 
                           />
                        </div>
                      </div>

                      <div className="flex flex-col items-end sm:items-end justify-center pt-2 sm:pt-0">
                         <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400">Total Línea</span>
                         <span className="text-lg md:text-xl font-black text-slate-900 tracking-tighter">
                           ${(item.price * (Number(item.quantity === "" ? 1 : item.quantity)) * (1 - item.discountPercent / 100)).toFixed(2)}
                         </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-none bg-slate-900 text-white rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-14 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 md:w-80 h-64 md:h-80 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-[100px] md:blur-[120px]" />
              <div className="flex flex-col gap-4 md:gap-6 relative z-10">
                <div className="flex items-center justify-between border-b border-white/5 pb-4 md:pb-6">
                  <span className="text-[10px] md:text-xs font-black uppercase text-white/40 tracking-[0.2em]">Subtotal Neto</span>
                  <span className="text-lg md:text-2xl font-bold tracking-tight">${subtotalNeto.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-center sm:flex-row sm:items-center justify-between pt-2 gap-2">
                  <span className="text-[10px] md:text-xs font-black uppercase text-white tracking-[0.3em]">Total Recaudar</span>
                  <span className="text-4xl md:text-7xl font-black tracking-tighter leading-none text-white">${totalConIVA.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* MODAL ÉXITO */}
      <Dialog open={isProcessModalOpen} onOpenChange={() => window.location.reload()}>
        <DialogContent className="w-[95%] max-w-[400px] md:max-w-[450px] rounded-[2rem] md:rounded-[3.5rem] p-8 md:p-12 text-center border-none shadow-2xl bg-white">
          <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-green-500" />
          <div className="flex flex-col items-center space-y-6 md:space-y-8">
            <div className="w-20 md:w-24 h-20 md:h-24 bg-green-50 rounded-[2.5rem] md:rounded-[3.5rem] flex items-center justify-center animate-bounce shadow-inner border border-green-100">
              <CheckCircle2 className="w-10 md:w-12 h-10 md:h-12 text-green-500" />
            </div>
            <div className="space-y-2">
              <UIDialogTitle className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 uppercase">¡Venta Exitosa!</UIDialogTitle>
              <p className="text-slate-500 font-medium text-sm md:text-base">El comprobante ha sido autorizado por el SRI y registrado correctamente.</p>
            </div>
            <Button onClick={() => window.location.reload()} className="w-full h-16 md:h-20 rounded-2xl md:rounded-[2rem] bg-black text-white font-black text-lg md:text-xl active:scale-95 transition-all">NUEVA TRANSACCIÓN</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
