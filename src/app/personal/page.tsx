"use client";

import React, { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Edit2, 
  Building2, 
  Loader2, 
  Trash2, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  Check,
  Fingerprint,
  Lock,
  ChevronDown,
  Eye,
  EyeOff,
  Briefcase
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, where, deleteDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { validateEcuadorianId } from '@/lib/id-validator';

export default function PersonalPage() {
  const firestore = useFirestore();
  const { resolvedIdentification, companyId } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchSearchInput, setBranchSearchInput] = useState('');
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [addStep, setAddStep] = useState(1);
  const [editStep, setEditStep] = useState(1);
  const [modalBranchSearch, setModalBranchSearch] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [newStaff, setNewStaff] = useState({ 
    firstName: '', 
    lastName: '', 
    username: '', 
    password: '', 
    roleId: 'CASHIER', 
    associatedBranchIds: [] as string[],
    isPayless: false
  });
  
  const [staffToEdit, setStaffToEdit] = useState<any | null>(null);
  const [originalStaffId, setOriginalStaffId] = useState<string | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isOwner = resolvedIdentification === '1793221927' || userProfile?.roleId === 'OWNER';
  const isAdmin = userProfile?.roleId === 'ADMIN';
  const canAccess = isOwner || isAdmin;
  
  const myBranchIds = useMemo(() => {
    if (!userProfile) return [];
    if (Array.isArray(userProfile.associatedBranchIds)) return userProfile.associatedBranchIds;
    if (userProfile.branchId) return [userProfile.branchId];
    return [];
  }, [userProfile]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !companyId || !canAccess) return null;
    if (companyId === '1793221927001' && isOwner) return query(collection(firestore, 'users'));
    return query(collection(firestore, 'users'), where('companyId', '==', companyId));
  }, [firestore, companyId, canAccess, isOwner]);
  const { data: allUsers, isLoading: loadingUsers } = useCollection(usersQuery);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'branches'), where('companyId', '==', companyId));
  }, [firestore, companyId]);
  const { data: branches } = useCollection(branchesQuery);

  const addIdValidation = useMemo(() => validateEcuadorianId(newStaff.username), [newStaff.username]);
  const editIdValidation = useMemo(() => validateEcuadorianId(staffToEdit?.id || ''), [staffToEdit?.id]);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    let result = allUsers;

    if (!isOwner) {
      result = result.filter(u => {
        const userBranchIds = u.associatedBranchIds || (u.branchId ? [u.branchId] : []);
        return userBranchIds.some((id: string) => myBranchIds.includes(id));
      });
    }
    
    if (branchFilter !== 'all') {
      result = result.filter(u => {
        const ids = u.associatedBranchIds || (u.branchId ? [u.branchId] : []);
        return ids.includes(branchFilter);
      });
    }

    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      result = result.filter(u => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        return fullName.includes(s) || u.id?.toLowerCase().includes(s);
      });
    }

    return result.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }, [allUsers, searchTerm, branchFilter, isOwner, myBranchIds]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const roleLabels: Record<string, string> = { 
    'ADMIN': 'Administrador', 
    'ACCOUNTANT': 'Contador', 
    'CASHIER': 'Cajero', 
    'OWNER': 'Propietario' 
  };

  const handleAddStaff = async () => {
    if (isSubmitting || !companyId || !firestore || !newStaff.username) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, 'users', newStaff.username), { 
        ...newStaff, 
        id: newStaff.username,
        firstName: newStaff.firstName.toUpperCase(), 
        lastName: newStaff.lastName.toUpperCase(), 
        companyId: companyId,
        isActive: true, 
        createdAt: new Date().toISOString() 
      }, { merge: true });
      
      setIsAddStaffOpen(false);
      toast({ title: "Perfil Unificado", description: "Colaborador sincronizado correctamente." });
      setAddStep(1);
      setNewStaff({ firstName: '', lastName: '', username: '', password: '', roleId: 'CASHIER', associatedBranchIds: [], isPayless: false });
    } catch (e) { 
      toast({ variant: "destructive", title: "Error", description: "Falla al procesar perfil." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!staffToEdit || !firestore || !originalStaffId) return;
    setIsSubmitting(true);
    try {
      if (staffToEdit.id !== originalStaffId) {
        await setDoc(doc(firestore, 'users', staffToEdit.id), {
          ...staffToEdit,
          firstName: (staffToEdit.firstName || '').toUpperCase(),
          lastName: (staffToEdit.lastName || '').toUpperCase(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        await deleteDoc(doc(firestore, 'users', originalStaffId));
      } else {
        await setDoc(doc(firestore, 'users', staffToEdit.id), { 
          ...staffToEdit, 
          firstName: (staffToEdit.firstName || '').toUpperCase(), 
          lastName: (staffToEdit.lastName || '').toUpperCase(), 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      }
      setIsEditStaffOpen(false);
      toast({ title: "Cambios Guardados" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', staffToDelete.id));
      setIsDeleteAlertOpen(false);
      setStaffToDelete(null);
      toast({ title: "Personal Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const selectedBranchName = branchFilter === 'all' ? "Todas las Sedes" : branches?.find(b => b.id === branchFilter)?.name || "Sede";

  if (!canAccess && !loadingProfile) {
    return <DashboardShell><div className="flex items-center justify-center h-[60vh] text-slate-400 font-bold italic">Acceso Restringido</div></DashboardShell>;
  }

  return (
    <DashboardShell>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">Personal Corporativo</h1>
            <p className="text-slate-500 font-medium">Gestión de nómina y unificación de perfiles en red.</p>
          </div>
          <Button onClick={() => { setAddStep(1); setIsAddStaffOpen(true); }} className="bg-black text-white hover:bg-slate-800 rounded-2xl h-14 px-8 font-bold shadow-xl">
            <Plus className="mr-2 w-5 h-5" /> Vincular Personal
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Popover open={isBranchMenuOpen} onOpenChange={setIsBranchMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 bg-white border-none rounded-2xl font-bold shadow-sm w-full sm:w-64 justify-between overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate uppercase block text-left flex-1">{selectedBranchName}</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform shrink-0", isBranchMenuOpen && "rotate-180")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
              <div className="p-3 border-b border-slate-50 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <Input placeholder="Buscar sede..." className="h-9 bg-slate-50 border-none rounded-xl pl-9 text-[11px] font-bold" value={branchSearchInput} onChange={(e) => setBranchSearchInput(e.target.value)} />
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-2 space-y-1">
                  <button onClick={() => { setBranchFilter('all'); setIsBranchMenuOpen(false); setCurrentPage(1); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold text-left", branchFilter === 'all' ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}>Todas las Sedes {branchFilter === 'all' && <Check className="w-3.5 h-3.5" />}</button>
                  {branches?.filter(b => isOwner || myBranchIds.includes(b.id)).filter(b => b.name?.toLowerCase().includes(branchSearchInput.toLowerCase())).map(b => (
                    <button key={b.id} onClick={() => { setBranchFilter(b.id); setIsBranchMenuOpen(false); setCurrentPage(1); }} className={cn("w-full flex items-center justify-between p-3 rounded-xl text-[11px] font-bold text-left", branchFilter === b.id ? "bg-black text-white" : "hover:bg-slate-50 text-slate-600")}><span className="truncate pr-2 uppercase">{b.name}</span>{branchFilter === b.id && <Check className="w-3.5 h-3.5" />}</button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input placeholder="Buscar por nombre o identificación..." className="h-11 bg-white border-none rounded-2xl pl-12 font-bold shadow-sm" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-50">
                    <th className="p-10 pb-6 font-black uppercase text-[10px]">Colaborador</th>
                    <th className="p-10 pb-6 font-black uppercase text-[10px]">Cargo</th>
                    <th className="p-10 pb-6 font-black uppercase text-[10px]">Sede(s)</th>
                    <th className="p-10 pb-6 font-black uppercase text-[10px]">Estado</th>
                    <th className="p-10 pb-6 font-black uppercase text-[10px] text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingUsers || loadingProfile ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-slate-200" /></td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">Sin personal registrado.</td></tr>
                  ) : paginatedUsers.map(staff => (
                    <tr key={staff.id} className={cn("hover:bg-slate-50/50 transition-colors", !staff.isActive && "opacity-60")}>
                      <td className="p-10 py-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xs uppercase">{staff.firstName?.charAt(0)}{staff.lastName?.charAt(0)}</div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black uppercase text-slate-900">{staff.firstName} {staff.lastName}</span>
                              {staff.isPayless && <Badge className="bg-blue-50 text-blue-700 text-[8px] font-black border-none px-2 py-0">PAYLESS</Badge>}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">ID: {staff.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-10 py-8 font-bold text-slate-500 uppercase text-[11px]">{roleLabels[staff.roleId] || 'Staff'}</td>
                      <td className="p-10 py-8">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-8 rounded-xl px-3 text-[10px] font-black bg-slate-50 uppercase gap-2">
                              <Building2 className="w-3 h-3" />
                              {(staff.associatedBranchIds || (staff.branchId ? [staff.branchId] : [])).length} Sedes
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-4 rounded-2xl border-none shadow-2xl">
                            <div className="space-y-1">
                              {(staff.associatedBranchIds || (staff.branchId ? [staff.branchId] : [])).map((bid: string) => (
                                <div key={bid} className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-black" />{branches?.find(b => b.id === bid)?.name || bid}</div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="p-10 py-8"><Badge className={cn("border-none px-3 py-1 rounded-full text-[9px] font-black uppercase", staff.isActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>{staff.isActive ? "ACTIVO" : "OFF"}</Badge></td>
                      <td className="p-10 py-8 text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 bg-slate-50"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl">
                            <DropdownMenuItem onSelect={() => { setStaffToEdit({...staff, associatedBranchIds: staff.associatedBranchIds || (staff.branchId ? [staff.branchId] : []) }); setOriginalStaffId(staff.id); setEditStep(1); setIsEditStaffOpen(true); }} className="rounded-xl font-bold p-3 cursor-pointer"><Edit2 className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setStaffToDelete(staff); setIsDeleteAlertOpen(true); }} className="rounded-xl font-bold p-3 text-destructive cursor-pointer"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="p-8 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="rounded-xl h-10 w-10"><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="flex items-center px-4 text-xs font-black bg-slate-50 rounded-xl">{currentPage}</div>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="rounded-xl h-10 w-10"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
          <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden bg-white">
            <DialogHeader className="p-10 pb-6 border-b border-slate-50 relative">
               <div className="flex items-center justify-between">
                 <div className="space-y-1">
                   <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">Vincular Personal</DialogTitle>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Paso {addStep} de 2</p>
                 </div>
                 <div className="flex gap-1 items-center">
                    <div className={cn("w-12 h-1.5 rounded-full transition-all", addStep >= 1 ? "bg-black" : "bg-slate-100")} />
                    <div className={cn("w-12 h-1.5 rounded-full transition-all", addStep >= 2 ? "bg-black" : "bg-slate-100")} />
                 </div>
               </div>
            </DialogHeader>

            <div className="p-10 pt-8 space-y-6">
              {addStep === 1 ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">Identificación</Label>
                      <Badge className={cn("border-none px-3 py-0.5 text-[9px] font-black uppercase rounded-lg", addIdValidation.isValid ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                        {addIdValidation.isValid ? addIdValidation.type : "ID INVÁLIDO"}
                      </Badge>
                    </div>
                    <div className="relative group">
                      <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 transition-colors group-focus-within:text-black" />
                      <Input placeholder="Cédula o RUC" autoComplete="off" className="h-11 rounded-[1.2rem] bg-slate-50/50 border-none font-black text-lg pl-14" value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value.replace(/\D/g, '')})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Nombres</Label><Input placeholder="NOMBRES" autoComplete="off" className="h-11 rounded-[1rem] bg-slate-50/50 border-none font-black text-sm px-5" value={newStaff.firstName} onChange={e => setNewStaff({...newStaff, firstName: e.target.value})} /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Apellidos</Label><Input placeholder="APELLIDOS" autoComplete="off" className="h-11 rounded-[1rem] bg-slate-50/50 border-none font-black text-sm px-5" value={newStaff.lastName} onChange={e => setNewStaff({...newStaff, lastName: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Cargo / Rol</Label>
                      <Select value={newStaff.roleId} onValueChange={v => setNewStaff({...newStaff, roleId: v})}><SelectTrigger className="h-11 bg-slate-50/50 border-none rounded-[1rem] font-black text-sm px-5"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl shadow-2xl border-none"><SelectItem value="CASHIER" className="font-bold">Cajero</SelectItem><SelectItem value="ADMIN" className="font-bold">Administrador</SelectItem><SelectItem value="ACCOUNTANT" className="font-bold">Contador</SelectItem></SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Contraseña</Label>
                      <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input type={showAddPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" className="h-11 rounded-[1rem] bg-slate-50/50 border-none font-black text-sm pl-12 pr-12" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} />
                        <button type="button" onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-black transition-colors">{showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <Checkbox id="isPayless" checked={newStaff.isPayless} onCheckedChange={(checked) => setNewStaff({...newStaff, isPayless: !!checked})} />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="isPayless" className="text-[10px] font-black uppercase text-slate-700 cursor-pointer">Ejecutivo Payless</Label>
                      <p className="text-[8px] font-bold text-slate-400">Distintivo corporativo informativo para el perfil.</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sedes Asignadas</Label></div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setNewStaff({...newStaff, associatedBranchIds: branches?.map(b => b.id) || []})} className="h-8 rounded-lg text-[8px] font-black uppercase bg-slate-100 hover:bg-black hover:text-white px-3">Marcar Todas</Button>
                      <Button variant="secondary" onClick={() => setNewStaff({...newStaff, associatedBranchIds: []})} className="h-8 rounded-lg text-[8px] font-black uppercase bg-slate-100 hover:bg-black hover:text-white px-3">Limpiar</Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <Input placeholder="Buscar sucursal..." className="h-10 bg-slate-50 border-none rounded-xl pl-12 text-[10px] font-bold" value={modalBranchSearch} onChange={(e) => setModalBranchSearch(e.target.value)} />
                  </div>
                  <ScrollArea className="h-[250px] pr-4">
                    <div className="grid grid-cols-2 gap-3 pb-6">
                      {branches?.filter(b => isOwner || myBranchIds.includes(b.id)).filter(b => b.name?.toLowerCase().includes(modalBranchSearch.toLowerCase())).map(b => (
                        <div key={b.id} className={cn("flex items-center gap-3 p-4 rounded-[1.2rem] border transition-all cursor-pointer group", newStaff.associatedBranchIds.includes(b.id) ? "bg-black text-white border-black shadow-xl" : "bg-slate-50 border-transparent hover:border-slate-200")} onClick={() => {
                          const current = newStaff.associatedBranchIds;
                          const updated = current.includes(b.id) ? current.filter(id => id !== b.id) : [...current, b.id];
                          setNewStaff({...newStaff, associatedBranchIds: updated});
                        }}>
                          <div className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-colors", newStaff.associatedBranchIds.includes(b.id) ? "bg-white text-black border-white" : "bg-white border-slate-200")}>
                            {newStaff.associatedBranchIds.includes(b.id) && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[10px] font-black uppercase truncate leading-none">{b.name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <div className="p-10 pt-4 bg-white border-t border-slate-50 flex gap-4">
              {addStep > 1 && <Button variant="ghost" onClick={() => setAddStep(1)} className="h-14 px-8 rounded-2xl font-black text-[11px] uppercase bg-slate-50 hover:bg-slate-100">Atrás</Button>}
              <Button onClick={() => addStep === 1 ? setAddStep(2) : handleAddStaff()} disabled={isSubmitting || !addIdValidation.isValid} className="flex-1 h-14 bg-black hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all">
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : addStep === 1 ? 'SIGUIENTE PASO' : 'VINCULAR Y GUARDAR'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditStaffOpen} onOpenChange={setIsEditStaffOpen}>
          <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden bg-white">
            <DialogHeader className="p-10 pb-6 border-b border-slate-50 relative">
               <div className="flex items-center justify-between">
                 <div className="space-y-1">
                   <DialogTitle className="text-3xl font-black uppercase tracking-tighter leading-none">Editar Perfil</DialogTitle>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Paso {editStep} de 2</p>
                 </div>
                 <div className="flex gap-1 items-center">
                    <div className={cn("w-12 h-1.5 rounded-full transition-all", editStep >= 1 ? "bg-black" : "bg-slate-100")} />
                    <div className={cn("w-12 h-1.5 rounded-full transition-all", editStep >= 2 ? "bg-black" : "bg-slate-100")} />
                 </div>
               </div>
            </DialogHeader>

            <div className="p-10 pt-8 space-y-6">
              {editStep === 1 ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">Identificación</Label>
                      <Badge className={cn("border-none px-3 py-0.5 text-[9px] font-black uppercase rounded-lg", editIdValidation.isValid ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                        {editIdValidation.isValid ? editIdValidation.type : "ID INVÁLIDO"}
                      </Badge>
                    </div>
                    <div className="relative group">
                      <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 transition-colors group-focus-within:text-black" />
                      <Input autoComplete="off" className="h-11 rounded-[1.2rem] bg-slate-50/50 border-none font-black text-lg pl-14" value={staffToEdit?.id || ''} onChange={e => setStaffToEdit({...staffToEdit, id: e.target.value.replace(/\D/g, '')})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Nombres</Label><Input placeholder="NOMBRES" autoComplete="off" className="h-11 rounded-[1rem] bg-slate-50/50 border-none font-black text-sm px-5" value={staffToEdit?.firstName || ''} onChange={e => setStaffToEdit({...staffToEdit, firstName: e.target.value})} /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Apellidos</Label><Input placeholder="APELLIDOS" autoComplete="off" className="h-11 rounded-[1rem] bg-slate-50/50 border-none font-black text-sm px-5" value={staffToEdit?.lastName || ''} onChange={e => setStaffToEdit({...staffToEdit, lastName: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Cargo / Rol</Label>
                      <Select value={staffToEdit?.roleId} onValueChange={v => setStaffToEdit({...staffToEdit, roleId: v})}><SelectTrigger className="h-11 bg-slate-50/50 border-none rounded-[1rem] font-black text-sm px-5"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl shadow-2xl border-none"><SelectItem value="CASHIER" className="font-bold">Cajero</SelectItem><SelectItem value="ADMIN" className="font-bold">Administrador</SelectItem><SelectItem value="ACCOUNTANT" className="font-bold">Contador</SelectItem></SelectContent></Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 px-1 tracking-[0.1em]">Nueva Clave</Label>
                      <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input type={showEditPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" className="h-11 rounded-[1rem] bg-slate-50/50 border-none font-black text-sm pl-12 pr-12" value={staffToEdit?.password || ''} onChange={e => setStaffToEdit({...staffToEdit, password: e.target.value})} />
                        <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-black transition-colors">{showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <Checkbox id="edit-isPayless" checked={staffToEdit?.isPayless || false} onCheckedChange={(checked) => setStaffToEdit({...staffToEdit, isPayless: !!checked})} />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="edit-isPayless" className="text-[10px] font-black uppercase text-slate-700 cursor-pointer">Ejecutivo Payless</Label>
                      <p className="text-[8px] font-bold text-slate-400">Etiqueta de distintivo corporativo para el perfil.</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sedes Asignadas</Label></div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setStaffToEdit({...staffToEdit, associatedBranchIds: branches?.map(b => b.id) || []})} className="h-8 rounded-lg text-[8px] font-black uppercase bg-slate-100 hover:bg-black hover:text-white px-3">Marcar Todas</Button>
                      <Button variant="secondary" onClick={() => setStaffToEdit({...staffToEdit, associatedBranchIds: []})} className="h-8 rounded-lg text-[8px] font-black uppercase bg-slate-100 hover:bg-black hover:text-white px-3">Limpiar</Button>
                    </div>
                  </div>
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <Input placeholder="Filtrar sucursales..." className="h-10 bg-slate-50 border-none rounded-xl pl-12 text-[10px] font-bold" value={modalBranchSearch} onChange={(e) => setModalBranchSearch(e.target.value)} />
                  </div>
                  <ScrollArea className="h-[250px] pr-4">
                    <div className="grid grid-cols-2 gap-3 pb-6">
                      {branches?.filter(b => isOwner || myBranchIds.includes(b.id)).filter(b => b.name?.toLowerCase().includes(modalBranchSearch.toLowerCase())).map(b => (
                        <div key={b.id} className={cn("flex items-center gap-3 p-4 rounded-[1.2rem] border transition-all cursor-pointer group", (staffToEdit?.associatedBranchIds || []).includes(b.id) ? "bg-black text-white border-black shadow-xl" : "bg-slate-50 border-transparent hover:border-slate-200")} onClick={() => {
                          const current = staffToEdit.associatedBranchIds || [];
                          const updated = current.includes(b.id) ? current.filter((id: string) => id !== b.id) : [...current, b.id];
                          setStaffToEdit({...staffToEdit, associatedBranchIds: updated});
                        }}>
                          <div className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-colors", (staffToEdit?.associatedBranchIds || []).includes(b.id) ? "bg-white text-black border-white" : "bg-white border-slate-200")}>
                            {(staffToEdit?.associatedBranchIds || []).includes(b.id) && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[10px] font-black uppercase truncate leading-none">{b.name}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <div className="p-10 pt-4 bg-white border-t border-slate-50 flex gap-4">
              {editStep > 1 && <Button variant="ghost" onClick={() => setEditStep(1)} className="h-14 px-8 rounded-2xl font-black text-[11px] uppercase bg-slate-50 hover:bg-slate-100">Atrás</Button>}
              <Button onClick={() => editStep === 1 ? setEditStep(2) : handleUpdateStaff()} disabled={isSubmitting || !editIdValidation.isValid} className="flex-1 h-14 bg-black hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all">
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : editStep === 1 ? 'SIGUIENTE PASO' : 'GUARDAR CAMBIOS'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6"><Trash2 className="w-10 h-10 text-red-600" /></div>
              <AlertDialogTitle className="text-2xl font-black">¿Eliminar Colaborador?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-medium py-4">Esta acción revoca el acceso permanentemente.</AlertDialogDescription>
            </div>
            <AlertDialogFooter className="gap-4">
              <AlertDialogCancel className="rounded-2xl h-14 font-bold border-slate-100">CANCELAR</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStaff} className="rounded-2xl h-14 font-bold bg-destructive text-white">ELIMINAR PERFIL</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}