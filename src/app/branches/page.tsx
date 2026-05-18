
"use client";

import React, { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Plus, 
  Phone, 
  MapPin, 
  MoreVertical, 
  Edit2, 
  Loader2, 
  ShieldCheck, 
  Trash2, 
  Search, 
  AlertTriangle,
  Eye,
  Users,
  Briefcase,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, where } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function BranchesPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const { toast } = useToast();
  
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isEditBranchOpen, setIsEditBranchOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isViewStaffOpen, setIsViewStaffOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [newBranch, setNewBranch] = useState({ name: '', phone: '', address: '' });
  const [branchToEdit, setBranchToEdit] = useState<any | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<any | null>(null);
  const [viewingBranch, setViewingBranch] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile } = useDoc(userDocRef);

  const isSuperAdmin = resolvedIdentification === '1793221927';
  const isOwner = isSuperAdmin || userProfile?.roleId === 'OWNER';
  const assignedBranchIds = userProfile?.associatedBranchIds || [];

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    if (isSuperAdmin && companyId === '1793221927001') {
      return query(collection(firestore, 'branches'));
    }
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId, isSuperAdmin]);
  const { data: allBranches, isLoading: loadingBranches } = useCollection(branchesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', companyId));
  }, [firestore, companyId]);
  const { data: allUsers } = useCollection(usersQuery);

  const filteredBranches = useMemo(() => {
    if (!allBranches) return [];
    let base = isOwner ? allBranches : allBranches.filter(b => assignedBranchIds.includes(b.id));
    
    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      base = base.filter(b => b.name?.toLowerCase().includes(s) || b.address?.toLowerCase().includes(s));
    }
    return [...base].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allBranches, isOwner, assignedBranchIds, searchTerm]);

  const handleAddBranch = () => {
    if (!newBranch.name.trim() || !companyId) return;
    addDocumentNonBlocking(collection(firestore, 'branches'), {
      name: newBranch.name.trim().toUpperCase(),
      phone: newBranch.phone.trim(),
      address: newBranch.address.trim(),
      companyId: companyId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    setIsAddBranchOpen(false);
    setNewBranch({ name: '', phone: '', address: '' });
    toast({ title: "Sede Creada", description: "La sucursal ha sido registrada exitosamente." });
  };

  const handleUpdateBranch = () => {
    if (!branchToEdit) return;
    updateDocumentNonBlocking(doc(firestore, 'branches', branchToEdit.id), {
      name: branchToEdit.name.trim().toUpperCase(),
      phone: branchToEdit.phone.trim(),
      address: branchToEdit.address.trim(),
      updatedAt: new Date().toISOString(),
    });
    setIsEditBranchOpen(false);
    toast({ title: "Sede Actualizada" });
  };

  const confirmDelete = () => {
    if (!branchToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'branches', branchToDelete.id));
    setIsDeleteAlertOpen(false);
    setBranchToDelete(null);
    toast({ title: "Sede Eliminada", variant: "destructive" });
  };

  const branchStaff = useMemo(() => {
    if (!viewingBranch || !allUsers) return [];
    return allUsers.filter(u => u.associatedBranchIds?.includes(viewingBranch.id));
  }, [viewingBranch, allUsers]);

  const roleLabels: Record<string, string> = { 
    'ADMIN': 'Administrador', 
    'ACCOUNTANT': 'Contador', 
    'CASHIER': 'Cajero',
    'OWNER': 'Propietario'
  };

  return (
    <DashboardShell>
      <div className="space-y-6 md:space-y-10 pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">Puntos Operativos</h1>
              <Badge className="bg-black text-white border-none px-3 py-1 rounded-full font-black text-[10px] hidden md:flex">
                {filteredBranches.length} SEDES
              </Badge>
            </div>
            <p className="text-slate-500 font-medium text-sm md:text-base">Gestión de sedes físicas y personal asignado.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative group w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input 
                placeholder="Buscar sede..." 
                className="h-11 bg-white border-none rounded-2xl pl-12 font-bold shadow-sm" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            {isOwner && (
              <Button 
                className="bg-black text-white hover:bg-slate-800 rounded-2xl h-11 px-8 font-black shadow-xl" 
                onClick={() => setIsAddBranchOpen(true)}
              >
                <Plus className="w-5 h-5 mr-2" /> NUEVA SEDE
              </Button>
            )}
          </div>
        </div>

        {loadingBranches ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-slate-200" /></div>
        ) : filteredBranches.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 md:p-20 text-center border border-slate-100">
            <Building2 className="w-12 h-12 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-400 font-bold italic">No hay sucursales registradas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {filteredBranches.map((branch, idx) => {
              const staffInBranch = allUsers?.filter(u => u.associatedBranchIds?.includes(branch.id)) || [];
              const branchAdmins = staffInBranch.filter(u => u.roleId === 'ADMIN');
              
              return (
                <Card key={branch.id} className={cn("border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group hover:shadow-2xl transition-all duration-500", !branch.isActive && "opacity-75")}>
                  <div className="h-1.5 w-full bg-black/5 group-hover:bg-black transition-colors duration-500" />
                  <CardHeader className="p-6 md:p-8 pb-4 flex flex-row items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-300 shrink-0" />
                        <CardTitle className="text-lg md:text-xl font-black tracking-tight uppercase truncate">{branch.name}</CardTitle>
                      </div>
                      <Badge className="bg-slate-50 text-slate-400 border-none px-3 py-1 rounded-full text-[9px] font-black uppercase">PUNTO {idx + 1}</Badge>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-black hover:text-white transition-all shadow-sm"
                        onClick={() => { setViewingBranch(branch); setIsViewStaffOpen(true); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isOwner && (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-slate-50 hover:bg-slate-100">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl border-none">
                            <DropdownMenuItem onSelect={() => { setBranchToEdit(branch); setIsEditBranchOpen(true); }} className="rounded-xl font-bold p-3 cursor-pointer">
                              <Edit2 className="w-4 h-4 mr-2 text-blue-500" /> Editar Sede
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setBranchToDelete(branch); setIsDeleteAlertOpen(true); }} className="rounded-xl font-bold p-3 text-destructive cursor-pointer">
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar Permanente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-6">
                    <div className="space-y-4">
                      <div className="p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group-hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 shrink-0 shadow-sm">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Liderazgo</span>
                            <span className="font-bold text-slate-900 truncate text-xs">
                              {branchAdmins.length > 0 ? `${branchAdmins[0].firstName} ${branchAdmins[0].lastName}` : 'Gestión Central'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Colab.</span>
                          <span className="font-black text-black text-sm">{staffInBranch.length}</span>
                        </div>
                      </div>
                      <div className="space-y-3 pt-2">
                        <div className="flex items-start gap-4 text-[11px] text-slate-500 font-medium">
                          <MapPin className="w-4 h-4 shrink-0 text-slate-300 mt-0.5" />
                          <span className="line-clamp-2 uppercase leading-relaxed">{branch.address}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                          <Phone className="w-4 h-4 shrink-0 text-slate-300" />
                          <span className="font-bold">{branch.phone || 'SIN TELÉFONO'}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* SHEET AGREGAR (PANTALLA COMPLETA EN MÓVIL) */}
        <Sheet open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[500px] border-none p-0 rounded-l-none md:rounded-l-[3.5rem] shadow-2xl overflow-hidden bg-white [&>button]:hidden">
            <div className="h-full flex flex-col">
              <div className="p-8 md:p-12 pb-6 bg-slate-50/50 border-b border-slate-100 relative">
                <SheetHeader className="text-left">
                  <div className="p-4 bg-black rounded-3xl text-white w-fit mb-4 shadow-xl">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <SheetTitle className="text-3xl font-black tracking-tighter uppercase">Nueva Sede</SheetTitle>
                  <SheetDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Registro de terminal operativa nacional</SheetDescription>
                </SheetHeader>
                <button onClick={() => setIsAddBranchOpen(false)} className="absolute top-8 right-8 p-2 rounded-xl hover:bg-slate-100 transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <ScrollArea className="flex-1 p-8 md:p-12">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Nombre Comercial</Label>
                    <Input 
                      placeholder="Ej. CUMBAYÁ SHOPPING" 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-base px-6 focus-visible:ring-1 focus-visible:ring-black/5" 
                      value={newBranch.name} 
                      onChange={e => setNewBranch({...newBranch, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Dirección Exacta</Label>
                    <Input 
                      placeholder="AV. PRINCIPAL Y CALLE SECUNDARIA"
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-base px-6 focus-visible:ring-1 focus-visible:ring-black/5" 
                      value={newBranch.address} 
                      onChange={e => setNewBranch({...newBranch, address: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Teléfono de Contacto</Label>
                    <Input 
                      placeholder="02-XXXX-XXX"
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-base px-6 focus-visible:ring-1 focus-visible:ring-black/5" 
                      value={newBranch.phone} 
                      onChange={e => setNewBranch({...newBranch, phone: e.target.value})} 
                    />
                  </div>
                </div>
              </ScrollArea>
              
              <div className="p-8 md:p-12 pt-6 bg-white border-t border-slate-50 mt-auto">
                <Button 
                  onClick={handleAddBranch} 
                  disabled={!newBranch.name}
                  className="w-full h-14 bg-black text-white rounded-2xl font-black text-sm tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  DAR DE ALTA SEDE
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* SHEET EDITAR */}
        <Sheet open={isEditBranchOpen} onOpenChange={setIsEditBranchOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[500px] border-none p-0 rounded-l-none md:rounded-l-[3.5rem] shadow-2xl overflow-hidden bg-white [&>button]:hidden">
            <div className="h-full flex flex-col">
              <div className="p-8 md:p-12 pb-6 bg-slate-50/50 border-b border-slate-100 relative">
                <SheetHeader className="text-left">
                  <div className="p-4 bg-blue-500 rounded-3xl text-white w-fit mb-4 shadow-xl">
                    <Edit2 className="w-8 h-8" />
                  </div>
                  <SheetTitle className="text-3xl font-black tracking-tighter uppercase">Editar Sede</SheetTitle>
                  <SheetDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Actualización de datos operativos</SheetDescription>
                </SheetHeader>
                <button onClick={() => setIsEditBranchOpen(false)} className="absolute top-8 right-8 p-2 rounded-xl hover:bg-slate-100 transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <ScrollArea className="flex-1 p-8 md:p-12">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Nombre Comercial</Label>
                    <Input 
                      placeholder="Ej. SUR QUITO" 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-base px-6" 
                      value={branchToEdit?.name || ''} 
                      onChange={e => setBranchToEdit({...branchToEdit, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Dirección Exacta</Label>
                    <Input 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-base px-6" 
                      value={branchToEdit?.address || ''} 
                      onChange={e => setBranchToEdit({...branchToEdit, address: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Teléfono de Contacto</Label>
                    <Input 
                      className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-base px-6" 
                      value={branchToEdit?.phone || ''} 
                      onChange={e => setBranchToEdit({...branchToEdit, phone: e.target.value})} 
                    />
                  </div>
                </div>
              </ScrollArea>
              
              <div className="p-8 md:p-12 pt-6 bg-white border-t border-slate-50 mt-auto">
                <Button 
                  onClick={handleUpdateBranch} 
                  className="w-full h-14 bg-black text-white rounded-2xl font-black text-sm tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  GUARDAR CAMBIOS
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* SHEET DE PERSONAL ASIGNADO (ESTILO NOTIFICACIÓN PANTALLA COMPLETA) */}
        <Sheet open={isViewStaffOpen} onOpenChange={setIsViewStaffOpen}>
          <SheetContent side="right" className="w-full sm:max-w-[500px] border-none p-0 rounded-l-none md:rounded-l-[3.5rem] shadow-2xl overflow-hidden bg-white [&>button]:hidden">
            <div className="h-full flex flex-col">
              <div className="p-8 md:p-12 pb-6 bg-slate-900 text-white relative">
                <SheetHeader className="text-left">
                  <div className="p-4 bg-white/10 rounded-3xl text-white w-fit mb-4 backdrop-blur-xl">
                    <Users className="w-8 h-8" />
                  </div>
                  <SheetTitle className="text-3xl font-black tracking-tighter uppercase text-white leading-tight">{viewingBranch?.name}</SheetTitle>
                  <SheetDescription className="font-bold text-white/40 uppercase text-[10px] tracking-widest">Equipo operativo vinculado</SheetDescription>
                </SheetHeader>
                <button onClick={() => setIsViewStaffOpen(false)} className="absolute top-8 right-8 p-2 rounded-xl hover:bg-white/10 transition-colors">
                  <X className="w-6 h-6 text-white/50" />
                </button>
              </div>
              
              <ScrollArea className="flex-1 p-8 md:p-12 bg-slate-50/30">
                <div className="space-y-4 pb-10">
                  {branchStaff.length === 0 ? (
                    <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 shadow-sm">
                      <Users className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold italic">No hay personal asignado.</p>
                    </div>
                  ) : (
                    branchStaff.map((staff) => (
                      <div key={staff.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-sm uppercase shadow-lg">
                            {staff.firstName?.charAt(0)}{staff.lastName?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 uppercase text-xs leading-tight">{staff.firstName} {staff.lastName}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Briefcase className="w-3 h-3 text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{roleLabels[staff.roleId]}</span>
                            </div>
                          </div>
                        </div>
                        <Badge className={cn("border-none px-3 py-1 rounded-full text-[8px] font-black uppercase", staff.isActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                          {staff.isActive ? "Activo" : "OFF"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-8 md:p-12 pt-6 bg-white border-t border-slate-50 mt-auto">
                <Button 
                  onClick={() => setIsViewStaffOpen(false)} 
                  className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  CERRAR VISTA
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ALERTA ELIMINAR */}
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent className="rounded-[2.5rem] p-8 md:p-10 border-none shadow-2xl bg-white w-[90%] max-w-lg">
            <AlertDialogHeader>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mb-6">
                  <AlertTriangle className="w-10 h-10 text-red-600" />
                </div>
                <AlertDialogTitle className="text-2xl font-black tracking-tighter uppercase">¿Eliminar Sede?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 font-medium py-2">
                  Esta acción es irreversible. Se eliminará la sede <strong className="text-slate-900">{branchToDelete?.name}</strong> de toda la red nacional.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 mt-6">
              <AlertDialogCancel className="h-12 rounded-2xl px-8 font-bold border-slate-100 bg-slate-50">CANCELAR</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="h-12 rounded-2xl px-8 font-black bg-red-600 text-white hover:bg-red-700">ELIMINAR</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}
