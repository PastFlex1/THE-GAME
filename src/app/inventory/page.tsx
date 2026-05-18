"use client";

import React, { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Search, 
  AlertTriangle, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Loader2, 
  Boxes,
  Plus,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  History,
  ArrowRightLeft,
  User,
  Calendar,
  Zap,
  Truck,
  Package,
  Check,
  X,
  ArrowRight,
  Building2,
  ChevronDown,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, where, writeBatch, getDocs, limit, increment } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const normalizeText = (str: string) => {
  return (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function InventoryPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isMovementsOpen, setIsMovementsOpen] = useState(false);
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [branchSearchInput, setBranchSearchInput] = useState('');
  
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    sku: '', 
    type: 'ALBUM', 
    cost: '', 
    defaultPrice: '', 
    inventoryLevel: '',
    envelopesPerBox: '50'
  });
  const [productToEdit, setProductToEdit] = useState<any | null>(null);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [selectedProductForMovements, setSelectedProductForMovements] = useState<any | null>(null);
  const [selectedOverrideBranchId, setSelectedOverrideBranchId] = useState<string | null>(null);

  const [prodStep, setProdStep] = useState(1);
  const [prodSearch, setProdSearch] = useState('');
  const [prodSelectedProduct, setProdSelectedProduct] = useState<any | null>(null);
  const [prodQuantity, setProdQuantity] = useState('');

  const [distStep, setDistStep] = useState(1);
  const [distSelectedProducts, setDistSelectedProducts] = useState<string[]>([]);
  const [distSelectedBranches, setDistSelectedBranches] = useState<string[]>([]);
  const [distQuantities, setDistQuantities] = useState<Record<string, number>>({});
  const [distProdSearch, setDistProdSearch] = useState('');
  const [distBranchSearch, setDistBranchSearch] = useState('');

  const [currentMovePage, setCurrentMovePage] = useState(1);
  const movesPerPage = 5;

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isSuperAdmin = resolvedIdentification === '1793221927';
  const isOwner = isSuperAdmin || userProfile?.roleId === 'OWNER';
  const assignedBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isSuperAdmin) return query(collection(firestore, 'branches'));
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isSuperAdmin]);
  const { data: allBranches, isLoading: loadingBranches } = useCollection(branchesQuery);

  const matricesId = useMemo(() => {
    if (!allBranches) return null;
    return allBranches.find(b => {
      const name = normalizeText(b.name || '');
      return name.includes('republica') || name.includes('salvador') || name.includes('matriz');
    })?.id || null;
  }, [allBranches]);

  const activeViewBranchId = useMemo(() => {
    if (selectedOverrideBranchId) return selectedOverrideBranchId;
    if (isOwner) return matricesId || 'matrix';
    return assignedBranchIds[0] || 'matrix';
  }, [isOwner, matricesId, assignedBranchIds, selectedOverrideBranchId]);

  const currentViewBranch = useMemo(() => {
    if (!allBranches || !activeViewBranchId) return null;
    return allBranches.find(b => b.id === activeViewBranchId);
  }, [allBranches, activeViewBranchId]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !activeViewBranchId || loadingBranches) return null;
    return query(collection(firestore, 'product_services'), where('branchId', '==', activeViewBranchId));
  }, [firestore, activeViewBranchId, loadingBranches]);
  const { data: products, isLoading: loadingProducts } = useCollection(productsQuery);

  const matricesProductsQuery = useMemoFirebase(() => {
    if (!firestore || !matricesId) return null;
    return query(collection(firestore, 'product_services'), where('branchId', '==', matricesId));
  }, [firestore, matricesId]);
  const { data: matricesProducts } = useCollection(matricesProductsQuery);

  const movementsQuery = useMemoFirebase(() => {
    if (!firestore || !selectedProductForMovements) return null;
    return query(
      collection(firestore, 'inventory_movements'), 
      where('productId', '==', selectedProductForMovements.id),
      limit(100)
    );
  }, [firestore, selectedProductForMovements]);
  const { data: movements, isLoading: loadingMovements } = useCollection(movementsQuery);

  const sortedMovements = useMemo(() => {
    if (!movements) return [];
    return [...movements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements]);

  const totalMovePages = Math.ceil(sortedMovements.length / movesPerPage);
  const paginatedMovements = useMemo(() => {
    return sortedMovements.slice((currentMovePage - 1) * movesPerPage, currentMovePage * movesPerPage);
  }, [sortedMovements, currentMovePage]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesCategory = categoryFilter === 'all' || (p.type || 'OTRO') === categoryFilter;
      const s = normalizeText(searchTerm.trim());
      const matchesSearch = !s || normalizeText(p.name || '').includes(s) || normalizeText(p.sku || '').includes(s);
      return matchesCategory && matchesSearch;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, searchTerm, categoryFilter]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const selectableBranches = useMemo(() => {
    if (!allBranches) return [];
    if (isOwner) return allBranches;
    return allBranches.filter(b => assignedBranchIds.includes(b.id));
  }, [allBranches, isOwner, assignedBranchIds]);

  const filteredBranchesList = useMemo(() => {
    const search = normalizeText(branchSearchInput.trim());
    return selectableBranches
      .filter(b => normalizeText(b.name || '').includes(search))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [selectableBranches, branchSearchInput]);

  const productionRequirements = useMemo(() => {
    if (!prodSelectedProduct || !prodQuantity || !matricesProducts) return null;
    const qty = parseInt(prodQuantity) || 0;
    if (qty <= 0) return null;

    const type = prodSelectedProduct.type;
    const reqs: Array<{ label: string, type: string, needed: number, current: number }> = [];

    if (type === 'SOBRE') {
      const cromoItem = matricesProducts.find(p => p.type === 'CROMO');
      reqs.push({
        label: "Cromos",
        type: "CROMO",
        needed: qty * 5,
        current: cromoItem?.inventoryLevel || 0
      });
    }

    if (type === 'CAJA') {
      const multiplier = parseInt(prodSelectedProduct.envelopesPerBox) || 50;
      
      const sobreItem = matricesProducts.find(p => p.type === 'SOBRE');
      const cromoItem = matricesProducts.find(p => p.type === 'CROMO');
      
      reqs.push({
        label: "Sobres (Empaque)",
        type: "SOBRE",
        needed: qty * multiplier,
        current: sobreItem?.inventoryLevel || 0
      });
      
      reqs.push({
        label: "Cromos (Contenido)",
        type: "CROMO",
        needed: qty * multiplier * 5,
        current: cromoItem?.inventoryLevel || 0
      });
    }

    return reqs.length > 0 ? reqs : null;
  }, [prodSelectedProduct, prodQuantity, matricesProducts]);

  const canConfirmProduction = useMemo(() => {
    if (!prodSelectedProduct || !prodQuantity) return false;
    if (!productionRequirements) return true;
    return productionRequirements.every(req => req.current >= req.needed);
  }, [prodSelectedProduct, prodQuantity, productionRequirements]);

  const handleAddProduct = async () => {
    if (isSubmitting || !firestore || !isOwner || !companyId || !allBranches) return;
    const cleanSku = (newProduct.sku || '').trim().toUpperCase();
    if (!cleanSku) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      const masterId = doc(collection(firestore, 'temp')).id;
      const cleanName = newProduct.name.trim().toUpperCase();
      allBranches.forEach(branch => {
        const newDocRef = doc(collection(firestore, 'product_services'));
        const isMatriz = branch.id === matricesId;
        const qty = isMatriz ? (parseInt(newProduct.inventoryLevel) || 0) : 0;
        batch.set(newDocRef, {
          masterId, 
          name: cleanName, 
          sku: cleanSku, 
          type: newProduct.type,
          cost: parseFloat(newProduct.cost) || 0, 
          defaultPrice: parseFloat(newProduct.defaultPrice) || 0,
          inventoryLevel: qty, 
          branchId: branch.id, 
          companyId: branch.companyId || companyId, 
          createdAt: new Date().toISOString(),
          envelopesPerBox: newProduct.type === 'CAJA' ? (newProduct.envelopesPerBox || '50') : '0'
        });
        if (qty > 0 && isMatriz) {
          const moveRef = doc(collection(firestore, 'inventory_movements'));
          batch.set(moveRef, {
            productId: newDocRef.id, productName: cleanName, branchId: branch.id, branchName: branch.name,
            type: 'IN', quantity: qty, reason: "STOCK INICIAL NACIONAL", createdAt: new Date().toISOString(),
            userId: resolvedIdentification, userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin'
          });
        }
      });
      await batch.commit();
      toast({ title: "Producto Creado", description: "Sincronizado en red nacional." });
      setIsAddOpen(false);
      setNewProduct({ name: '', sku: '', type: 'ALBUM', cost: '', defaultPrice: '', inventoryLevel: '', envelopesPerBox: '50' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!productToEdit || isSubmitting || !firestore || !isOwner) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      const now = new Date().toISOString();
      
      const replicasQuery = query(collection(firestore, 'product_services'), where('masterId', '==', productToEdit.masterId));
      const replicasSnap = await getDocs(replicasQuery);
      
      replicasSnap.docs.forEach(docSnap => {
        const updateData: any = {
          name: productToEdit.name.toUpperCase(),
          sku: productToEdit.sku.toUpperCase(),
          type: productToEdit.type,
          cost: parseFloat(productToEdit.cost) || 0,
          defaultPrice: parseFloat(productToEdit.defaultPrice) || 0,
          envelopesPerBox: productToEdit.type === 'CAJA' ? productToEdit.envelopesPerBox : '0',
          updatedAt: now
        };
        
        if (docSnap.id === productToEdit.id) {
          const oldStock = docSnap.data().inventoryLevel || 0;
          const newStock = parseInt(productToEdit.inventoryLevel) || 0;
          updateData.inventoryLevel = newStock;
          
          if (newStock !== oldStock) {
            const moveRef = doc(collection(firestore, 'inventory_movements'));
            batch.set(moveRef, {
              productId: docSnap.id, productName: productToEdit.name, branchId: activeViewBranchId,
              branchName: currentViewBranch?.name || 'Sede', type: newStock > oldStock ? 'IN' : 'OUT',
              quantity: Math.abs(newStock - oldStock), reason: "AJUSTE DE STOCK MANUAL", createdAt: now,
              userId: resolvedIdentification, userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin'
            });
          }
        }
        
        batch.update(docSnap.ref, updateData);
      });
      
      await batch.commit();
      toast({ title: "Sincronización Exitosa", description: "Cambios aplicados en toda la red." });
      setIsEditOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProduction = async () => {
    if (!prodSelectedProduct || !prodQuantity || isSubmitting || !firestore) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      const qtyProduced = parseInt(prodQuantity);
      const now = new Date().toISOString();
      const userName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin';

      if (productionRequirements) {
        for (const req of productionRequirements) {
          const inputProduct = matricesProducts?.find(p => p.type === req.type);
          if (!inputProduct) throw new Error(`Falta el insumo ${req.label} en Matriz.`);
          
          batch.update(doc(firestore, 'product_services', inputProduct.id), { 
            inventoryLevel: increment(-req.needed), 
            updatedAt: now 
          });

          const inputMoveRef = doc(collection(firestore, 'inventory_movements'));
          batch.set(inputMoveRef, {
            productId: inputProduct.id, productName: inputProduct.name, branchId: matricesId,
            branchName: "REPUBLICA DEL SALVADOR", type: 'OUT', quantity: req.needed, 
            reason: `CONSUMO PARA ENSAMBLAJE DE ${qtyProduced} ${prodSelectedProduct.name}`,
            createdAt: now, userId: resolvedIdentification, userName
          });
        }
      }

      batch.update(doc(firestore, 'product_services', prodSelectedProduct.id), { 
        inventoryLevel: increment(qtyProduced), 
        updatedAt: now 
      });

      const outputMoveRef = doc(collection(firestore, 'inventory_movements'));
      batch.set(outputMoveRef, {
        productId: prodSelectedProduct.id, productName: prodSelectedProduct.name, branchId: matricesId,
        branchName: "REPUBLICA DEL SALVADOR", type: 'IN', quantity: qtyProduced, 
        reason: productionRequirements ? "PRODUCTO ENSAMBLADO Y LLENADO" : "INGRESO POR PRODUCCIÓN",
        createdAt: now, userId: resolvedIdentification, userName
      });

      await batch.commit();
      toast({ title: "Producción Exitosa", description: `Se han fabricado ${qtyProduced} unidades de ${prodSelectedProduct.name}.` });
      setIsProductionOpen(false);
      setProdStep(1);
      setProdQuantity('');
      setProdSelectedProduct(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Producción", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDistribution = async () => {
    if (distSelectedProducts.length === 0 || distSelectedBranches.length === 0 || isSubmitting || !firestore) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      const now = new Date().toISOString();

      for (const prodId of distSelectedProducts) {
        const sourceProd = matricesProducts?.find(p => p.id === prodId);
        if (!sourceProd) continue;

        let totalSentForThisProd = 0;
        const targetBranches = allBranches?.filter(b => distSelectedBranches.includes(b.id)) || [];

        for (const branch of targetBranches) {
          const qty = distQuantities[`${prodId}_${branch.id}`] || 0;
          if (qty <= 0) continue;

          totalSentForThisProd += qty;

          const replicasQuery = query(collection(firestore, 'product_services'), where('masterId', '==', sourceProd.masterId), where('branchId', '==', branch.id), limit(1));
          const replicasSnap = await getDocs(replicasQuery);
          
          if (!replicasSnap.empty) {
            const targetDoc = replicasSnap.docs[0];
            batch.update(targetDoc.ref, { inventoryLevel: increment(qty), updatedAt: now });
            
            const moveInRef = doc(collection(firestore, 'inventory_movements'));
            batch.set(moveInRef, {
              productId: targetDoc.id, productName: sourceProd.name, branchId: branch.id, branchName: branch.name,
              type: 'IN', quantity: qty, reason: `RECEPCIÓN DE MATRIZ`, createdAt: now,
              userId: resolvedIdentification, userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Logística'
            });
          } else {
             const newReplicaRef = doc(collection(firestore, 'product_services'));
             batch.set(newReplicaRef, {
               masterId: sourceProd.masterId, 
               name: sourceProd.name, 
               sku: sourceProd.sku, 
               type: sourceProd.type,
               cost: sourceProd.cost, 
               defaultPrice: sourceProd.defaultPrice,
               inventoryLevel: qty, 
               branchId: branch.id, 
               companyId: companyId || '1793221927001', 
               createdAt: now,
               envelopesPerBox: sourceProd.envelopesPerBox || '0'
             });

             const moveInRef = doc(collection(firestore, 'inventory_movements'));
             batch.set(moveInRef, {
               productId: newReplicaRef.id, productName: sourceProd.name, branchId: branch.id, branchName: branch.name,
               type: 'IN', quantity: qty, reason: `INICIALIZACIÓN SEDE DESDE MATRIZ`, createdAt: now,
               userId: resolvedIdentification, userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Logística'
             });
          }
        }

        if (totalSentForThisProd > 0) {
          batch.update(doc(firestore, 'product_services', prodId), { inventoryLevel: increment(-totalSentForThisProd), updatedAt: now });
          const moveOutRef = doc(collection(firestore, 'inventory_movements'));
          batch.set(moveOutRef, {
            productId: prodId, productName: sourceProd.name, branchId: matricesId, branchName: "REPUBLICA DEL SALVADOR",
            type: 'OUT', quantity: totalSentForThisProd, reason: `DISTRIBUCIÓN A SEDES`, createdAt: now,
            userId: resolvedIdentification, userName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Logística'
          });
        }
      }

      await batch.commit();
      toast({ title: "Distribución Completada", description: "El stock ha sido repartido en la red nacional." });
      setIsDistributionOpen(false);
      setDistStep(1);
      setDistSelectedProducts([]);
      setDistSelectedBranches([]);
      setDistQuantities({});
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Distribución", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAddProductForm = () => (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre Comercial</Label>
          <Input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Ej. ÁLBUM DE TEMPORADA" className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">SKU / Código</Label>
          <Input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="SKU-001" className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoría</Label>
          <Select value={newProduct.type} onValueChange={v => setNewProduct({...newProduct, type: v})}>
            <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="ALBUM">Álbum</SelectItem>
              <SelectItem value="SOBRE">Sobre</SelectItem>
              <SelectItem value="CROMO">Cromo</SelectItem>
              <SelectItem value="CAJA">Caja</SelectItem>
              <SelectItem value="OTRO">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {newProduct.type === 'CAJA' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <Label className="text-[10px] font-black uppercase text-blue-600 ml-1">Sobres por Caja</Label>
            <Input type="number" value={newProduct.envelopesPerBox} onChange={e => setNewProduct({...newProduct, envelopesPerBox: e.target.value})} placeholder="50" className="h-12 rounded-xl bg-blue-50 border-none font-black text-blue-700" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Costo Producción</Label>
          <Input type="number" value={newProduct.cost} onChange={e => setNewProduct({...newProduct, cost: e.target.value})} placeholder="0.00" className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">PVP Sugerido</Label>
          <Input type="number" value={newProduct.defaultPrice} onChange={e => setNewProduct({...newProduct, defaultPrice: e.target.value})} placeholder="0.00" className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Stock Inicial Matriz</Label>
          <Input type="number" value={newProduct.inventoryLevel} onChange={e => setNewProduct({...newProduct, inventoryLevel: e.target.value})} placeholder="0" className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
        </div>
      </div>
    </div>
  );

  const renderProductionContent = () => (
    <div className="flex flex-col h-full">
      <div className="space-y-4 mb-6">
        <div className="flex gap-1">
          {[1, 2].map(s => <div key={s} className={cn("w-10 h-1.5 rounded-full transition-all", prodStep >= s ? "bg-black" : "bg-slate-200")} />)}
        </div>
      </div>
      <ScrollArea className="flex-1 max-h-[50vh]">
        {prodStep === 1 ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest">¿Qué producto desea producir?</Label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors" />
                <Input placeholder="Buscar ítem en Matriz..." className="h-12 rounded-xl bg-slate-50 border-none font-bold pl-12" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
              </div>
              <div className="grid gap-2 mt-4">
                {matricesProducts?.filter(p => normalizeText(p.name).includes(normalizeText(prodSearch)) || normalizeText(p.sku).includes(normalizeText(prodSearch))).map(p => (
                  <button key={p.id} onClick={() => setProdSelectedProduct(p)} className={cn("w-full flex items-center justify-between p-5 rounded-2xl text-left border-2 transition-all active:scale-[0.98]", prodSelectedProduct?.id === p.id ? "border-black bg-black text-white" : "border-transparent bg-slate-50 hover:bg-slate-100")}>
                    <div className="flex flex-col"><span className="text-[11px] font-black uppercase">{p.name}</span><span className={cn("text-[9px] font-bold", prodSelectedProduct?.id === p.id ? "text-slate-400" : "text-slate-400")}>CAT: {p.type} {p.type === 'CAJA' && `(${p.envelopesPerBox} SOBRES)`}</span></div>
                    <div className="text-right">
                       <span className="text-[11px] font-black">{p.inventoryLevel}</span>
                       <p className="text-[7px] font-black uppercase opacity-60">ACTUAL</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-10">
            {prodSelectedProduct && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 bg-slate-900 rounded-[2rem] text-white flex items-center justify-between shadow-xl">
                   <div className="flex flex-col"><span className="text-[10px] font-bold uppercase opacity-60">Produciendo</span><span className="text-sm font-black uppercase">{prodSelectedProduct.name}</span></div>
                   {prodSelectedProduct.type === 'CAJA' && <Badge className="bg-blue-600 text-white font-black">{prodSelectedProduct.envelopesPerBox} SOBRES/CAJA</Badge>}
                </div>
                
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-widest block">Cantidad a fabricar</Label>
                  <Input type="number" placeholder="0" className="h-14 rounded-2xl bg-slate-50 border-none font-black text-2xl text-center shadow-inner" value={prodQuantity} onChange={e => setProdQuantity(e.target.value)} />
                </div>

                {productionRequirements && (
                  <div className="space-y-4 p-6 bg-blue-50/50 rounded-[1.5rem] border border-blue-100 shadow-inner">
                    <div className="flex items-center gap-3 border-b border-blue-100 pb-4 mb-2">
                       <Info className="w-5 h-5 text-blue-600" />
                       <p className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Insumos Requeridos en Matriz</p>
                    </div>
                    <div className="space-y-6">
                      {productionRequirements.map((req, idx) => (
                        <div key={idx} className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black text-slate-600 uppercase">{req.label}</span>
                            <Badge className={cn("border-none px-3 py-0.5 text-[8px] font-black uppercase rounded-lg", req.current >= req.needed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                              {req.current >= req.needed ? "DISPONIBLE" : "SIN STOCK"}
                            </Badge>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div className={cn("h-full transition-all duration-1000", req.current >= req.needed ? "bg-green-500" : "bg-red-500")} style={{ width: `${Math.min(100, (req.current / req.needed) * 100)}%` }} />
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-slate-400">Necesarios: {req.needed}</span>
                            <span className="text-slate-900">En Matriz: {req.current}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      <div className="pt-6 border-t border-slate-50 flex gap-4 mt-auto">
        {prodStep > 1 && <Button variant="outline" onClick={() => setProdStep(1)} className="h-14 px-8 rounded-2xl font-black text-[11px] uppercase">Atrás</Button>}
        <Button onClick={() => {
          if (prodStep === 1 && prodSelectedProduct) setProdStep(2);
          else if (prodStep === 2) handleProduction();
        }} disabled={isSubmitting || (prodStep === 1 && !prodSelectedProduct) || (prodStep === 2 && !canConfirmProduction)} className="flex-1 h-14 bg-black text-white rounded-2xl font-black text-sm tracking-widest shadow-2xl active:scale-95 transition-all gap-3">
          {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : prodStep === 2 ? <><Check className="w-5 h-5" /> EJECUTAR PRODUCCIÓN</> : <><ArrowRight className="w-5 h-5" /> SIGUIENTE</>}
        </Button>
      </div>
    </div>
  );

  const renderDistributionContent = () => (
    <div className="flex flex-col h-full">
      <div className="space-y-4 mb-6">
        <div className="flex gap-1">
          {[1, 2, 3].map(s => <div key={s} className={cn("w-12 h-1.5 rounded-full transition-all", distStep >= s ? "bg-black" : "bg-slate-200")} />)}
        </div>
      </div>
      <ScrollArea className="flex-1 max-h-[60vh]">
        {distStep === 1 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">1. Seleccionar Productos</Label>
              <Badge className="bg-black text-white px-3 py-1 rounded-full font-black text-[9px] uppercase">{distSelectedProducts.length} ÍTEMS</Badge>
            </div>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors" />
              <Input placeholder="Filtrar por nombre..." className="h-12 bg-slate-50 border-none rounded-xl pl-12 font-bold" value={distProdSearch} onChange={e => setDistProdSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {matricesProducts?.filter(p => normalizeText(p.name).includes(normalizeText(distProdSearch))).map(p => (
                <div key={p.id} className={cn("flex items-center justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.98]", distSelectedProducts.includes(p.id) ? "border-black bg-slate-50" : "border-transparent bg-slate-50/50 hover:bg-slate-50")} onClick={() => {
                  const updated = distSelectedProducts.includes(p.id) ? distSelectedProducts.filter(id => id !== p.id) : [...distSelectedProducts, p.id];
                  setDistSelectedProducts(updated);
                }}>
                  <div className="flex items-center gap-4">
                    <Checkbox checked={distSelectedProducts.includes(p.id)} onCheckedChange={() => {}} />
                    <div className="flex flex-col"><span className="text-[11px] font-black uppercase text-slate-700">{p.name}</span><span className="text-[9px] font-bold text-slate-400">SKU: {p.sku}</span></div>
                  </div>
                  <Badge variant="outline" className="font-black text-[10px] border-slate-200">{p.inventoryLevel} UDS</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : distStep === 2 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">2. Destinos de Envío</Label>
              <Badge className="bg-black text-white px-3 py-1 rounded-full font-black text-[9px] uppercase">{distSelectedBranches.length} SEDES</Badge>
            </div>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-black transition-colors" />
              <Input placeholder="Buscar sucursal..." className="h-12 bg-slate-50 border-none rounded-xl pl-12 font-bold" value={distBranchSearch} onChange={(e) => setDistBranchSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allBranches?.filter(b => b.id !== matricesId).filter(b => normalizeText(b.name).includes(normalizeText(distBranchSearch))).map(b => (
                <div key={b.id} className={cn("flex items-center gap-3 p-5 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.98]", distSelectedBranches.includes(b.id) ? "border-black bg-slate-50" : "border-transparent bg-slate-50/50 hover:bg-slate-100")} onClick={() => {
                  const updated = distSelectedBranches.includes(b.id) ? distSelectedBranches.filter(id => id !== b.id) : [...distSelectedBranches, b.id];
                  setDistSelectedBranches(updated);
                }}>
                  <Checkbox checked={distSelectedBranches.includes(b.id)} onCheckedChange={() => {}} />
                  <span className="text-[11px] font-black uppercase truncate">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10 pb-10">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center block">3. Configurar Cantidades para Red</Label>
            {distSelectedProducts.map(prodId => {
              const p = matricesProducts?.find(item => item.id === prodId);
              return (
                <div key={prodId} className="bg-slate-50 rounded-[2rem] p-6 md:p-8 space-y-8 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                    <div className="flex flex-col"><span className="text-lg font-black uppercase text-slate-900 leading-tight">{p?.name}</span><span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Disp. en Matriz: {p?.inventoryLevel}</span></div>
                    <Package className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {allBranches?.filter(b => distSelectedBranches.includes(b.id)).map(branch => (
                      <div key={branch.id} className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                         <div className="flex flex-col flex-1 pr-4 min-w-0">
                           <span className="text-[11px] font-black uppercase text-slate-600 truncate">{branch.name}</span>
                           <span className="text-[8px] font-bold text-slate-300 uppercase">CANTIDAD A ENVIAR</span>
                         </div>
                         <Input type="number" placeholder="0" className="h-11 w-24 bg-slate-50 border-none rounded-xl font-black text-center text-lg shadow-inner" value={distQuantities[`${prodId}_${branch.id}`] || ''} onChange={e => setDistQuantities({...distQuantities, [`${prodId}_${branch.id}`]: parseInt(e.target.value) || 0})} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      <div className="pt-6 border-t border-slate-50 flex gap-4 mt-auto">
        {distStep > 1 && <Button variant="outline" onClick={() => setDistStep(distStep - 1)} className="h-14 px-8 rounded-2xl font-black text-[11px] uppercase">Atrás</Button>}
        <Button onClick={() => {
          if (distStep === 1 && distSelectedProducts.length > 0) setDistStep(2);
          else if (distStep === 2 && distSelectedBranches.length > 0) setDistStep(3);
          else if (distStep === 3) handleDistribution();
        }} disabled={isSubmitting || (distStep === 1 && distSelectedProducts.length === 0) || (distStep === 2 && distSelectedBranches.length === 0)} className="flex-1 h-14 bg-black text-white rounded-2xl font-black text-sm tracking-widest shadow-2xl active:scale-95 transition-all gap-3">
          {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : distStep === 3 ? <><Truck className="w-5 h-5" /> EJECUTAR EN RED</> : <><ArrowRight className="w-5 h-5" /> SIGUIENTE</>}
        </Button>
      </div>
    </div>
  );

  if (loadingProfile || loadingBranches || loadingProducts) {
    return <DashboardShell><div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="animate-spin w-12 h-12 text-slate-200" /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Cargando...</p></div></DashboardShell>;
  }

  const canSwitchView = isOwner || userProfile?.isPayless === true;
  const isViewingMatriz = activeViewBranchId === matricesId;

  return (
    <DashboardShell>
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
             <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
                {isOwner && isViewingMatriz ? 'Inventario Matriz' : `Inventario: ${currentViewBranch?.name?.toUpperCase() || 'SEDE'}`}
              </h1>
              {canSwitchView && (
                <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
                  <PopoverTrigger asChild>
                    <button className="h-9 rounded-xl px-3 bg-slate-100 text-[9px] font-black uppercase flex items-center gap-2 hover:bg-black hover:text-white transition-all shadow-sm">
                      <Building2 className="w-3.5 h-3.5" /> 
                      <span className="max-w-[120px] truncate">{isViewingMatriz ? 'MATRIZ' : (currentViewBranch?.name?.toUpperCase() || 'CAMBIAR SEDE')}</span>
                      <ChevronDown className={cn("w-3 h-3 transition-transform", isBranchMenuOpen && "rotate-180")} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
                    <div className="p-3 border-b border-slate-50 bg-white">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <Input placeholder="Buscar sede..." className="h-9 bg-slate-50 border-none rounded-xl pl-9 text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="p-2 space-y-1">
                        {filteredBranchesList.map(b => (
                          <button key={b.id} onClick={() => { setSelectedOverrideBranchId(b.id); setIsBranchMenuOpen(false); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold transition-colors text-left", activeViewBranchId === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>
                            <span className="truncate pr-2 uppercase">{b.name}</span>
                            {activeViewBranchId === b.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             {isOwner && (
               <>
                 <Button onClick={() => { setProdStep(1); setIsProductionOpen(true); }} variant="outline" className="h-12 px-6 rounded-2xl border-slate-200 bg-white font-black text-[10px] uppercase gap-2"><Zap className="w-4 h-4 text-amber-500" /> Ensamblar</Button>
                 <Button onClick={() => { setDistStep(1); setIsDistributionOpen(true); }} className="h-12 px-8 rounded-2xl bg-black text-white font-black text-[10px] uppercase gap-2"><Truck className="w-5 h-5" /> Distribuir</Button>
                 <Button onClick={() => setIsAddOpen(true)} variant="ghost" className="h-12 w-12 rounded-2xl bg-slate-100"><Plus className="w-6 h-6" /></Button>
               </>
             )}
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="p-6 md:p-10 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col gap-4">
               <CardTitle className="text-xl md:text-2xl font-black tracking-tight">Listado Maestro</CardTitle>
               <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="w-full">
                <TabsList className="bg-slate-50 p-1 rounded-2xl h-12 overflow-x-auto w-full justify-start md:justify-center">
                  <TabsTrigger value="all" className="rounded-xl font-black px-4 md:px-6 text-[9px] md:text-[10px] uppercase">Todo</TabsTrigger>
                  <TabsTrigger value="ALBUM" className="rounded-xl font-black px-4 md:px-6 text-[9px] md:text-[10px] uppercase">Álbumes</TabsTrigger>
                  <TabsTrigger value="SOBRE" className="rounded-xl font-black px-4 md:px-6 text-[9px] md:text-[10px] uppercase">Sobres</TabsTrigger>
                  <TabsTrigger value="CROMO" className="rounded-xl font-black px-4 md:px-6 text-[9px] md:text-[10px] uppercase">Cromos</TabsTrigger>
                  <TabsTrigger value="CAJA" className="rounded-xl font-black px-4 md:px-6 text-[9px] md:text-[10px] uppercase">Cajas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input placeholder="Buscar ítem o SKU..." className="h-12 bg-slate-50 border-none rounded-xl pl-12 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-50">
                    <th className="p-10 pt-0 pb-6 font-black uppercase text-[10px]">Producto</th>
                    <th className="p-10 pt-0 pb-6 font-black uppercase text-[10px] text-center">Disponible</th>
                    <th className="p-10 pt-0 pb-6 font-black uppercase text-[10px]">PVP Final</th>
                    <th className="p-10 pt-0 pb-6 font-black uppercase text-[10px] text-right">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={4} className="p-20 text-center text-slate-300 italic font-bold">No hay productos para mostrar.</td></tr>
                  ) : filteredProducts.map((p) => (
                    <tr key={p.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="p-10 py-8">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-base uppercase">{p.name}</span>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">SKU: {p.sku || 'S/N'}</span>
                             {p.type === 'CAJA' && <Badge className="bg-blue-50 text-blue-600 text-[8px] font-black border-none px-2 py-0">{p.envelopesPerBox} SOBRES</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="p-10 py-8 text-center"><Badge className={cn("text-xl font-black px-4 py-1.5 rounded-2xl border-none shadow-sm", (p.inventoryLevel || 0) <= 10 ? "bg-red-50 text-red-600" : "bg-slate-900 text-white")}>{p.inventoryLevel || 0}</Badge></td>
                      <td className="p-10 py-8"><div className="flex flex-col"><span className="font-black text-slate-900 text-lg">${(p.defaultPrice || 0).toFixed(2)}</span><span className="text-[10px] font-bold text-slate-400 uppercase">IVA INCLUIDO</span></div></td>
                      <td className="p-10 py-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 bg-slate-50" onClick={() => { setSelectedProductForMovements(p); setIsMovementsOpen(true); }}><History className="w-4 h-4 text-slate-400" /></Button>
                          {isOwner && (
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 bg-slate-50"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl w-56 border-none">
                                <DropdownMenuItem className="rounded-xl font-bold p-3 cursor-pointer" onSelect={() => { setProductToEdit(p); setIsEditOpen(true); }}><Edit2 className="w-4 h-4 mr-2" /> Editar Nacional</DropdownMenuItem>
                                <DropdownMenuItem className="rounded-xl font-bold p-3 text-destructive cursor-pointer" onSelect={() => { setProductToDelete(p); setIsDeleteAlertOpen(true); }}><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-4 space-y-4">
              {filteredProducts.map((p) => (
                <div key={p.id} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-6 shadow-sm">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                       <span className="font-black text-slate-900 text-sm uppercase block leading-tight">{p.name}</span>
                       <div className="flex flex-wrap gap-2">
                         <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 border-slate-200">SKU: {p.sku || 'S/N'}</Badge>
                         {p.type === 'CAJA' && <Badge className="bg-blue-50 text-blue-600 text-[8px] font-black border-none px-2 py-0">{p.envelopesPerBox} SOBRES</Badge>}
                       </div>
                    </div>
                    <div className="flex flex-col items-end">
                       <Badge className={cn("text-lg font-black px-4 py-1 rounded-xl border-none shadow-sm", (p.inventoryLevel || 0) <= 10 ? "bg-red-50 text-red-600" : "bg-black text-white")}>
                         {p.inventoryLevel || 0}
                       </Badge>
                       <span className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-widest">STOCK</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase">PVP Final</span>
                      <span className="font-black text-lg text-slate-900">${(p.defaultPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl bg-white shadow-sm border border-slate-100" onClick={() => { setSelectedProductForMovements(p); setIsMovementsOpen(true); }}><History className="w-5 h-5 text-slate-400" /></Button>
                       {isOwner && (
                         <DropdownMenu modal={false}>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl bg-white shadow-sm border border-slate-100"><MoreVertical className="w-5 h-5 text-slate-400" /></Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl border-none">
                             <DropdownMenuItem className="rounded-xl font-bold p-4 text-xs" onSelect={() => { setProductToEdit(p); setIsEditOpen(true); }}><Edit2 className="w-4 h-4 mr-2" /> Editar Nacional</DropdownMenuItem>
                             <DropdownMenuItem className="rounded-xl font-bold p-4 text-xs text-destructive" onSelect={() => { setProductToDelete(p); setIsDeleteAlertOpen(true); }}><Trash2 className="w-4 h-4 mr-2" /> Eliminar Permanente</DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-8 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest hidden sm:block">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="rounded-xl h-10 w-10"><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="flex items-center px-4 text-xs font-black bg-slate-50 rounded-xl">{currentPage}</div>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="rounded-xl h-10 w-10"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 1. ALTA PRODUCTO */}
        {isMobile ? (
          <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
            <SheetContent side="right" className="w-full p-0 border-none bg-white overflow-hidden [&>button]:hidden">
              <div className="h-full flex flex-col p-8">
                 <div className="flex justify-between items-start mb-8">
                   <div className="p-4 bg-black rounded-2xl text-white"><Package className="w-8 h-8" /></div>
                   <button onClick={() => setIsAddOpen(false)}><X className="w-6 h-6 text-slate-300" /></button>
                 </div>
                 <SheetTitle className="text-3xl font-black uppercase tracking-tighter mb-10">Alta Producto</SheetTitle>
                 <ScrollArea className="flex-1">
                   {renderAddProductForm()}
                 </ScrollArea>
                 <Button onClick={handleAddProduct} disabled={isSubmitting} className="h-14 mt-6 rounded-xl bg-black text-white font-black">{isSubmitting ? <Loader2 className="animate-spin" /> : 'DAR DE ALTA'}</Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] p-12 border-none">
              <DialogHeader><DialogTitle className="text-3xl font-black uppercase tracking-tighter mb-4">Alta de Producto</DialogTitle></DialogHeader>
              {renderAddProductForm()}
              <DialogFooter><Button onClick={handleAddProduct} disabled={isSubmitting} className="w-full h-14 rounded-xl bg-black text-white font-black">{isSubmitting ? <Loader2 className="animate-spin" /> : 'CREAR NACIONAL'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* 2. ENSAMBLAJE (PRODUCCIÓN) */}
        {isMobile ? (
          <Sheet open={isProductionOpen} onOpenChange={setIsProductionOpen}>
            <SheetContent side="right" className="w-full p-0 border-none bg-white overflow-hidden [&>button]:hidden">
               <div className="h-full flex flex-col p-8">
                 <div className="flex justify-between mb-6">
                   <div className="p-3 bg-slate-900 text-white rounded-xl"><Zap className="w-6 h-6" /></div>
                   <button onClick={() => setIsProductionOpen(false)}><X className="w-6 h-6 text-slate-300" /></button>
                 </div>
                 <SheetTitle className="text-2xl font-black uppercase tracking-tighter mb-8">Producción</SheetTitle>
                 {renderProductionContent()}
               </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isProductionOpen} onOpenChange={setIsProductionOpen}>
            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-10 border-none bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter mb-2">Asistente de Producción</DialogTitle>
                <DialogDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Ensamblaje y Llenado Basado en Insumos</DialogDescription>
              </DialogHeader>
              <div className="py-2 min-h-[400px] flex flex-col">{renderProductionContent()}</div>
            </DialogContent>
          </Dialog>
        )}

        {/* 3. DISTRIBUCIÓN */}
        {isMobile ? (
          <Sheet open={isDistributionOpen} onOpenChange={setIsDistributionOpen}>
            <SheetContent side="right" className="w-full p-0 border-none bg-white overflow-hidden [&>button]:hidden">
               <div className="h-full flex flex-col p-8">
                 <div className="flex justify-between mb-6">
                   <div className="p-3 bg-black text-white rounded-xl"><Truck className="w-6 h-6" /></div>
                   <button onClick={() => setIsDistributionOpen(false)}><X className="w-6 h-6 text-slate-300" /></button>
                 </div>
                 <SheetTitle className="text-2xl font-black uppercase tracking-tighter mb-8">Distribución</SheetTitle>
                 {renderDistributionContent()}
               </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isDistributionOpen} onOpenChange={setIsDistributionOpen}>
            <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] p-12 border-none bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter mb-2">Logística Nacional</DialogTitle>
                <DialogDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Sincronización de Stock en Red</DialogDescription>
              </DialogHeader>
              <div className="py-2 min-h-[450px] flex flex-col">{renderDistributionContent()}</div>
            </DialogContent>
          </Dialog>
        )}

        {/* 4. MOVIMIENTOS / HISTORIAL */}
        {isMobile ? (
          <Sheet open={isMovementsOpen} onOpenChange={setIsMovementsOpen}>
            <SheetContent side="right" className="w-full p-0 border-none bg-white [&>button]:hidden">
               <div className="h-full flex flex-col p-8">
                 <div className="flex justify-between mb-6">
                   <div className="p-3 bg-slate-900 text-white rounded-xl"><History className="w-6 h-6" /></div>
                   <button onClick={() => setIsMovementsOpen(false)}><X className="w-6 h-6 text-slate-300" /></button>
                 </div>
                 <SheetTitle className="text-xl font-black uppercase mb-6 truncate">{selectedProductForMovements?.name}</SheetTitle>
                 <ScrollArea className="flex-1">
                   <div className="space-y-4 pb-10">
                     {paginatedMovements.map(m => (
                       <div key={m.id} className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
                         <div><p className="text-[10px] font-black uppercase">{m.reason}</p><p className="text-[8px] text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</p></div>
                         <Badge className={cn("border-none text-[10px] font-black", m.type === 'IN' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>{m.type === 'IN' ? '+' : '-'}{m.quantity}</Badge>
                       </div>
                     ))}
                   </div>
                 </ScrollArea>
               </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isMovementsOpen} onOpenChange={setIsMovementsOpen}>
            <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] p-10 border-none">
              <DialogHeader><DialogTitle className="text-2xl font-black uppercase tracking-tighter mb-4">Auditoría: {selectedProductForMovements?.name}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                 {loadingMovements ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : paginatedMovements.map(m => (
                   <div key={m.id} className="p-5 bg-slate-50 rounded-2xl flex justify-between items-center">
                      <div className="flex items-center gap-4">
                         <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black", m.type === 'IN' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{m.type === 'IN' ? '+' : '-'}{m.quantity}</div>
                         <div className="flex flex-col"><span className="text-[10px] font-black uppercase text-slate-700">{m.reason}</span><span className="text-[8px] font-bold text-slate-400">{new Date(m.createdAt).toLocaleString()}</span></div>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase">{m.userName}</span>
                   </div>
                 ))}
              </div>
              {totalMovePages > 1 && (
                <div className="flex gap-2 justify-center mt-6">
                   <Button variant="outline" size="sm" onClick={() => setCurrentMovePage(Math.max(1, currentMovePage-1))}>Atrás</Button>
                   <Button variant="outline" size="sm" onClick={() => setCurrentMovePage(Math.min(totalMovePages, currentMovePage+1))}>Siguiente</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* 5. EDITAR PRODUCTO */}
        {isMobile ? (
          <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
             <SheetContent side="right" className="w-full p-0 border-none bg-white [&>button]:hidden">
                <div className="h-full flex flex-col p-8">
                  <div className="flex justify-between mb-8">
                    <div className="p-3 bg-blue-600 text-white rounded-xl"><Edit2 className="w-6 h-6" /></div>
                    <button onClick={() => setIsEditOpen(false)}><X className="w-6 h-6 text-slate-300" /></button>
                  </div>
                  <SheetTitle className="text-2xl font-black uppercase tracking-tighter mb-10">Editar Producto</SheetTitle>
                  <ScrollArea className="flex-1 space-y-6">
                     <div className="space-y-2"><Label>Nombre</Label><Input value={productToEdit?.name || ''} onChange={e => setProductToEdit({...productToEdit, name: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                     <div className="space-y-2"><Label>SKU</Label><Input value={productToEdit?.sku || ''} onChange={e => setProductToEdit({...productToEdit, sku: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                     <div className="space-y-2"><Label>Stock en Sede</Label><Input type="number" value={productToEdit?.inventoryLevel || ''} onChange={e => setProductToEdit({...productToEdit, inventoryLevel: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                     {productToEdit?.type === 'CAJA' && <div className="space-y-2"><Label>Sobres por Caja</Label><Input type="number" value={productToEdit?.envelopesPerBox || '50'} onChange={e => setProductToEdit({...productToEdit, envelopesPerBox: e.target.value})} className="h-12 rounded-xl bg-blue-50 border-none font-bold" /></div>}
                  </ScrollArea>
                  <Button onClick={handleUpdateProduct} disabled={isSubmitting} className="h-14 mt-6 rounded-xl bg-black text-white font-black">{isSubmitting ? <Loader2 className="animate-spin" /> : 'SINCRONIZAR'}</Button>
                </div>
             </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] p-12 border-none">
              <DialogHeader><DialogTitle className="text-3xl font-black uppercase tracking-tighter mb-4">Editar Registro Nacional</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-6 py-6">
                 <div className="col-span-2 space-y-2"><Label>Nombre</Label><Input value={productToEdit?.name || ''} onChange={e => setProductToEdit({...productToEdit, name: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                 <div className="space-y-2"><Label>SKU</Label><Input value={productToEdit?.sku || ''} onChange={e => setProductToEdit({...productToEdit, sku: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                 <div className="space-y-2"><Label>Stock en Sede Actual</Label><Input type="number" value={productToEdit?.inventoryLevel || ''} onChange={e => setProductToEdit({...productToEdit, inventoryLevel: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                 <div className="space-y-2"><Label>PVP Sugerido</Label><Input type="number" value={productToEdit?.defaultPrice || ''} onChange={e => setProductToEdit({...productToEdit, defaultPrice: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                 {productToEdit?.type === 'CAJA' && (
                   <div className="space-y-2"><Label>Sobres por Caja</Label><Input type="number" value={productToEdit?.envelopesPerBox || '50'} onChange={e => setProductToEdit({...productToEdit, envelopesPerBox: e.target.value})} className="h-12 rounded-xl bg-blue-50 border-none font-black text-blue-700" /></div>
                 )}
              </div>
              <DialogFooter><Button onClick={handleUpdateProduct} disabled={isSubmitting} className="w-full h-14 rounded-xl bg-black text-white font-black">{isSubmitting ? <Loader2 className="animate-spin" /> : 'SINCRONIZAR EN RED'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white w-[90%] max-w-lg">
            <AlertDialogHeader>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6"><Trash2 className="w-10 h-10 text-red-600" /></div>
                <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">¿Eliminar Producto?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 font-medium py-4">Esta acción eliminará el ítem de toda la red nacional de sedes. No se puede deshacer.</AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 mt-6">
              <AlertDialogCancel className="h-12 rounded-2xl px-8 font-bold border-slate-100">CANCELAR</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if(!productToDelete || !firestore) return;
                const batch = writeBatch(firestore);
                const replicasQuery = query(collection(firestore, 'product_services'), where('masterId', '==', productToDelete.masterId));
                const snap = await getDocs(replicasQuery);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                setIsDeleteAlertOpen(false);
                toast({ title: "Eliminación Nacional Exitosa" });
              }} className="h-12 rounded-2xl px-8 font-black bg-red-600 text-white hover:bg-red-700">ELIMINAR EN RED</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}