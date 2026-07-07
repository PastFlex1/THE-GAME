"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Plus, 
  Loader2, 
  FileText, 
  Ban, 
  Building2, 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Download,
  Check,
  Calendar,
  ArrowRight,
  MapPin,
  X,
  FileDigit,
  User,
  ExternalLink,
  Calculator,
  Receipt,
  Mail,
  RefreshCw
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, increment, limit, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBranchCollection } from '@/hooks/useBranchCollection';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import Link from 'next/link';
import { InvoiceRideView } from '@/components/InvoiceRideView';
import { downloadXML, generateInvoiceXML, generateCreditNoteXML } from '@/lib/sri-xml-generator';
import { emitirNotaCredito, emitirFactura } from '@/app/actions/sri-actions';
import { sendInvoiceEmail } from '@/app/actions/email-actions';
import { getBillingPDFBase64 } from '@/lib/billing-pdf-generator';

export default function InvoicesPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, isUserLoading, companyId } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [isAnnuling, setIsAnnuling] = useState<string | null>(null);
  const [showAnnulSuccess, setShowAnnulSuccess] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isResendingSRI, setIsResendingSRI] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const FIXED_MATRIZ_ADDRESS = "REPUBLICA DEL SALVADOR N36-110 Y N36 SUECIA - BQ.3 10 06 EDF METRO PLAZA";

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isOwner = resolvedIdentification === '1793221927' || userProfile?.roleId === 'OWNER';
  const isSuperAdmin = resolvedIdentification === '1793221927';
  const assignedBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);
  const isRegional = userProfile?.isPayless === true || assignedBranchIds.length > 1;

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isOwner) return query(collection(firestore, 'branches'));
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isOwner]);
  const { data: allBranches } = useCollection(branchesQuery);

  const { data: rawInvoices, isLoading: loadingInvoices } = useBranchCollection(
    firestore, 'invoices', isOwner, assignedBranchIds, companyId, loadingProfile, 10000, 10000, isSuperAdmin
  );

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

  const filteredInvoices = useMemo(() => {
    if (!rawInvoices) return [];
    
    const isMatrizId = (id: string) => 
      id === 'matrix' || 
      id === 'matriz' || 
      id === 'none' || 
      normalizeText(allBranches?.find(b => b.id === id)?.name || '').includes('republica');

    const s = searchTerm.toLowerCase().trim();
    
    return rawInvoices
      .filter(inv => {
        const invDate = getEcuadorDate(inv.createdAt);
        
        const matchesSearch = !s || inv.invoiceNumber?.toLowerCase().includes(s) || inv.buyerInfo?.razonSocial?.toLowerCase().includes(s);
        const matchesBranch = selectedBranchId === 'all' || inv.branchId === selectedBranchId || (isMatrizId(selectedBranchId) && isMatrizId(inv.branchId));
        
        let isAuthorized = isOwner || assignedBranchIds.includes(inv.branchId) || (assignedBranchIds.some((id: string) => isMatrizId(id)) && isMatrizId(inv.branchId));
        
        if (userProfile?.roleId === 'CASHIER') {
          isAuthorized = isAuthorized && (inv.cashierId === resolvedIdentification || inv.userId === resolvedIdentification);
        }
        
        let matchesDate = true;
        if (startDate && endDate) {
          matchesDate = invDate >= startDate && invDate <= endDate;
        } else if (startDate) {
          matchesDate = invDate === startDate;
        }
        
        return matchesSearch && matchesBranch && matchesDate && isAuthorized;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawInvoices, searchTerm, selectedBranchId, allBranches, startDate, endDate, isOwner, assignedBranchIds, userProfile, resolvedIdentification]);

  const totals = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => {
      const amt = Number(inv.totalAmount) || 0;
      if (inv.status !== 'CANCELLED') {
        acc.total += amt;
        acc.count += 1;
      } else {
        acc.annulled += amt;
        acc.annulledCount += 1;
      }
      return acc;
    }, { total: 0, count: 0, annulled: 0, annulledCount: 0 });
  }, [filteredInvoices]);

  const filteredBranchesList = useMemo(() => {
    if (!allBranches) return [];
    const search = branchSearchInput.trim().toLowerCase();
    const base = isOwner ? allBranches : allBranches.filter(b => assignedBranchIds.includes(b.id));
    return base
      .filter(b => (b.name || '').toLowerCase().includes(search))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allBranches, branchSearchInput, isOwner, assignedBranchIds]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectedBranchName = useMemo(() => {
    if (selectedBranchId === 'all') return "Todas las Sedes";
    return allBranches?.find(b => b.id === selectedBranchId)?.name || "Sucursal";
  }, [selectedBranchId, allBranches]);

  const handleAnnulInvoice = async (invoice: any) => {
    if (!firestore || invoice.status === 'CANCELLED') return;
    setIsAnnuling(invoice.id);
    try {
      // 1. Calcular el próximo secuencial de Nota de Crédito
      let nextSequential = 1;
      const cnQuery = query(collection(firestore, 'invoices'), orderBy('creditNoteNumber', 'desc'), limit(1));
      const cnSnap = await getDocs(cnQuery);
      if (!cnSnap.empty) {
        const lastCN = cnSnap.docs[0].data().creditNoteNumber;
        if (lastCN) {
          const parts = lastCN.split('-');
          if (parts.length === 3) {
            nextSequential = parseInt(parts[2], 10) + 1;
          }
        }
      }
      const cnSequentialStr = nextSequential.toString().padStart(9, '0');
      const creditNoteNumber = `002-002-${cnSequentialStr}`;

      const formatDate = (d: Date) => {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear().toString();
        return `${day}/${month}/${year}`;
      };

      // 2. Generar XML de Nota de Crédito
      const ncXml = generateCreditNoteXML({
        rucEmisor: "1793221927001",
        razonSocialEmisor: "THEGAMEEC S.A.S",
        dirMatriz: FIXED_MATRIZ_ADDRESS,
        estab: "002",
        ptoEmi: "002",
        secuencial: cnSequentialStr,
        fechaEmision: formatDate(new Date()),
        cliente: {
          razonSocial: invoice.buyerInfo.razonSocial,
          identificacion: invoice.buyerInfo.rucOrCedula,
          direccion: invoice.buyerInfo.direccion,
          email: invoice.buyerInfo.email
        },
        items: invoice.items.map((i: any) => ({
          descripcion: i.productName,
          cantidad: i.quantity,
          precioUnitario: i.unitPrice / 1.15,
          descuento: 0
        })),
        formaPago: invoice.paymentMethod || '01',
        facturaModificada: {
          numero: invoice.invoiceNumber,
          fecha: formatDate(new Date(invoice.createdAt))
        }
      });

      // 3. Emitir Nota de Crédito al SRI
      const resSRI = await emitirNotaCredito(ncXml);
      
      if (!resSRI.success) {
        throw new Error(`Error SRI: ${resSRI.error}`);
      }

      // 4. Procesar la anulación interna en Firebase
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'invoices', invoice.id), { 
        status: 'CANCELLED', 
        annulledAt: new Date().toISOString(), 
        annulledBy: resolvedIdentification,
        creditNoteNumber: creditNoteNumber,
        creditNoteAuth: resSRI.autorizacion,
        creditNoteAccessKey: resSRI.claveAcceso
      });
      
      if (invoice.items && Array.isArray(invoice.items)) {
        for (const item of invoice.items) {
          if (item.productId) {
            batch.update(doc(firestore, 'product_services', item.productId), { 
              inventoryLevel: increment(item.quantity), 
              updatedAt: new Date().toISOString() 
            });
            const moveRef = doc(collection(firestore, 'inventory_movements'));
            batch.set(moveRef, {
              productId: item.productId, productName: item.productName, branchId: invoice.branchId, branchName: invoice.branchName || 'Sede',
              companyId: companyId || '1793221927001', type: 'IN', quantity: item.quantity, 
              reason: 'ANULACIÓN', createdAt: new Date().toISOString(), 
              userId: resolvedIdentification, userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Usuario Sistema'
            });
          }
        }
      }
      await batch.commit();
      setShowAnnulSuccess(true);
      toast({ title: "Nota de Crédito Emitida", description: `Factura anulada con NC: ${creditNoteNumber}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en Anulación", description: error.message });
    } finally {
      setIsAnnuling(null);
    }
  };

  const handleResendToSRI = async (inv: any) => {
    if (!firestore || inv.status === 'CANCELLED') return;
    setIsResendingSRI(inv.id);
    try {
      const xml = generateInvoiceXML({
        rucEmisor: "1793221927001", razonSocialEmisor: "THEGAMEEC S.A.S", dirMatriz: FIXED_MATRIZ_ADDRESS, 
        estab: "002", ptoEmi: "002", secuencial: inv.invoiceNumber.split('-')[2], 
        fechaEmision: new Date(inv.createdAt).toLocaleDateString('es-ES'),
        cliente: { razonSocial: inv.buyerInfo.razonSocial, identificacion: inv.buyerInfo.rucOrCedula, direccion: inv.buyerInfo.direccion, email: inv.buyerInfo.email },
        items: inv.items.map((i: any) => ({ descripcion: i.productName, cantidad: i.quantity, precioUnitario: i.unitPrice / 1.15, descuento: 0 })),
        formaPago: inv.paymentMethod
      });

      const resSRI = await emitirFactura(xml);
      
      if (!resSRI.success) {
        throw new Error(`Error SRI: ${resSRI.error}`);
      }

      const sriResponse = {
        xmlFirmado: resSRI.xmlFirmado,
        recepcion: resSRI.recepcion,
        autorizacion: resSRI.autorizacion,
        claveAcceso: resSRI.claveAcceso
      };

      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'invoices', inv.id), { 
        sriResponse,
        xmlContent: xml
      });
      await batch.commit();

      toast({ title: "SRI Actualizado", description: "Factura reenviada y datos sobrescritos para producción." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en SRI", description: error.message });
    } finally {
      setIsResendingSRI(null);
    }
  };

  const handleResendEmail = async (inv: any) => {
    if (!inv.buyerInfo.email) {
      toast({ variant: "destructive", title: "Sin correo", description: "El cliente no tiene un correo registrado." });
      return;
    }
    setIsResendingEmail(inv.id);
    try {
      const xmlToUse = inv.xmlContent || generateInvoiceXML({
        rucEmisor: "1793221927001", razonSocialEmisor: "THEGAMEEC S.A.S", dirMatriz: FIXED_MATRIZ_ADDRESS, 
        estab: "002", ptoEmi: "002", secuencial: inv.invoiceNumber.split('-')[2], 
        fechaEmision: new Date(inv.createdAt).toLocaleDateString('es-ES'),
        cliente: { razonSocial: inv.buyerInfo.razonSocial, identificacion: inv.buyerInfo.rucOrCedula, direccion: inv.buyerInfo.direccion, email: inv.buyerInfo.email },
        items: inv.items.map((i: any) => ({ descripcion: i.productName, cantidad: i.quantity, precioUnitario: i.unitPrice / 1.15, descuento: 0 })),
        formaPago: inv.paymentMethod
      });

      const accessKey = inv.sriResponse?.claveAcceso || "0000000000000000000000000000000000000000000000000";

      const pdfBase64 = getBillingPDFBase64({
        title: "Factura",
        docNumber: inv.invoiceNumber,
        date: new Date(inv.createdAt).toLocaleDateString('es-ES'),
        time: new Date(inv.createdAt).toLocaleString('es-ES'),
        accessKey: accessKey,
        isAuthorized: inv.status !== 'CANCELLED',
        client: {
          name: inv.buyerInfo.razonSocial,
          ruc: inv.buyerInfo.rucOrCedula,
          address: inv.buyerInfo.direccion || "QUITO",
          email: inv.buyerInfo.email,
          paymentMethod: inv.paymentMethod,
          transferNumber: inv.transferNumber
        },
        items: inv.items,
        subtotal: inv.subtotalAmount || 0,
        iva: inv.taxAmount || 0,
        total: inv.totalAmount || 0,
        branchAddress: FIXED_MATRIZ_ADDRESS
      });

      const res = await sendInvoiceEmail(
        inv.buyerInfo.email,
        inv.invoiceNumber,
        inv.buyerInfo.razonSocial,
        inv.totalAmount,
        xmlToUse,
        pdfBase64
      );

      if (!res.success) throw new Error(res.error);

      toast({ title: "Correo enviado", description: "El comprobante fue reenviado al cliente." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de correo", description: error.message });
    } finally {
      setIsResendingEmail(null);
    }
  };

  const handleDownloadXML = (inv: any) => {
    // PRIORIZAMOS EL XML AUTORIZADO ALMACENADO EN EL DOCUMENTO
    if (inv.xmlContent) {
      downloadXML(inv.xmlContent, `${inv.invoiceNumber}.xml`);
      toast({ title: "XML Autorizado", description: "Descargando comprobante oficial firmado." });
      return;
    }

    // FALLBACK A GENERACIÓN LOCAL SI NO HAY XML FIRMADO (FACTURAS ANTIGUAS)
    const xml = generateInvoiceXML({
      rucEmisor: "1793221927001", razonSocialEmisor: "THEGAMEEC S.A.S", dirMatriz: FIXED_MATRIZ_ADDRESS, 
      estab: "002", ptoEmi: "002", secuencial: inv.invoiceNumber.split('-')[2], 
      fechaEmision: new Date(inv.createdAt).toLocaleDateString('es-ES'),
      cliente: { razonSocial: inv.buyerInfo.razonSocial, identificacion: inv.buyerInfo.rucOrCedula, direccion: inv.buyerInfo.direccion, email: inv.buyerInfo.email },
      items: inv.items.map((i: any) => ({ descripcion: i.productName, cantidad: i.quantity, precioUnitario: i.unitPrice / 1.15, descuento: 0 })),
      formaPago: inv.paymentMethod
    });
    downloadXML(xml, `${inv.invoiceNumber}.xml`);
    toast({ title: "XML Borrador", description: "Descargando XML generado localmente (sin firma SRI)." });
  };

  if (isUserLoading || loadingProfile || loadingInvoices) {
    return <DashboardShell><div className="flex justify-center py-40"><Loader2 className="w-10 h-10 animate-spin text-slate-200" /></div></DashboardShell>;
  }

  const canSwitchBranch = isOwner || isRegional;

  return (
    <DashboardShell>
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6 md:space-y-10 pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Historial Corporativo</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base">Control nacional de ventas y auditoría SRI (UTC-5 Ecuador).</p>
            </div>
            <Button asChild className="bg-black text-white hover:bg-slate-800 rounded-2xl h-14 px-8 font-black shadow-xl active:scale-95 transition-all">
              <Link href="/invoices/new"><Plus className="w-5 h-5 mr-2" /> Nueva Factura</Link>
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input type="date" className="h-11 w-full sm:w-40 bg-slate-50 border-none rounded-xl font-bold text-xs" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} />
              <ArrowRight className="hidden sm:block w-4 h-4 text-slate-200 shrink-0" />
              <Input type="date" className="h-11 w-full sm:w-40 bg-slate-50 border-none rounded-xl font-bold text-xs" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} />
            </div>
            
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input placeholder="Buscar por número o cliente..." className="h-11 w-full bg-slate-50 border-none rounded-xl pl-12 font-bold shadow-inner outline-none text-sm" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>
            
            {canSwitchBranch ? (
              <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 bg-slate-50 border-none rounded-xl font-bold min-w-[200px] justify-between shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate uppercase text-xs block text-left">{selectedBranchName}</span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform shrink-0", isBranchMenuOpen && "rotate-180")} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                  <div className="p-3 border-b border-slate-50 bg-white">
                    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" /><Input placeholder="Filtrar sedes..." className="h-9 bg-slate-50 border-none rounded-xl pl-9 text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} /></div>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="p-2 space-y-1">
                      <button onClick={() => { setSelectedBranchId('all'); setIsBranchMenuOpen(false); setCurrentPage(1); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold text-left", selectedBranchId === 'all' ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>Todas las Sedes {selectedBranchId === 'all' && <Check className="w-3.5 h-3.5" />}</button>
                      {filteredBranchesList.map(b => (
                        <button key={b.id} onClick={() => { setSelectedBranchId(b.id); setIsBranchMenuOpen(false); setCurrentPage(1); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold text-left", selectedBranchId === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}><span className="truncate pr-2 uppercase">{b.name}</span>{selectedBranchId === b.id && <Check className="w-3.5 h-3.5" />}</button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            ) : (
              <Badge className="bg-black text-white font-black text-[9px] uppercase px-4 py-3 rounded-xl gap-2 h-11">
                <MapPin className="w-3.5 h-3.5 text-blue-400" /> {allBranches?.find(b => assignedBranchIds.includes(b.id))?.name || 'MI SEDE'}
              </Badge>
            )}
          </div>

          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-0">
              {/* VISTA MÓVIL (CARTAS) */}
              <div className="md:hidden divide-y divide-slate-50">
                {paginatedInvoices.length === 0 ? (
                  <div className="p-12 text-center text-slate-300 italic font-bold">Sin resultados.</div>
                ) : paginatedInvoices.map((inv) => (
                  <div key={inv.id} className={cn("p-6 space-y-4", inv.status === 'CANCELLED' && "opacity-60")}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <FileDigit className="w-3.5 h-3.5 text-slate-400" />
                           <span className="font-black text-slate-900 text-sm">{inv.invoiceNumber}</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(new Date(inv.createdAt).getTime() - 5*3600*1000).toLocaleString('es-ES')}</p>
                      </div>
                      <Badge className={cn("border-none text-[9px] font-black uppercase px-2 py-0.5", inv.status === 'CANCELLED' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                        {inv.status === 'CANCELLED' ? 'ANULADA' : 'EMITIDA'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase text-slate-900 truncate">{inv.buyerInfo?.razonSocial || 'Consumidor Final'}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate">
                          {inv.branchName || (allBranches?.find(b => b.id === inv.branchId)?.name || 'MATRIZ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-slate-900 tracking-tight">${(inv.totalAmount || 0).toFixed(2)}</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-10 px-4 rounded-xl bg-slate-50 font-bold text-[10px] uppercase gap-2" onClick={() => setSelectedInvoiceId(inv.id)}>
                          <FileText className="w-3.5 h-3.5" /> RIDE
                        </Button>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl border-none">
                             <DropdownMenuItem className="rounded-xl font-bold p-3 cursor-pointer" onSelect={() => handleDownloadXML(inv)}>
                               <Download className="w-4 h-4 mr-2" /> Descargar XML (Oficial)
                             </DropdownMenuItem>
                             {inv.status !== 'CANCELLED' && isOwner && (
                               <>

                                 <DropdownMenuItem className="rounded-xl font-bold p-3 cursor-pointer" onSelect={() => handleResendEmail(inv)}>
                                   <Mail className="w-4 h-4 mr-2" /> Reenviar al Correo
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="rounded-xl font-bold p-3 text-destructive cursor-pointer" onSelect={() => handleAnnulInvoice(inv)}>
                                   <Ban className="w-4 h-4 mr-2" /> Anular Factura
                                 </DropdownMenuItem>
                               </>
                             )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* VISTA ESCRITORIO (TABLA) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-50">
                      <th className="p-8 pb-4 font-black uppercase text-[10px] tracking-widest">Comprobante</th>
                      <th className="p-8 pb-4 font-black uppercase text-[10px] tracking-widest">Sucursal</th>
                      <th className="p-8 pb-4 font-black uppercase text-[10px] tracking-widest">Cliente</th>
                      <th className="p-8 pb-4 font-black uppercase text-[10px] tracking-widest">Estado</th>
                      <th className="p-8 pb-4 font-black uppercase text-[10px] tracking-widest text-right">Total</th>
                      <th className="p-8 pb-4 font-black uppercase text-[10px] tracking-widest text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedInvoices.map((inv) => {
                      const branchName = inv.branchName && inv.branchName !== 'Sede' 
                        ? inv.branchName 
                        : (allBranches?.find(b => b.id === inv.branchId)?.name || 'Sede');

                      return (
                        <tr key={inv.id} className={cn("group transition-all", inv.status === 'CANCELLED' ? "opacity-50" : "hover:bg-slate-50/30")}>
                          <td className="p-8 py-10"><div className="flex flex-col"><span className="font-black text-slate-900">{inv.invoiceNumber}</span><span className="text-[9px] font-bold text-slate-400">{new Date(new Date(inv.createdAt).getTime() - 5*3600*1000).toLocaleString('es-ES')}</span></div></td>
                          <td className="p-8 py-10 font-bold text-slate-500 uppercase text-[10px]">{branchName}</td>
                          <td className="p-8 py-10 font-bold text-slate-700 uppercase truncate max-w-[200px]">{inv.buyerInfo?.razonSocial || 'Consumidor Final'}</td>
                          <td className="p-8 py-10"><Badge className={cn("border-none text-[9px] font-black uppercase", inv.status === 'CANCELLED' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>{inv.status === 'CANCELLED' ? 'ANULADA' : 'EMITIDA'}</Badge></td>
                          <td className="p-8 py-10 font-black text-slate-900 text-lg text-right">${(inv.totalAmount || 0).toFixed(2)}</td>
                          <td className="p-8 py-10 text-center">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 bg-slate-50"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl border-none">
                                <DropdownMenuItem className="rounded-xl font-bold p-3 cursor-pointer" onSelect={() => setSelectedInvoiceId(inv.id)}><FileText className="w-4 h-4 mr-2" /> Ver RIDE (PDF)</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-xl font-bold p-3 cursor-pointer" onSelect={() => handleDownloadXML(inv)}><Download className="w-4 h-4 mr-2" /> Descargar XML (Oficial)</DropdownMenuItem>
                                {inv.status !== 'CANCELLED' && isOwner && (
                                  <>

                                    <DropdownMenuItem className="rounded-xl font-bold p-3 cursor-pointer" onSelect={() => handleResendEmail(inv)}><Mail className="w-4 h-4 mr-2" /> Reenviar al Correo</DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-xl font-bold p-3 text-destructive cursor-pointer" onSelect={() => handleAnnulInvoice(inv)}><Ban className="w-4 h-4 mr-2" /> Anular Factura</DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* BARRA DE TOTALES (DÍNAMICA CON FILTRO) */}
              <div className="bg-slate-900 text-white p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-white/10 rounded-2xl">
                    <Calculator className="w-8 h-8 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Resumen del Período</p>
                    <h3 className="text-xl font-black uppercase tracking-tight">Cálculo de Auditoría</h3>
                  </div>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-end gap-10">
                   <div className="flex flex-col items-center md:items-end">
                     <span className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-1">Comprobantes Netos</span>
                     <div className="flex items-center gap-3">
                       <Receipt className="w-4 h-4 text-green-500" />
                       <span className="text-3xl font-black">${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>
                     <p className="text-[8px] font-bold text-green-500 uppercase mt-1">{totals.count} Ventas efectivas</p>
                   </div>
                   
                   <div className="w-px h-12 bg-white/10 hidden sm:block" />
                   
                   <div className="flex flex-col items-center md:items-end">
                     <span className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-1">Volumen Anulado</span>
                     <div className="flex items-center gap-3">
                       <Ban className="w-4 h-4 text-red-500" />
                       <span className="text-3xl font-black text-white/40">${totals.annulled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>
                     <p className="text-[8px] font-bold text-red-500 uppercase mt-1">{totals.annulledCount} Docs. descartados</p>
                   </div>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="p-6 md:p-8 border-t border-slate-50 flex items-center justify-between bg-white">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:block">Página {currentPage} de {totalPages}</p>
                  <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="rounded-xl h-10 w-10 bg-white"><ChevronLeft className="w-4 h-4" /></Button>
                    <div className="flex items-center px-6 text-xs font-black bg-slate-50 rounded-xl">{currentPage} / {totalPages}</div>
                    <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="rounded-xl h-10 w-10 bg-white"><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SHEET DE RIDE (PANTALLA COMPLETA EN MÓVIL) */}
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

        {/* MODAL DE PROCESANDO ANULACIÓN */}
        <Dialog open={!!isAnnuling} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md border-none shadow-2xl p-0 overflow-hidden rounded-[2rem] bg-slate-900 [&>button]:hidden">
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse rounded-full" />
                <div className="bg-slate-800 p-6 rounded-[2rem] relative border border-white/5">
                  <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                </div>
              </div>
              <DialogTitle className="mt-8 text-2xl font-black tracking-tight text-white uppercase">Anulando Factura</DialogTitle>
              <p className="text-sm font-bold tracking-widest uppercase text-slate-400 mt-2">
                Conectando con el SRI...
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* MODAL DE ANULACIÓN EXITOSA */}
        <Dialog open={showAnnulSuccess} onOpenChange={setShowAnnulSuccess}>
          <DialogContent className="sm:max-w-md border-none shadow-2xl p-0 overflow-hidden rounded-[2rem] bg-white [&>button]:hidden">
            <div className="flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 blur-3xl rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full" />
              
              <div className="bg-green-50 p-6 rounded-[2rem] relative shadow-inner mb-6">
                <Check className="w-16 h-16 text-green-500" strokeWidth={3} />
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase">Anulación Exitosa</DialogTitle>
              <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mt-3 max-w-[250px]">
                La Nota de Crédito ha sido autorizada por el SRI
              </p>
              
              <Button 
                onClick={() => setShowAnnulSuccess(false)}
                className="mt-10 w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black tracking-widest uppercase"
              >
                Continuar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Muestra indicador global mientras procesa SRI o Correos */}
        {(isResendingSRI || isResendingEmail) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <p className="font-black text-sm uppercase tracking-widest text-slate-800">
                {isResendingSRI ? 'Reenviando a SRI...' : 'Enviando correo...'}
              </p>
            </div>
          </div>
        )}

      </TooltipProvider>
    </DashboardShell>
  );
}
