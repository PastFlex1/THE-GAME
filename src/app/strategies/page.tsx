
"use client";

import React, { useState, useMemo } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Megaphone, 
  Plus, 
  Rocket, 
  Tag, 
  Users2, 
  Calendar, 
  Loader2, 
  Trash2, 
  Zap,
  Globe,
  Clock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, doc, deleteDoc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn, getEcuadorDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function StrategiesPage() {
  const firestore = useFirestore();
  const { resolvedIdentification } = useUser();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStrategy, setNewStrategy] = useState({
    title: '',
    description: '',
    type: 'PROMO',
    startDate: getEcuadorDate(new Date()),
    endDate: '',
    isActive: true
  });

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  const isOwner = resolvedIdentification === '1793221927' || userProfile?.roleId === 'OWNER';

  const strategiesQuery = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification || !isOwner) return null;
    return query(collection(firestore, 'national_strategies'));
  }, [firestore, resolvedIdentification, isOwner]);
  const { data: strategies, isLoading } = useCollection(strategiesQuery);

  const handleAddStrategy = () => {
    if (!newStrategy.title || !newStrategy.description || !firestore) return;
    addDocumentNonBlocking(collection(firestore, 'national_strategies'), {
      ...newStrategy,
      createdAt: new Date().toISOString(),
      createdBy: resolvedIdentification
    });
    setIsAddOpen(false);
    setNewStrategy({ title: '', description: '', type: 'PROMO', startDate: getEcuadorDate(new Date()), endDate: '', isActive: true });
    toast({ title: "Estrategia Lanzada", description: "Sincronizada con las 45 sucursales." });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PROMO': return <Tag className="w-5 h-5" />;
      case 'LAUNCH': return <Rocket className="w-5 h-5" />;
      case 'EVENT': return <Users2 className="w-5 h-5" />;
      default: return <Megaphone className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PROMO': return "bg-green-50 text-green-600";
      case 'LAUNCH': return "bg-purple-50 text-purple-600";
      case 'EVENT': return "bg-blue-50 text-blue-600";
      default: return "bg-slate-50 text-slate-600";
    }
  };

  if (!isOwner && !loadingProfile) {
    return (
      <DashboardShell>
        <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Acceso Denegado</h1>
          <p className="text-slate-500 max-w-md font-medium">Esta sección es de uso exclusivo para la Gerencia General (Owner).</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Estrategias Nacionales</h1>
            <p className="text-slate-500 font-medium">Lanzamientos, promociones y eventos sincronizados en red.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-16 px-10 rounded-2xl bg-black text-white font-black shadow-2xl hover:scale-[1.02] transition-all">
                <Plus className="w-6 h-6 mr-3" /> LANZAR ACCIÓN
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[3rem] p-12 border-none">
              <DialogHeader>
                <DialogTitle className="text-3xl font-black tracking-tighter">Nueva Directiva Nacional</DialogTitle>
                <DialogDescription className="text-slate-400 font-medium">Esta acción se verá reflejada en todos los puntos de venta.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Título de la Estrategia</Label>
                  <Input placeholder="Ej. Cyber Monday: 3x2 en Sobres" className="h-14 rounded-2xl bg-slate-50 border-none font-bold" value={newStrategy.title} onChange={(e) => setNewStrategy({...newStrategy, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tipo de Acción</Label>
                    <Select onValueChange={(val) => setNewStrategy({...newStrategy, type: val})} defaultValue="PROMO">
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="PROMO">Promoción de Ventas</SelectItem>
                        <SelectItem value="LAUNCH">Lanzamiento de Producto</SelectItem>
                        <SelectItem value="EVENT">Evento de Intercambio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Fin de Campaña</Label>
                    <Input 
                      type="date" 
                      max="9999-12-31"
                      className="h-14 rounded-2xl bg-slate-50 border-none font-bold" 
                      value={newStrategy.endDate} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.split('-')[0].length <= 4) setNewStrategy({...newStrategy, endDate: val});
                      }} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Instrucciones para Cajeros</Label>
                  <Textarea placeholder="Describa la mecánica para que el personal la ejecute..." className="min-h-[120px] rounded-2xl bg-slate-50 border-none font-medium" value={newStrategy.description} onChange={(e) => setNewStrategy({...newStrategy, description: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddStrategy} className="w-full h-16 rounded-2xl bg-black text-white font-black text-lg gap-2">
                  <Globe className="w-5 h-5" /> SINCRONIZAR RED NACIONAL
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-slate-200" /></div>
          ) : strategies?.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
              <Megaphone className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-bold italic">No hay estrategias nacionales activas.</p>
            </div>
          ) : (
            strategies?.map((strategy) => (
              <Card key={strategy.id} className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all duration-500">
                <div className={cn("h-2.5 w-full", strategy.isActive ? "bg-black" : "bg-slate-200")} />
                <CardHeader className="p-8 pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-3 rounded-2xl", getTypeColor(strategy.type))}>
                      {getTypeIcon(strategy.type)}
                    </div>
                    <Badge className="bg-slate-900 text-white border-none font-black text-[9px] uppercase tracking-widest">
                      {strategy.type}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-black text-slate-900 leading-tight mb-2">
                    {strategy.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expira: {strategy.endDate || 'Sin límite'}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-4 space-y-6">
                  <p className="text-slate-500 text-sm font-medium leading-relaxed line-clamp-3">
                    {strategy.description}
                  </p>
                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <Button variant="ghost" className="p-0 h-auto font-black text-[10px] uppercase text-slate-400 hover:text-red-500 gap-2" onClick={() => deleteDoc(doc(firestore, 'national_strategies', strategy.id))}>
                      <Trash2 className="w-3.5 h-3.5" /> Finalizar
                    </Button>
                    <Button variant="link" className="p-0 h-auto font-black text-[10px] uppercase text-black gap-1">
                      Ver Ejecución <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
