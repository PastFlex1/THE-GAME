
'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface BranchReportData {
  companyName: string;
  branchName: string;
  branchCode: string;
  date: string;
  responsible: string;
  summary: {
    totalSales: number;
    transactionCount: number;
  };
  paymentMethods: {
    cash: number;
    card: number;
    transfer: number;
    others: number;
  };
  voids: {
    count: number;
    total: number;
  };
  productStats: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  cashReconciliation?: {
    initialFund: number;
    cashSales: number;
    additionalIncome: number;
    expenses: number;
    expectedTotal: number;
    countedTotal: number;
    difference: number;
  };
  transactions?: any[];
}

interface AnalyticsReportData {
  companyName: string;
  period: string;
  branchName: string;
  summary: {
    totalSales: number;
    transactionCount: number;
    avgTicket: number;
  };
  paymentMethods: Record<string, number>;
  reconciliation: {
    expected: number;
    counted: number;
    difference: number;
  };
  byBranch: Array<{
    name: string;
    sales: number;
    count: number;
    qty: number;
  }>;
  byType: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  byProduct: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  transactions: any[];
  closures: any[];
}

export function generateBranchDailyReportPDF(data: BranchReportData) {
  if (typeof window === 'undefined') return;
  const doc = new jsPDF() as any;
  try { doc.addImage('/thegame.jpg', 'JPEG', 10, 10, 25, 25); } catch (e) {}
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, 40, 18);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ACTA DE AUDITORÍA Y CIERRE DE TURNO', 40, 23);
  doc.line(10, 38, 200, 38);

  doc.autoTable({
    startY: 42,
    body: [['SUCURSAL:', data.branchName.toUpperCase()], ['FECHA CIERRE:', data.date], ['RESPONSABLE:', data.responsible.toUpperCase()]],
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 0.5 }
  });

  let curY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN FINANCIERO:', 10, curY);
  doc.autoTable({
    startY: curY + 2,
    body: [['TOTAL BRUTO FACTURADO:', `$${data.summary.totalSales.toFixed(2)}`], ['EFECTIVO:', `$${data.paymentMethods.cash.toFixed(2)}`], ['TARJETAS:', `$${data.paymentMethods.card.toFixed(2)}`], ['TRANSFERENCIAS:', `$${data.paymentMethods.transfer.toFixed(2)}`]],
    theme: 'grid',
    styles: { fontSize: 7.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });

  if (data.cashReconciliation) {
    curY = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'bold');
    doc.text('CUADRE DE CAJA:', 10, curY);
    doc.autoTable({
      startY: curY + 2,
      body: [['VENTA ESPERADA:', `$${data.cashReconciliation.expectedTotal.toFixed(2)}`], ['CONTEO REAL:', `$${data.cashReconciliation.countedTotal.toFixed(2)}`], ['DIFERENCIA:', `$${data.cashReconciliation.difference.toFixed(2)}`]],
      theme: 'grid',
      styles: { fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });
  }

  curY = (doc as any).lastAutoTable.finalY + 20;
  doc.line(20, curY, 80, curY); doc.line(120, curY, 180, curY);
  doc.setFontSize(6);
  doc.text('FIRMA RESPONSABLE', 50, curY + 3, { align: 'center' });
  doc.text('FIRMA AUDITORÍA', 150, curY + 3, { align: 'center' });
  doc.save(`Arqueo_${data.branchName}_${data.date.replace(/\//g, '-')}.pdf`);
}

