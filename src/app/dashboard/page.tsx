"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { 
  Building2, 
  TrendingUp, 
  Plus,
  Calendar,
  Layers,
  Zap,
  ChevronRight,
  Loader2,
  PieChart,
  Globe,
  Wallet,
  AlertTriangle,
  PackageSearch,
  Activity,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Factory,
  Truck,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, doc, where, onSnapshot } from 'firebase/firestore';
import { 
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { 
  Area, 
  AreaChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { resolvedIdentification, isUserLoading, companyId, companyInfo } = useUser();
  const [mountedDate, setMountedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'local' | 'global'>('local');

  useEffect(() => {
    setMountedDate(new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase());
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);
  const { data: userProfile, isLoading: loadingProfile } = useDoc(userDocRef);

  useEffect(() => {
    if (!loadingProfile && userProfile?.roleId === 'CASHIER') {
      router.push('/invoices/new');
    }
  }, [userProfile, loadingProfile, router]);

  const isSuperAdmin = resolvedIdentification === '1793221927';
  const isOwner = isSuperAdmin || userProfile?.roleId === 'OWNER';
  const assignedBranchIds = useMemo(() => userProfile?.associatedBranchIds || [], [userProfile]);

  const branchesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId || loadingProfile) return null;
    const baseCol = collection(firestore, 'branches');
    if (isSuperAdmin) return query(baseCol);
    return query(baseCol, where('companyId', '==', companyId));
  }, [firestore, companyId, loadingProfile, isSuperAdmin]);
  const { data: allBranches } = useCollection(branchesQuery);

  const matricesId = useMemo(() => {
    if (!allBranches) return 'matrix';
    const matriz = allBranches.find(b => 
      b.name.toUpperCase().includes('REPUBLICA') && b.name.toUpperCase().includes('SALVADOR')
    );
    return matriz?.id || 'matrix';
  }, [allBranches]);

  const activeBranchName = useMemo(() => {
    const coName = companyInfo?.name || "THEGAMEEC S.A.S";
    if (isOwner && viewMode === 'global') return `${coName} - RED NACIONAL`;
    if (isOwner && viewMode === 'local') return `${coName} - MATRIZ`;
    
    if (assignedBranchIds.length > 0 && allBranches) {
      const branch = allBranches.find(b => b.id === assignedBranchIds[0]);
      if (branch) return `${coName} - ${branch.name.toUpperCase()}`;
    }
    
    return coName;
  }, [isOwner, viewMode, assignedBranchIds, allBranches, companyInfo]);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !companyId || loadingProfile) return null;
    const baseQuery = collection(firestore, 'invoices');
    let q = query(baseQuery);
    
    if (!isSuperAdmin) {
      q = query(baseQuery, where('companyId', '==', companyId));
    }

    if (isOwner && viewMode === 'global') return q;
    if (isOwner && viewMode === 'local') return query(q, where('branchId', '==', matricesId));
    if (assignedBranchIds.length > 0 && assignedBranchIds.length <= 30) {
      return query(q, where('branchId', 'in', assignedBranchIds));
    }
    return query(q, where('branchId', '==', 'none'));
  }, [firestore, companyId, isOwner, viewMode, matricesId, assignedBranchIds, loadingProfile, isSuperAdmin]);
  const { data: baseRawInvoices, isLoading: baseLoadingInvoices } = useCollection(invoicesQuery);

  const [multiChunkInvoices, setMultiChunkInvoices] = useState<any[]>([]);
  const [multiInvoicesLoading, setMultiInvoicesLoading] = useState(false);

  useEffect(() => {
    if (!firestore || loadingProfile || isOwner || assignedBranchIds.length <= 30) return;
    
    setMultiInvoicesLoading(true);
    const unsubs: any[] = [];
    const combinedData: Record<string, any> = {};

    const chunks = [];
    for (let i = 0; i < assignedBranchIds.length; i += 30) {
      chunks.push(assignedBranchIds.slice(i, i + 30));
    }

    chunks.forEach(chunk => {
      const q = query(collection(firestore, 'invoices'), where('branchId', 'in', chunk));
      const sub = onSnapshot(q, (snap: any) => {
        snap.docChanges().forEach((change: any) => {
           if (change.type === 'removed') {
             delete combinedData[change.doc.id];
           } else {
             combinedData[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
           }
        });
        setMultiChunkInvoices(Object.values(combinedData));
        setMultiInvoicesLoading(false);
      });
      unsubs.push(sub);
    });

    return () => unsubs.forEach(u => u());
  }, [firestore, assignedBranchIds, isOwner, loadingProfile]);

  const invoices = (assignedBranchIds.length > 30 && !isOwner) ? multiChunkInvoices : baseRawInvoices;
  const loadingInvoices = (assignedBranchIds.length > 30 && !isOwner) ? multiInvoicesLoading : baseLoadingInvoices;

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !companyId || loadingProfile) return null;
    const baseCol = collection(firestore, 'product_services');
    let q = query(baseCol);
    
    if (!isSuperAdmin) {
      q = query(baseCol, where('companyId', '==', companyId));
    }

    if (isOwner) return q;
    if (assignedBranchIds.length > 0) {
      if (assignedBranchIds.length > 30) return q;
      return query(q, where('branchId', 'in', assignedBranchIds));
    }
    return query(q, where('branchId', '==', 'none'));
  }, [firestore, companyId, loadingProfile, isOwner, assignedBranchIds, isSuperAdmin]);
  const { data: allProducts } = useCollection(productsQuery);

  const controlData = useMemo(() => {
    if (!invoices || !allBranches || !allProducts) return null;

    const invs = [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const authorizedInvs = isOwner ? invs : invs.filter(inv => assignedBranchIds.includes(inv.branchId));
    
    const activeInvoices = authorizedInvs.filter(i => i.status !== 'CANCELLED');
    const revenue = activeInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const cost = activeInvoices.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);
    const profit = revenue - cost;

    const stockAlerts = allProducts.filter(p => {
      const isAuthProd = isOwner || assignedBranchIds.includes(p.branchId);
      return isAuthProd && (p.type === 'ALBUM' || p.type === 'SOBRE') && (p.inventoryLevel || 0) <= 10;
    });

    const branchesToEvaluate = isOwner ? allBranches : allBranches.filter(b => assignedBranchIds.includes(b.id));

    const branchPerformance = branchesToEvaluate.map(b => {
      const bInvs = activeInvoices.filter(inv => inv.branchId === b.id);
      const rev = bInvs.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
      const cst = bInvs.reduce((acc, inv) => acc + (inv.totalCost || 0), 0);
      return { 
        name: b.name, 
        revenue: rev, 
        profit: rev - cst,
        margin: rev > 0 ? ((rev - cst) / rev) * 100 : 0,
        count: bInvs.length,
        type: b.type || 'MEDIA'
      };
    }).sort((a, b) => b.profit - a.profit);

    const rotationMap: Record<string, number> = {
      'SOBRES': 0,
      'ÁLBUMES': 0,
      'CROMOS': 0,
      'CAJAS': 0
    };

    const trendMap: Record<string, { billed: number, annulled: number }> = {};
    
    // DETECCIÓN DE FECHA INICIAL (PRIMERA FACTURA)
    let firstDate = new Date();
    firstDate.setDate(firstDate.getDate() - 6); // Por defecto 7 días

    if (invs.length > 0) {
      const oldestInv = invs[invs.length - 1]; // Invs está ordenado DESC
      if (oldestInv.createdAt) {
        const d = new Date(oldestInv.createdAt);
        firstDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));
      }
    }

    const nowEC = new Date(new Date().getTime() - (5 * 60 * 60 * 1000));
    let iter = new Date(firstDate);
    iter.setHours(0, 0, 0, 0);
    const endIter = new Date(nowEC);
    endIter.setHours(23, 59, 59, 999);

    // Rellenar desde la primera factura hasta hoy
    while (iter <= endIter) {
      const ds = iter.toISOString().split('T')[0];
      trendMap[ds] = { billed: 0, annulled: 0 };
      iter.setDate(iter.getDate() + 1);
    }

    authorizedInvs.forEach(inv => {
      const d = new Date(inv.createdAt);
      const ecDate = new Date(d.getTime() - (5 * 60 * 60 * 1000));
      const ds = ecDate.toISOString().split('T')[0];
      
      if (trendMap[ds]) {
        const amt = Number(inv.totalAmount) || 0;
        if (inv.status !== 'CANCELLED') {
          trendMap[ds].billed += amt;
          
          inv.items?.forEach((item: any) => {
            const name = (item.productName || '').toUpperCase();
            if (name.includes('SOBRE')) rotationMap['SOBRES'] += item.quantity || 0;
            else if (name.includes('ALBUM') || name.includes('LIBRO')) rotationMap['ÁLBUMES'] += item.quantity || 0;
            else if (name.includes('CROMO')) rotationMap['CROMOS'] += item.quantity || 0;
            else rotationMap['CAJAS'] += item.quantity || 0;
          });
        } else {
          trendMap[ds].annulled += amt;
        }
      }
    });

    const dailyTrend = Object.entries(trendMap)
      .map(([date, v]) => ({ 
        date, 
        billed: v.billed, 
        annulled: -v.annulled // Negativo para picos bajos (valles)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const rotation = Object.entries(rotationMap)
      .map(([name, value]) => ({ name, value }))
      .filter(r => r.value > 0);

    return {
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      stockAlerts,
      branchPerformance,
      rotation,
      dailyTrend,
      totalTransactions: activeInvoices.length
    };
  }, [invoices, allBranches, allProducts, isOwner, assignedBranchIds]);

  const isLoading = loadingProfile || loadingInvoices || isUserLoading;

  if (userProfile?.roleId === 'CASHIER') return null;

  return (
    <DashboardShell>
      <div className="space-y-6 md:space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.4em]">
              <Calendar className="w-3 h-3" />
              <span>{mountedDate || 'CARGANDO...'}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">
              Bienvenido{(!isLoading && userProfile?.firstName) ? `, ${userProfile.firstName}` : ''}
            </h1>
            <p className="text-slate-500 font-medium text-base md:text-lg">
              {isOwner 
                  ? (viewMode === 'global' ? 'Gerencia THEGAME' : 'Operación Matriz') 
                  : `Sede ${activeBranchName}`}
              <span className="hidden md:inline"> | Integración Total: Producción → Inventario → Venta</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            {isOwner && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="bg-slate-100 p-1 rounded-2xl h-12 md:h-14">
                <TabsList className="bg-transparent border-none w-full sm:w-auto">
                  <TabsTrigger value="global" className="flex-1 sm:flex-none rounded-xl font-bold px-4 md:px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm">
                    <Globe className="w-3 h-3 md:w-4 md:h-4 mr-2" /> GLOBAL
                  </TabsTrigger>
                  <TabsTrigger value="local" className="flex-1 sm:flex-none rounded-xl font-bold px-4 md:px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm">
                    <Factory className="w-3 h-3 md:w-4 md:h-4 mr-2" /> MATRIZ
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button asChild className="h-12 md:h-14 px-6 md:px-8 rounded-2xl bg-black text-white font-bold shadow-2xl hover:scale-[1.02] transition-all text-sm md:text-base">
              <Link href="/inventory"><Truck className="w-4 h-4 md:w-5 md:h-5 mr-2" />Logística</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {controlData && (
            <>
              <Card className={cn("border-none shadow-sm rounded-2xl md:rounded-[2rem] overflow-hidden border-l-4", controlData.stockAlerts.length > 0 ? "bg-red-50 border-red-500" : "bg-green-50 border-green-500")}>
                <CardContent className="p-4 md:p-6 flex items-start gap-4">
                  <div className={cn("p-2.5 md:p-3 rounded-xl text-white shadow-lg", controlData.stockAlerts.length > 0 ? "bg-red-500" : "bg-green-500")}>
                    {controlData.stockAlerts.length > 0 ? <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" /> : <Activity className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  <div className="space-y-1">
                    <p className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest", controlData.stockAlerts.length > 0 ? "text-red-600" : "text-green-600")}>
                      {isOwner ? 'Reposición Nacional' : 'Reposición Sucursal'}
                    </p>
                    <p className="text-xs md:text-sm font-bold text-slate-900 leading-tight">
                      {controlData.stockAlerts.length > 0 
                        ? `${controlData.stockAlerts.length} líneas críticas.` 
                        : 'Stock optimizado.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-2xl md:rounded-[2.5rem] overflow-hidden border-l-4 bg-blue-50 border-blue-500">
                <CardContent className="p-4 md:p-6 flex items-start gap-4">
                  <div className="p-2.5 md:p-3 bg-blue-500 rounded-xl text-white shadow-lg"><Truck className="w-4 h-4 md:w-5 md:h-5" /></div>
                  <div className="space-y-1">
                    <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-600">Velocidad Local</p>
                    <p className="text-xs md:text-sm font-bold text-slate-900">{controlData.totalTransactions} transacciones.</p>
                    <p className="text-[8px] md:text-[9px] text-slate-500 font-medium italic">Sincronización Activa</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-slate-900 shadow-sm rounded-2xl md:rounded-[2.5rem] overflow-hidden border-l-4 border-slate-400 sm:col-span-2 lg:col-span-1">
                <CardContent className="p-4 md:p-6 flex items-start gap-4">
                  <div className="p-2.5 md:p-3 bg-white/10 rounded-xl text-white shadow-lg"><PieChart className="w-4 h-4 md:w-5 md:h-5" /></div>
                  <div className="space-y-1">
                    <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Margen de Sede</p>
                    <p className="text-lg md:text-xl font-black text-white">{controlData?.margin.toFixed(1)}%</p>
                    <p className="text-[8px] md:text-[9px] text-slate-500 font-medium whitespace-nowrap">Post-Costo de Producción</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <Card className="lg:col-span-2 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-white p-6 md:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <CardTitle className="text-xl md:text-2xl font-black tracking-tight">Tendencia de Auditoría</CardTitle>
                <CardDescription className="font-medium text-xs md:text-sm">Ventas (altos) vs Anulaciones (bajos) - Historia Completa.</CardDescription>
              </div>
              <Badge variant="outline" className="w-fit bg-slate-50 text-[8px] md:text-[9px] font-black uppercase border-slate-100">ECUADOR UTC-5</Badge>
            </div>
            <div className="h-[250px] md:h-[300px] w-full">
              {isLoading ? (
                <div className="h-full flex items-center justify-center bg-slate-50 rounded-3xl animate-pulse"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={controlData?.dailyTrend || []}>
                    <defs>
                      <linearGradient id="colorBilled" x1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAnnulled" x1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 'bold'}} 
                      minTickGap={40}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 'bold'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1.2rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }} 
                      itemStyle={{ fontWeight: '900', fontSize: '12px' }}
                      labelStyle={{ fontSize: '9px', color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                      formatter={(value: number, name: string) => [
                        `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
                        name === 'billed' ? 'Venta Neta' : 'Anulaciones'
                      ]}
                    />
                    <Area type="monotone" dataKey="billed" name="billed" stroke="#000000" strokeWidth={3} fillOpacity={1} fill="url(#colorBilled)" />
                    <Area type="monotone" dataKey="annulled" name="annulled" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAnnulled)" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-black text-white p-6 md:p-8 group hover:scale-[1.02] transition-all duration-500">
              <div className="flex items-center gap-4 mb-4 md:mb-6">
                <div className="p-2.5 md:p-3 bg-white/10 rounded-2xl"><Wallet className="w-5 h-5 md:w-6 md:h-6 text-green-400" /></div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-white/40 tracking-widest leading-none mb-1">Recaudación</p>
                  <h3 className="text-2xl md:text-3xl font-black tracking-tighter">${controlData?.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 md:pt-6 border-t border-white/10">
                <span className="text-[8px] md:text-[9px] font-bold text-white/20 uppercase">Utilidad Proyectada</span>
                <span className="text-xs md:text-sm font-black text-green-400">+ ${controlData?.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </Card>

            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-white p-6 md:p-8 group hover:scale-[1.02] transition-all duration-500">
              <div className="flex items-center gap-4 mb-4 md:mb-6">
                <div className="p-2.5 md:p-3 bg-blue-50 rounded-2xl"><Boxes className="w-5 h-5 md:w-6 md:h-6 text-blue-600" /></div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Volumen Uds.</p>
                  <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900">{controlData?.rotation.reduce((a, b) => a + b.value, 0)}</h3>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 md:pt-6 border-t border-slate-50">
                <span className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase">Eficiencia Operativa</span>
                <Badge className="bg-blue-500 text-white border-none font-black text-[8px] md:text-[9px] px-2 py-0.5">OPTIMIZADO</Badge>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
          <Card className="lg:col-span-2 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="p-6 md:p-10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl md:text-2xl font-black tracking-tight">{isOwner ? 'Centros de Utilidad (Profit Centers)' : 'Rendimiento de Mi Sede'}</CardTitle>
                <CardDescription className="text-slate-400 font-medium text-xs md:text-sm">Análisis de eficiencia para la toma de decisiones.</CardDescription>
              </div>
              <Badge className="w-fit bg-black text-white border-none font-black text-[9px] md:text-[10px] px-4 py-1.5 rounded-full uppercase">Análisis P&L</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-50">
                      <th className="p-4 md:p-10 pt-0 pb-4 md:pb-6 font-black uppercase tracking-widest text-[9px] md:text-[10px]">Sucursal / Sede</th>
                      <th className="p-4 md:p-10 pt-0 pb-4 md:pb-6 font-black uppercase tracking-widest text-[9px] md:text-[10px]">Ventas</th>
                      <th className="p-4 md:p-10 pt-0 pb-4 md:pb-6 font-black uppercase tracking-widest text-[9px] md:text-[10px]">Utilidad</th>
                      <th className="p-4 md:p-10 pt-0 pb-4 md:pb-6 font-black uppercase tracking-widest text-[9px] md:text-[10px] text-right">Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {controlData?.branchPerformance.slice(0, 6).map((b, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                        <td className="p-4 md:p-10 py-4 md:py-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700 uppercase text-[10px] md:text-sm">{b.name}</span>
                          </div>
                        </td>
                        <td className="p-4 md:p-10 py-4 md:py-6 font-bold text-slate-400">${b.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 md:p-10 py-4 md:py-6 font-black text-slate-900">${b.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 md:p-10 py-4 md:py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-black text-[10px] md:text-xs">{b.margin.toFixed(1)}%</span>
                            {b.margin >= 20 ? <ArrowUpRight className="w-3 h-3 text-green-500" /> : <ArrowDownRight className="w-3 h-3 text-red-500" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none h-fit shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-black text-white p-6 md:p-10 flex flex-col">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h3 className="text-lg md:text-xl font-black uppercase tracking-widest text-white/40">Rotación</h3>
              <Boxes className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-6 md:space-y-8">
              {controlData?.rotation.map((item, idx) => {
                const maxVal = Math.max(...(controlData?.rotation.map(r => r.value) || [1]), 1);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span>{item.name}</span>
                      <span>{item.value} uds</span>
                    </div>
                    <div className="h-2 md:h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-1000", 
                          idx === 0 ? "bg-blue-500" : 
                          idx === 1 ? "bg-green-500" : 
                          idx === 2 ? "bg-purple-500" : "bg-amber-500"
                        )}
                        style={{ width: `${(item.value / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              <div className="pt-6 md:pt-8 border-t border-white/10">
                <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 md:mb-4">Stock Crítico</p>
                <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                  <span className="text-[10px] md:text-xs font-bold text-red-200">Monitoreo activado.</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
