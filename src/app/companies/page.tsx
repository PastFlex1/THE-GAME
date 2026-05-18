
"use client";

import React, { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Plus, Building2, Search, MoreVertical, Edit2, Power, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function CompaniesPage() {
  const firestore = useFirestore();
  const { resolvedIdentification } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newCompany, setNewCompany] = useState({
    name: '',
    ruc: '',
    address: '',
    phone: '',
    ownerId: '',
    ownerPassword: 'admin123'
  });

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'companies'));
  }, [firestore]);
  const { data: companies, isLoading } = useCollection(companiesQuery);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'branches');
  }, [firestore]);
  const { data: allBranches } = useCollection(branchesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allUsers } = useCollection(usersQuery);

  const isSuperAdmin = resolvedIdentification === '1793221927';

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.filter(c => 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.ruc?.includes(searchTerm)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, searchTerm]);

  const handleAddCompany = async () => {
    if (!newCompany.name || !newCompany.ruc || !newCompany.ownerId || !firestore) return;
    setIsSubmitting(true);
    try {
      const companyId = newCompany.ruc;
      
      await setDoc(doc(firestore, 'companies', companyId), {
        id: companyId,
        name: newCompany.name.toUpperCase(),
        ruc: newCompany.ruc,
        address: newCompany.address.toUpperCase(),
        phone: newCompany.phone,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      await setDoc(doc(firestore, 'users', newCompany.ownerId), {
        id: newCompany.ownerId,
        firstName: 'ADMINISTRADOR',
        lastName: newCompany.name.toUpperCase(),
        username: newCompany.ownerId,
        password: newCompany.ownerPassword,
        roleId: 'OWNER',
        companyId: companyId,
        isActive: true,
        associatedBranchIds: [],
        createdAt: new Date().toISOString()
      });

      toast({ title: "Empresa Registrada", description: `Se ha creado el perfil para ${newCompany.name}.` });
      setIsAddOpen(false);
      setNewCompany({ name: '', ruc: '', address: '', phone: '', ownerId: '', ownerPassword: 'admin123' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return <DashboardShell><div className="text-center py-20">Acceso Restringido</div></DashboardShell>;
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Gestión de Empresas</h1>
            <p className="text-slate-500 font-medium">Creación y monitoreo de perfiles corporativos independientes.</p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="bg-black text-white hover:bg-slate-800 rounded-2xl h-14 px-8 font-bold shadow-xl">
            <Plus className="w-5 h-5 mr-2" /> Nueva Empresa
          </Button>
        </div>

        <div className="relative group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <Input 
            placeholder="Buscar por RUC o Nombre Legal..." 
            className="h-14 bg-white border-none rounded-2xl pl-12 font-bold shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-slate-200" /></div>
          ) : filteredCompanies.map((company) => {
            const companyBranches = allBranches?.filter(b => b.companyId === company.id) || [];
            const companyStaff = allUsers?.filter(u => u.companyId === company.id) || [];

            return (
              <Card key={company.id} className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                <div className="h-2 bg-black w-full" />
                <CardHeader className="p-8 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge className="bg-slate-100 text-slate-500 font-black text-[9px] uppercase px-3 py-1">RUC: {company.ruc}</Badge>
                    <Badge className={cn("border-none px-3 py-1 rounded-full text-[9px] font-black uppercase", company.isActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                      {company.isActive ? "Activa" : "Suspendida"}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight truncate">{company.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-4 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Sucursales</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-900">{companyBranches.length}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Personal</p>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-900">{companyStaff.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Contacto</span>
                      <span className="text-xs font-bold text-slate-600">{company.phone || 'Sin teléfono'}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[600px] rounded-[3rem] p-12 border-none">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">Nueva Empresa</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium">Cree un perfil corporativo independiente con su propio administrador.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Razón Social</Label>
                  <Input placeholder="Ej. EMPRESA S.A." className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={newCompany.name} onChange={e => setNewCompany({...newCompany, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">RUC</Label>
                  <Input placeholder="179XXXXXXX001" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={newCompany.ruc} onChange={e => setNewCompany({...newCompany, ruc: e.target.value.replace(/\D/g, '')})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dirección Matriz</Label>
                <Input placeholder="Calle Principal y Secundaria" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={newCompany.address} onChange={e => setNewCompany({...newCompany, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cédula del Dueño</Label>
                  <Input placeholder="Para acceso inicial" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={newCompany.ownerId} onChange={e => setNewCompany({...newCompany, ownerId: e.target.value.replace(/\D/g, '')})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contraseña Inicial</Label>
                  <Input placeholder="admin123" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={newCompany.ownerPassword} onChange={e => setNewCompany({...newCompany, ownerPassword: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddCompany} disabled={isSubmitting} className="w-full h-16 bg-black text-white rounded-2xl font-black text-lg shadow-2xl">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'ACTIVAR NUEVA EMPRESA'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
