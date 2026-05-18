
"use client";

import React, { useMemo } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateAccessKey } from '@/lib/sri-xml-generator';
import { generateBillingPDF } from '@/lib/billing-pdf-generator';
import Barcode from 'react-barcode';
import { Badge } from '@/components/ui/badge';

interface InvoiceRideViewProps {
  invoiceId: string;
  onClose?: () => void;
}

export function InvoiceRideView({ invoiceId, onClose }: InvoiceRideViewProps) {
  const firestore = useFirestore();

  const invoiceRef = useMemoFirebase(() => {
    if (!firestore || !invoiceId) return null;
    return doc(firestore, 'invoices', invoiceId);
  }, [firestore, invoiceId]);

  const { data: invoice, isLoading } = useDoc(invoiceRef);

  const esConsumidorFinal = useMemo(() => invoice?.buyerInfo.rucOrCedula === "9999999999999", [invoice]);

  const FIXED_CORPORATE_ADDRESS = "REPUBLICA DEL SALVADOR N36-110 Y N36 SUECIA - BQ.3 10 06 EDF METRO PLAZA";

  const paymentLabels: Record<string, string> = {
    '01': '01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO',
    '16': '16 - TARJETA DE DÉBITO',
    '19': '19 - TARJETA DE CRÉDITO',
    '20': '20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO',
  };

  const getFormattedDate = (dateVal: any) => {
    if (!dateVal) return "";
    let d: Date;
    try {
      if (typeof dateVal === 'string') d = new Date(dateVal);
      else if (dateVal.seconds) d = new Date(dateVal.seconds * 1000);
      else d = new Date(dateVal);
      
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch (e) {
      return "";
    }
  };

  const getFormattedDateTime = (dateVal: any) => {
    if (!dateVal) return "";
    try {
      if (typeof dateVal === 'string') return new Date(dateVal).toLocaleString('es-ES');
      if (dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleString('es-ES');
      return new Date(dateVal).toLocaleString('es-ES');
    } catch (e) {
      return "";
    }
  };

  const accessKey = useMemo(() => {
    if (!invoice) return "";
    if (invoice.sriResponse?.claveAcceso) return invoice.sriResponse.claveAcceso;

    const parts = invoice.invoiceNumber.split('-');
    return generateAccessKey({
      rucEmisor: "1793221927001",
      razonSocialEmisor: "LOPEZ RUALES LUIS FELIPE",
      nombreComercialEmisor: "THEGAMEEC S.A.S",
      dirMatriz: FIXED_CORPORATE_ADDRESS,
      estab: "002",
      ptoEmi: "002",
      secuencial: parts[2] || "000000001",
      fechaEmision: getFormattedDate(invoice.createdAt),
      cliente: {
        razonSocial: invoice.buyerInfo.razonSocial,
        identificacion: invoice.buyerInfo.rucOrCedula,
        direccion: invoice.buyerInfo.direccion,
        email: invoice.buyerInfo.email
      },
      items: [],
      formaPago: invoice.paymentMethod
    });
  }, [invoice]);

  const handleDownloadPDF = () => {
    if (!invoice) return;
    generateBillingPDF({
      title: "Factura",
      docNumber: invoice.invoiceNumber,
      date: getFormattedDate(invoice.createdAt),
      time: getFormattedDateTime(invoice.createdAt),
      accessKey: accessKey,
      isAuthorized: invoice.status !== 'CANCELLED',
      client: {
        name: invoice.buyerInfo.razonSocial,
        ruc: invoice.buyerInfo.rucOrCedula,
        address: invoice.buyerInfo.direccion || "QUITO",
        email: invoice.buyerInfo.email,
        paymentMethod: invoice.paymentMethod,
        transferNumber: invoice.transferNumber
      },
      items: invoice.items,
      subtotal: invoice.subtotalAmount || 0,
      iva: invoice.taxAmount || 0,
      total: invoice.totalAmount || 0,
      branchAddress: FIXED_CORPORATE_ADDRESS
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="h-[40vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Generando RIDE...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-20 text-center space-y-4">
        <h1 className="text-xl font-black uppercase">Comprobante no hallado</h1>
        <p className="text-slate-400 text-sm">El registro solicitado no existe o fue eliminado.</p>
      </div>
    );
  }

  const subtotalFactura = invoice.totalAmount / 1.15;
  const ivaFactura = invoice.totalAmount - subtotalFactura;

  return (
    <div className="flex flex-col bg-white rounded-[2rem] overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-4 no-print">
        <div className="flex items-center gap-3">
          <Badge className="bg-black text-white font-black text-[9px] uppercase px-3 py-1">SRI RIDE OFICIAL</Badge>
          <span className="font-black text-slate-900 text-sm">{invoice.invoiceNumber}</span>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="flex-1 md:flex-none rounded-xl font-bold h-10 px-4 bg-white">
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 md:flex-none rounded-xl font-bold h-10 px-4 bg-white">
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8 bg-slate-100 print:bg-white print:p-0">
        <div className="max-w-[210mm] mx-auto font-sans text-slate-900 space-y-6 bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] shadow-xl print:shadow-none print:rounded-none print:p-0 print-document">
          <div className="grid grid-cols-1 md:grid-cols-[45%_55%] gap-6 items-start">
            <div className="flex flex-col gap-6">
              <div className="flex justify-center md:justify-start">
                <img src="/thegame.jpg" alt="Logo" className="w-32 md:w-40 h-auto object-contain" />
              </div>
              <div className="border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 space-y-3 bg-white shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-[10px] md:text-xs font-black leading-tight uppercase">LOPEZ RUALES LUIS FELIPE</h2>
                  <h3 className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">THEGAMEEC S.A.S</h3>
                </div>
                <div className="space-y-2 text-[8px] md:text-[9px] font-medium leading-tight">
                  <div className="flex gap-2"><span className="font-black text-slate-400 uppercase min-w-[70px] md:min-w-[100px]">Matriz:</span><span className="uppercase font-bold">{FIXED_CORPORATE_ADDRESS}</span></div>
                  <div className="flex gap-2"><span className="font-black text-slate-400 uppercase min-w-[70px] md:min-w-[100px]">Sucursal:</span><span className="uppercase font-bold">{FIXED_CORPORATE_ADDRESS}</span></div>
                  <div className="font-black uppercase pt-2 text-slate-900 border-t border-slate-50">OBLIGADO A CONTABILIDAD: NO</div>
                </div>
              </div>
            </div>

            <div className="border-2 border-slate-900 rounded-2xl md:rounded-[2.5rem] p-6 md:p-8 space-y-4 bg-white flex flex-col">
              <div className="space-y-1">
                <h2 className="text-xs md:text-sm font-black uppercase text-slate-400">R.U.C.: 1793221927001</h2>
                <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">FACTURA</h1>
                <h3 className="text-base md:text-lg font-black text-slate-600">No. {invoice.invoiceNumber}</h3>
              </div>
              <div className="space-y-3 text-[8px] md:text-[9px] font-medium border-t border-slate-50 pt-4">
                <div>
                  <span className="font-black block uppercase mb-1 text-slate-400">NÚMERO DE AUTORIZACIÓN:</span>
                  <div className="break-all font-mono text-[8px] md:text-[9px] leading-relaxed font-bold bg-slate-50 p-2 rounded-xl">{accessKey}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span className="font-black uppercase text-slate-400">FECHA AUTORIZACIÓN:</span><span className="font-black text-slate-900">{invoice.status !== 'CANCELLED' ? getFormattedDateTime(invoice.createdAt) : "ANULADA"}</span></div>
                  <div className="flex justify-between"><span className="font-black uppercase text-slate-400">AMBIENTE:</span><span className="font-bold">PRUEBAS</span></div>
                  <div className="flex justify-between"><span className="font-black uppercase text-slate-400">EMISIÓN:</span><span className="font-bold">NORMAL</span></div>
                </div>
              </div>
              <div className="mt-4 pt-4 flex flex-col items-center gap-2">
                {accessKey && (
                   <div className="scale-75 md:scale-100">
                     <Barcode value={accessKey} width={1} height={35} format="CODE128" background="#ffffff" displayValue={false} margin={0} />
                   </div>
                )}
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 md:p-6 text-[9px] md:text-[10px] bg-[#f8fafc] shadow-sm">
            <div className="space-y-2">
              <div className="flex flex-col md:flex-row md:gap-2"><span className="font-black text-slate-400 uppercase md:min-w-[150px]">Razón Social:</span><span className="font-black uppercase">{esConsumidorFinal ? "CONSUMIDOR FINAL" : invoice.buyerInfo.razonSocial}</span></div>
              <div className="flex flex-col md:flex-row md:gap-2"><span className="font-black text-slate-400 uppercase md:min-w-[150px]">Identificación:</span><span className="font-bold">{invoice.buyerInfo.rucOrCedula}</span></div>
              <div className="flex flex-col md:flex-row md:gap-2"><span className="font-black text-slate-400 uppercase md:min-w-[150px]">Fecha Emisión:</span><span className="font-bold">{getFormattedDate(invoice.createdAt)}</span></div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left text-[8px] md:text-[9px]">
              <thead className="bg-slate-900 text-white font-black uppercase">
                <tr><th className="p-3">Cant.</th><th className="p-3">Descripción</th><th className="p-3 text-right">Unitario</th><th className="p-3 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {invoice.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="p-3 text-center">{item.quantity.toFixed(1)}</td>
                    <td className="p-3 uppercase truncate max-w-[100px] md:max-w-none">{item.productName}</td>
                    <td className="p-3 text-right">${(item.unitPrice / 1.15).toFixed(2)}</td>
                    <td className="p-3 text-right">${(item.lineTotal / 1.15).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_250px] gap-6">
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <div className="bg-slate-50 p-2 text-center font-black text-[8px] md:text-[9px] uppercase border-b border-slate-100">Info Adicional</div>
              <div className="p-4 space-y-2 text-[8px] md:text-[9px]">
                <div className="flex justify-between"><span className="font-black text-slate-400 uppercase">Email:</span><span className="font-bold truncate max-w-[120px]">{esConsumidorFinal ? "N/A" : invoice.buyerInfo.email}</span></div>
                <div className="flex justify-between"><span className="font-black text-slate-400 uppercase">Pago:</span><span className="font-bold uppercase text-right truncate max-w-[120px]">{paymentLabels[invoice.paymentMethod] || invoice.paymentMethod}</span></div>
                {invoice.transferNumber && <div className="flex justify-between"><span className="font-black text-slate-400 uppercase">Comp. No:</span><span className="font-bold">{invoice.transferNumber}</span></div>}
              </div>
            </div>
            <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-[#f8fafc]">
              <table className="w-full text-[9px] md:text-[10px] font-black">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="p-2 md:p-3 uppercase text-slate-400">Subtotal</td><td className="p-2 md:p-3 text-right">{subtotalFactura.toFixed(2)}</td></tr>
                  <tr><td className="p-2 md:p-3 uppercase text-slate-400">I.V.A 15%</td><td className="p-2 md:p-3 text-right">{ivaFactura.toFixed(2)}</td></tr>
                  <tr className="bg-slate-900 text-white"><td className="p-3 md:p-4 uppercase text-sm">Total</td><td className="p-3 md:p-4 text-right text-lg">${invoice.totalAmount.toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