export function generateConsolidatedAnalyticsPDF(data: AnalyticsReportData) {
  if (typeof window === 'undefined') return;
  const doc = new jsPDF() as any;
  try { doc.addImage('/thegame.jpg', 'JPEG', 10, 10, 20, 20); } catch (e) {}
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, 35, 16);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('INFORME INTEGRAL DE GESTIÓN NACIONAL', 35, 20);
  doc.line(10, 32, 200, 32);

  doc.autoTable({
    startY: 35,
    body: [['ÁMBITO:', data.branchName.toUpperCase()], ['PERIODO:', data.period], ['FECHA EMISIÓN:', new Date().toLocaleString()]],
    theme: 'plain',
    styles: { fontSize: 6.5, cellPadding: 0.3 }
  });

  let curY = (doc as any).lastAutoTable.finalY + 3;
  doc.setFont('helvetica', 'bold');
  doc.text('RECAUDACIÓN FACTURADA:', 10, curY);
  doc.autoTable({
    startY: curY + 1,
    head: [['CONCEPTO', 'VALOR']],
    body: [['TOTAL FACTURADO:', `$${data.summary.totalSales.toFixed(2)}`], ['EFECTIVO (01):', `$${(data.paymentMethods['01'] || 0).toFixed(2)}`], ['TARJETAS (16/19):', `$${(data.paymentMethods['CARDS'] || 0).toFixed(2)}`], ['TRANSFERENCIAS (20):', `$${(data.paymentMethods['20'] || 0).toFixed(2)}`]],
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.6 },
    headStyles: { fillColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });



  curY = (doc as any).lastAutoTable.finalY + 3;
  doc.text('DESPLAZAMIENTO POR PRODUCTO:', 10, curY);
  doc.autoTable({
    startY: curY + 1,
    head: [['PRODUCTO', 'UDS.', 'RECAUDACIÓN']],
    body: data.byProduct.map(p => [p.name.toUpperCase(), p.quantity, `$${p.revenue.toFixed(2)}`]),
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 0.5 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 1: { halign: 'left' }, 2: { halign: 'right' } }
  });

  curY = (doc as any).lastAutoTable.finalY + 3;
  if (curY > 270) { doc.addPage(); curY = 15; }
  doc.text('LIBRO DE VENTAS (HISTORIAL):', 10, curY);
  doc.autoTable({
    startY: curY + 1,
    head: [['FACTURA', 'FECHA', 'CLIENTE', 'TOTAL', 'ESTADO']],
    body: data.transactions.map(t => [t.invoiceNumber, new Date(t.createdAt).toLocaleDateString(), (t.buyerInfo?.razonSocial || 'C. FINAL').substring(0, 30), `$${t.totalAmount.toFixed(2)}`, t.status === 'CANCELLED' ? 'ANULADA' : 'ACTIVA']),
    theme: 'striped',
    styles: { fontSize: 6, cellPadding: 0.5 },
    headStyles: { fillColor: [60, 60, 60] },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
  });

  curY = (doc as any).lastAutoTable.finalY + 3;
  if (curY > 270) { doc.addPage(); curY = 15; }
  doc.text('HISTORIAL DE ARQUEOS:', 10, curY);
  doc.autoTable({
    startY: curY + 1,
    head: [['FECHA', 'SUCURSAL', 'RESPONSABLE', 'DIFF']],
    body: data.closures.map(c => [new Date(c.createdAt).toLocaleDateString(), c.branchName.substring(0, 20), c.cashierName.substring(0, 20), `$${c.difference.toFixed(2)}`]),
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 0.5 },
    headStyles: { fillColor: [100, 100, 100] },
    columnStyles: { 3: { halign: 'right' } }
  });

  doc.save(`Reporte_Consolidado_${data.period.replace(/\//g, '-')}.pdf`);
}

export function generateClosuresReportPDF(data: { date: string; branchName: string; closures: any[]; }) {
  if (typeof window === 'undefined') return;
  const doc = new jsPDF() as any;
  try { doc.addImage('/thegame.jpg', 'JPEG', 10, 10, 20, 20); } catch (e) {}
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CONSOLIDADO DE ARQUEOS', 35, 16);
  doc.setFontSize(7);
  doc.text(`SEDE: ${data.branchName.toUpperCase()} | PERIODO: ${data.date}`, 35, 20);
  doc.line(10, 32, 200, 32);

  doc.autoTable({
    startY: 35,
    head: [['FECHA', 'SUCURSAL', 'RESPONSABLE', 'VENTA', 'DIFF']],
    body: data.closures.map(c => [new Date(c.createdAt).toLocaleDateString(), c.branchName.substring(0, 20), c.cashierName.substring(0, 20), `$${c.totalSales.toFixed(2)}`, `$${c.difference.toFixed(2)}`]),
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [0, 0, 0] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }
  });
  doc.save(`Arqueos_Consolidado_${data.date.replace(/\//g, '-')}.pdf`);
}
