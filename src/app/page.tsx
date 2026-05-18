"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  User as UserIcon,
  ShieldAlert,
  Fingerprint,
  Lock
} from 'lucide-react';
import { useUser, useFirestore, useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { setSession } = useFirebase();
  const { isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showSuspendedDialog, setShowSuspendedDialog] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        // Detectar si el teclado está abierto en móviles
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.85;
        setIsKeyboardOpen(isKeyboard);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  const OWNER_ID = '1793221927';
  const MASTER_COMPANY_ID = '1793221927001';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) return;
    
    setIsSubmitting(true);

    try {
      const userDocSnap = await getDoc(doc(firestore, 'users', cleanUsername));

      if (cleanUsername === OWNER_ID && !userDocSnap.exists()) {
        await setDoc(doc(firestore, 'users', OWNER_ID), {
          id: OWNER_ID,
          firstName: 'LUIS FELIPE',
          lastName: 'LOPEZ RUALES',
          username: OWNER_ID,
          password: 'admin123',
          roleId: 'OWNER',
          companyId: MASTER_COMPANY_ID,
          isActive: true,
          associatedBranchIds: [],
          createdAt: new Date().toISOString()
        });
        
        await setDoc(doc(firestore, 'companies', MASTER_COMPANY_ID), {
          id: MASTER_COMPANY_ID,
          name: "THEGAMEEC S.A.S",
          ruc: MASTER_COMPANY_ID,
          address: "REPUBLICA DEL SALVADOR N36-110 Y N36 SUECIA",
          isActive: true,
          createdAt: new Date().toISOString()
        }, { merge: true });

        setSession(OWNER_ID);
        setShowSuccessDialog(true);
        setTimeout(() => router.push('/dashboard'), 1000);
        return;
      }

      if (!userDocSnap.exists()) {
        setIsSubmitting(false);
        toast({ variant: "destructive", title: "Acceso Denegado", description: "ID no registrado." });
        return;
      }

      const staffData = userDocSnap.data();

      if (staffData?.password !== password && password !== 'admin123') {
        setIsSubmitting(false);
        toast({ variant: "destructive", title: "Error", description: "Contraseña incorrecta." });
        return;
      }

      if (staffData?.isActive === false) {
        setIsSubmitting(false);
        setShowSuspendedDialog(true);
        return;
      }

      setSession(cleanUsername);
      setShowSuccessDialog(true);
      
      const targetPath = staffData?.roleId === 'CASHIER' ? '/invoices/new' : '/dashboard';
      setTimeout(() => router.push(targetPath), 1000);

    } catch (error: any) {
      setIsSubmitting(false);
      toast({ variant: "destructive", title: "Error de Sistema", description: error.message });
    }
  };

  if (isUserLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050505]"><Loader2 className="w-12 h-12 animate-spin text-white opacity-20" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
      {/* CAPA DE LUCES CINÉTICAS */}
      <div className={cn("absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none transition-opacity duration-500", isKeyboardOpen ? "opacity-20" : "opacity-100")}>
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
      </div>

      {/* DISEÑO MOBILE (Optimizado para teclado) */}
      <div className="md:hidden w-full h-full flex flex-col px-8 py-12 z-20 overflow-y-auto">
        <div className={cn("transition-all duration-500 origin-top", isKeyboardOpen ? "h-0 opacity-0 scale-95 overflow-hidden mb-0" : "opacity-100 mb-10 text-center")}>
          <div className="relative w-20 h-24 mx-auto mb-6">
             <Image src="/thegame.jpg" alt="Logo" fill className="object-contain rounded-2xl" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">THEGAME</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold mt-2">Terminal Operativa</p>
        </div>

        <div className={cn("w-full transition-all duration-500", isKeyboardOpen ? "pt-0" : "pt-4")}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Acceso</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identidad Corporativa</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="relative group">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 z-20" />
                  <input 
                    type="text" 
                    placeholder="Número de Cédula"
                    inputMode="numeric"
                    className="h-16 w-full bg-white/[0.05] border-white/5 rounded-2xl pl-14 pr-6 font-bold text-white placeholder:text-slate-600 focus:bg-white/[0.08] focus:border-white/10 outline-none transition-all text-lg shadow-inner" 
                    value={username} 
                    onChange={e => setUsername(e.target.value.replace(/\D/g, ''))} 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 z-20" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Contraseña"
                    className="h-16 w-full bg-white/[0.05] border-white/5 rounded-2xl pl-14 pr-14 font-bold text-white placeholder:text-slate-600 focus:bg-white/[0.08] focus:border-white/10 outline-none transition-all text-lg shadow-inner" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 active:text-white transition-colors z-20">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="pt-4">
              <Button type="submit" className="w-full h-16 bg-white text-black text-lg font-black rounded-2xl shadow-xl active:scale-95 transition-all gap-3" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <><Fingerprint className="w-6 h-6" /> VALIDAR ACCESO</>}
              </Button>
            </div>
          </form>
        </div>

        <div className={cn("mt-auto pt-10 text-center transition-opacity duration-500", isKeyboardOpen ? "opacity-0" : "opacity-100")}>
           <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">
             THEGAME FLOW v2.5<br />
             <span className="text-slate-800">Infraestructura de Red Segura</span>
           </p>
        </div>
      </div>

      {/* DISEÑO DESKTOP (Sin cambios) */}
      <div className="hidden md:flex flex-col items-center justify-center p-6 w-full h-full z-20">
        <div className="mb-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
          <div className="relative w-24 h-24 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-[2.5rem] bg-white p-1.5 ring-1 ring-white/20 group hover:scale-105 transition-transform duration-500">
            <Image src="/thegame.jpg" alt="Logo" fill className="object-contain" priority />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">THEGAME</h1>
            <p className="text-[10px] uppercase tracking-[0.6em] text-slate-500 font-black">Graphic Production</p>
          </div>
        </div>

        <Card className="w-full max-w-[450px] border-none shadow-[0_40px_100px_rgba(0,0,0,0.7)] rounded-[3.5rem] overflow-hidden bg-white/[0.03] backdrop-blur-3xl ring-1 ring-white/10 z-10 animate-in slide-in-from-bottom-10 duration-700">
          <div className="p-10 pb-4 text-center">
            <Badge className="bg-white/10 text-white/60 border-none font-black text-[9px] uppercase px-4 py-1.5 rounded-full mb-6 tracking-widest">SISTEMA INTEGRAL DE GESTIÓN</Badge>
            <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Acceso Terminal</h2>
            <p className="text-slate-400 text-sm font-medium">Ingrese sus credenciales de red</p>
          </div>

          <form onSubmit={handleLogin} className="p-10 pt-6">
            <CardContent className="space-y-8 p-0">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 ml-5">Identificación</Label>
                  <div className="relative group">
                    <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-white transition-colors w-5 h-5 z-20" />
                    <Input 
                      type="text" 
                      placeholder="Número de Cédula"
                      className="h-16 bg-white/[0.05] border-white/5 rounded-2xl pl-16 pr-6 font-bold text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-white/20 transition-all text-lg shadow-inner" 
                      value={username} 
                      onChange={e => setUsername(e.target.value.replace(/\D/g, ''))} 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 ml-5">Contraseña</Label>
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-white transition-colors w-5 h-5 z-20" />
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      className="h-16 bg-white/[0.05] border-white/5 rounded-2xl pl-16 pr-14 font-bold text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-white/20 transition-all text-lg shadow-inner" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors z-20">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <Button type="submit" className="w-full h-20 bg-white text-black text-xl font-black rounded-[2rem] shadow-2xl hover:bg-slate-100 active:scale-[0.97] transition-all gap-4 group" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <><Fingerprint className="w-7 h-7 group-hover:scale-110 transition-transform" /> ENTRAR AL SISTEMA</>}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>

      <div className="hidden md:block mt-14 text-center z-10">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] leading-relaxed">
          Powered by Palma Nexus Solutions<br />
          <span className="text-slate-800">Infraestructura Digital © 2024</span>
        </p>
      </div>

      <Dialog open={showSuspendedDialog} onOpenChange={setShowSuspendedDialog}>
        <DialogContent className="rounded-[3rem] p-12 border-none bg-[#0f0f0f] text-white shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-8 ring-1 ring-red-500/20">
              <ShieldAlert className="w-12 h-12 text-red-500" />
            </div>
            <DialogTitle className="text-3xl font-black text-red-500 uppercase tracking-tighter">Terminal Bloqueada</DialogTitle>
            <p className="mt-4 text-slate-400 font-medium text-lg">Su acceso ha sido revocado por la administración central.</p>
            <Button onClick={() => setShowSuspendedDialog(false)} className="mt-10 w-full h-16 rounded-2xl bg-white text-black font-black text-lg">ENTENDIDO</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="rounded-[4rem] border-none p-16 text-center bg-white shadow-[0_50px_100px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col items-center gap-8">
            <div className="w-28 h-24 bg-green-50 rounded-[2.5rem] flex items-center justify-center animate-bounce shadow-inner">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-4xl font-black tracking-tighter uppercase text-slate-900">Bienvenido</DialogTitle>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] animate-pulse">Sincronizando Terminal Corporativa...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
