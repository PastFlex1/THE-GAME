"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LogOut, 
  Menu,
  Briefcase,
  Loader2,
  Boxes,
  BarChart3,
  Zap,
  Lock,
  History,
  AlertTriangle,
  Globe,
  MoreHorizontal,
  Home,
  FileText,
  Building2,
  User as UserIcon,
  ShieldCheck,
  ArrowRightLeft,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();
  const { resolvedIdentification, isUserLoading, logout, companyInfo } = useUser();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !resolvedIdentification) return null;
    return doc(firestore, 'users', resolvedIdentification);
  }, [firestore, resolvedIdentification]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sidebar_state') : null;
    if (saved !== null) {
      setIsSidebarOpen(saved === 'true');
    }

    const handleResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.8;
        setIsKeyboardOpen(isKeyboard);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isUserLoading && !resolvedIdentification) {
      router.push('/');
    }
  }, [resolvedIdentification, isUserLoading, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const userRole = userProfile?.roleId;
  const isOwner = resolvedIdentification === '1793221927' || userRole === 'OWNER';

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    localStorage.setItem('sidebar_state', String(newState));
  };

  const roleLabels: Record<string, string> = { 
    'ADMIN': 'Administrador', 
    'ACCOUNTANT': 'Contador', 
    'CASHIER': 'Cajero', 
    'OWNER': 'Propietario' 
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'] },
    { name: 'Empresas', href: '/companies', icon: Globe, roles: ['OWNER'], superOnly: true },
    { name: 'Sucursales', href: '/branches', icon: Building2, roles: ['OWNER'] },
    { name: 'Personal', href: '/personal', icon: Briefcase, roles: ['OWNER', 'ADMIN'] },
    { name: 'Inventario', href: '/inventory', icon: Boxes, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER'] },
    { name: 'Auditoría Mov.', href: '/inventory/movements', icon: ArrowRightLeft, roles: ['OWNER', 'ADMIN'] },
    { name: 'Alertas Stock', href: '/alerts', icon: AlertTriangle, roles: ['OWNER'] },
    { name: 'Nueva Factura', href: '/invoices/new', icon: Zap, roles: ['CASHIER', 'ADMIN', 'OWNER', 'ACCOUNTANT'] },
    { name: 'Facturación', href: '/invoices', icon: FileText, roles: ['OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTANT'] },
    { name: 'Cierre de Caja', href: '/cashier/closure', icon: Lock, roles: ['CASHIER', 'ADMIN', 'OWNER'] },
    { name: 'Historial de Arqueos', href: '/accounting/closures', icon: History, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT', 'CASHIER'] },
    { name: 'Analítica', href: '/reports', icon: BarChart3, roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'] },
  ];

  const filteredNavigation = useMemo(() => {
    return navigation.filter(item => {
      if (item.superOnly && resolvedIdentification !== '1793221927') return false;
      if (isOwner) return true;
      return item.roles.includes(userRole as string);
    });
  }, [userRole, isOwner, resolvedIdentification]);

  const bottomNavItems = useMemo(() => {
    if (userRole === 'CASHIER') {
      return [
        { name: 'Facturas', href: '/invoices', icon: FileText },
        { name: 'Vender', href: '/invoices/new', icon: Zap, special: true },
        { name: 'Stock', href: '/inventory', icon: Boxes },
        { name: 'Cierre', href: '/cashier/closure', icon: Lock },
      ];
    }
    return [
      { name: 'Inicio', href: '/dashboard', icon: Home },
      { name: 'Facturas', href: '/invoices', icon: FileText },
      { name: 'Vender', href: '/invoices/new', icon: Zap, special: true },
      { name: 'Stock', href: '/inventory', icon: Boxes },
    ];
  }, [userRole]);

  const displayUserName = userProfile?.firstName 
    ? `${userProfile.firstName} ${userProfile.lastName}` 
    : (isOwner ? "PROPIETARIO" : "Usuario");

  const companyName = companyInfo?.name || "THEGAME";

  if (isUserLoading || isProfileLoading || !resolvedIdentification) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-black" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Validando Acceso...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden font-sans">
      <aside className={cn(
        "hidden md:flex bg-white border-r border-slate-200 transition-all duration-500 ease-in-out flex-col z-30 relative",
        isSidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="relative w-10 h-10 shrink-0 shadow-lg overflow-hidden rounded-xl bg-white p-1">
            <Image src="/thegame.jpg" alt="Logo" fill className="object-contain" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col leading-none overflow-hidden">
              <span className="font-black text-base tracking-tighter text-slate-900 truncate uppercase">{companyName}</span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Corporativo</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-black text-white shadow-lg" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-black"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-black"
                )} />
                {isSidebarOpen && <span className="font-bold text-sm tracking-tight">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-slate-50 transition-all outline-none group">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-xs shrink-0">
                  {displayUserName.charAt(0)}
                </div>
                {isSidebarOpen && (
                  <div className="flex flex-col items-start text-left overflow-hidden">
                    <span className="text-[11px] font-black text-slate-900 truncate w-full leading-tight uppercase">{displayUserName}</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">
                      {roleLabels[userRole as string] || userRole || 'Staff'}
                    </span>
                    {userProfile?.isPayless && (
                      <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter mt-0.5 animate-in fade-in slide-in-from-top-1">
                        EJECUTIVO PAYLESS
                      </span>
                    )}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
              <DropdownMenuLabel className="text-[10px] uppercase font-black px-3 py-2 text-slate-400">Sesión: {resolvedIdentification}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsLogoutDialogOpen(true)} className="text-destructive font-bold rounded-xl cursor-pointer p-3 hover:bg-red-50">
                <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isSidebarOpen && (
            <div className="mt-4 px-4 pb-2 border-t border-slate-100 pt-4">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] leading-tight">
                Desarrollado por<br />
                <span className="text-slate-400">Palma Nexus Solutions</span><br />
                <span className="text-slate-400">099 821 2307</span>
              </p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 md:h-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 md:px-10 shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden md:flex rounded-xl bg-slate-50">
              <Menu className="w-5 h-5 text-slate-600" />
            </Button>
            
            <div className="flex items-center gap-3 md:hidden">
              <div className="w-8 h-8 relative shadow-md rounded-lg overflow-hidden bg-white p-1">
                 <Image src="/thegame.jpg" alt="Logo" fill className="object-contain" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-black text-base tracking-tighter text-slate-900 uppercase">THEGAME</span>
                {userProfile?.isPayless && (
                   <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest">EJECUTIVO PAYLESS</span>
                )}
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pathname === '/dashboard' ? 'PANEL CENTRAL' : 'GESTIÓN OPERATIVA'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter">Sincronizado</span>
             </div>
             
             <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => setIsLogoutDialogOpen(true)} 
               className="md:hidden h-10 w-10 rounded-xl text-red-500 hover:bg-red-50"
             >
               <LogOut className="w-5 h-5" />
             </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 bg-[#F1F5F9] pb-24 md:pb-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        <nav className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around px-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] transition-all duration-300",
          isKeyboardOpen ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        )}>
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            if (item.special) {
              return (
                <Link key={item.name} href={item.href} className="flex flex-col items-center -translate-y-4">
                  <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-white shadow-xl ring-4 ring-[#F1F5F9] active:scale-95 transition-transform">
                    <Zap className="w-7 h-7 fill-white" />
                  </div>
                  <span className="text-[9px] font-black text-black uppercase mt-1 tracking-widest">{item.name}</span>
                </Link>
              );
            }
            return (
              <Link key={item.name} href={item.href} className={cn(
                "flex flex-col items-center gap-1 p-2 transition-all active:scale-90",
                isActive ? "text-black" : "text-slate-400"
              )}>
                <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
                <span className="text-[9px] font-black uppercase tracking-tighter">{item.name}</span>
              </Link>
            );
          })}
          
          {userRole !== 'CASHIER' && (
            <Sheet open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center gap-1 p-2 text-slate-400 active:scale-90 transition-all">
                  <MoreHorizontal className="w-6 h-6" />
                  <span className="text-[9px] font-black uppercase tracking-tighter">Más</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[75vh] rounded-t-[3rem] p-0 border-none bg-white shadow-2xl">
                <SheetHeader className="p-10 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <SheetTitle className="text-3xl font-black tracking-tighter uppercase">Navegación</SheetTitle>
                      <p className="text-xs font-medium text-slate-400">Gestión Integral THEGAME</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center p-2">
                      <Image src="/thegame.jpg" alt="Logo" width={32} height={32} />
                    </div>
                  </div>
                </SheetHeader>
                <div className="p-8 pt-4 grid grid-cols-2 gap-4 overflow-y-auto max-h-[50vh] custom-scrollbar">
                  {filteredNavigation.map((item) => (
                    <Link 
                      key={item.name} 
                      href={item.href} 
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-[2rem] gap-3 active:scale-95 transition-all group"
                    >
                      <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-black group-hover:text-white transition-colors">
                        <item.icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tighter text-center">{item.name}</span>
                    </Link>
                  ))}
                </div>
                <div className="p-8 border-t border-slate-100 mt-4">
                  <div className="mb-6 text-center">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                      Desarrollado por Palma Nexus Solutions - 099 821 2307
                    </p>
                  </div>
                  <Button onClick={() => setIsLogoutDialogOpen(true)} variant="ghost" className="w-full h-16 rounded-2xl bg-red-50 text-red-600 font-black gap-2">
                    <LogOut className="w-5 h-5" /> CERRAR SESIÓN CORPORATIVA
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </nav>
      </div>

      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="flex flex-col items-center text-center">
               <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6">
                 <LogOut className="w-10 h-10 text-red-600" />
               </div>
               <AlertDialogTitle className="text-2xl font-black tracking-tighter">¿Seguro de cerrar sesión?</AlertDialogTitle>
               <AlertDialogDescription className="text-slate-500 font-medium py-2">
                 Su progreso actual ha sido guardado. Deberá ingresar sus credenciales nuevamente para acceder.
               </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
            <AlertDialogCancel className="h-14 rounded-2xl font-bold flex-1 border-slate-100">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="h-14 rounded-2xl font-black bg-black text-white hover:bg-slate-900 flex-1">CERRAR SESIÓN</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}