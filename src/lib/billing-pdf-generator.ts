
'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import JsBarcode from 'jsbarcode';

interface PDFData {
  title: string;
  client: {
    name: string;
    ruc: string;
    address: string;
    email: string;
    phone?: string;
    paymentMethod?: string;
    transferNumber?: string;
  };
  items: any[];
  subtotal: number;
  iva: number;
  total: number;
  date: string;
  time?: string;
  docNumber?: string;
  accessKey?: string; 
  status?: string;
  branchAddress?: string;
  isAuthorized?: boolean;
}

const PAYMENT_MAP: Record<string, string> = {
  "01": "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO",
  "16": "16 - TARJETA DE DÉBITO",
  "19": "19 - TARJETA DE CRÉDITO",
  "20": "20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
};

const FIXED_CORPORATE_ADDRESS = "REPUBLICA DEL SALVADOR N36-110 Y N36 SUECIA - BQ.3 10 06 EDF METRO PLAZA";

const EMITTER_INFO = {
  name: "LOPEZ RUALES LUIS FELIPE",
  businessName: "THEGAMEEC S.A.S",
  ruc: "1793221927001",
  address: FIXED_CORPORATE_ADDRESS,
};

function createPDFDoc(data: PDFData) {
  const doc = new jsPDF() as any;
  const isFactura = data.title === "Factura";
  const displayNum = data.docNumber || "002-002-000000001";

  if (isFactura) {
    const authNumber = data.accessKey || "0000000000000000000000000000000000000000000000000";
    const esConsumidorFinal = data.client.ruc === "9999999999999";
    
    try {
      doc.addImage('/thegame.jpg', 'JPEG', 10, 5, 45, 45);
    } catch (e) {}

    doc.setDrawColor(0);
    doc.setLineWidth(0.3); 
    doc.setTextColor(0);
    doc.roundedRect(10, 52, 90, 52, 3, 3, 'S');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(EMITTER_INFO.name, 15, 60);
    doc.setFontSize(11);
    doc.text(EMITTER_INFO.businessName, 15, 66);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Dirección Matriz:', 15, 72);
    doc.text(FIXED_CORPORATE_ADDRESS, 15, 76, { maxWidth: 80 });
    
    doc.text('Dirección Sucursal:', 15, 82);
    doc.text(FIXED_CORPORATE_ADDRESS, 15, 86, { maxWidth: 80 });

    doc.setFont('helvetica', 'bold');
    doc.text('OBLIGADO A LLEVAR CONTABILIDAD: NO', 15, 101);

    doc.setLineWidth(0.3);
    doc.roundedRect(105, 10, 95, 94, 3, 3, 'S');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`R.U.C.: ${EMITTER_INFO.ruc}`, 110, 20);
    
    doc.setFontSize(14);
    doc.text('FACTURA', 110, 30);
    
    doc.setFontSize(11);
    doc.text(`No. ${displayNum}`, 110, 40);
    
    doc.setFontSize(8);
    doc.text('NÚMERO DE AUTORIZACIÓN:', 110, 50);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(authNumber, 110, 55); 
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA Y HORA DE', 110, 65);
    doc.text('AUTORIZACIÓN:', 110, 69);
    doc.setFont('helvetica', 'normal');
    
    const authValue = data.isAuthorized 
      ? (data.time || new Date().toLocaleString('es-ES')) 
      : "PENDIENTE AL SRI";
    doc.text(authValue, 150, 69);
    
    doc.setFont('helvetica', 'bold');
    doc.text('AMBIENTE:', 110, 76);
    doc.setFont('helvetica', 'normal');
    doc.text('PRUEBAS', 150, 76); 
    
    doc.setFont('helvetica', 'bold');
    doc.text('EMISIÓN:', 110, 83);
    doc.setFont('helvetica', 'normal');
    doc.text('NORMAL', 150, 83);

    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, authNumber, {
          format: "CODE128",
          displayValue: false,
          height: 40,
          width: 1,
          margin: 0
        });
        const barcodeData = canvas.toDataURL("image/png");
        doc.addImage(barcodeData, 'PNG', 110, 86, 85, 8);
        doc.setFontSize(6);
        doc.text(authNumber, 152.5, 97, { align: 'center' });
      } catch (e) {
        console.error("Error generating barcode for PDF:", e);
      }
    }

    doc.setLineWidth(0.3);
    doc.roundedRect(10, 108, 190, 30, 1, 1, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Razón Social / Nombres y Apellidos:`, 12, 114);
    doc.setFont('helvetica', 'bold');
    doc.text(esConsumidorFinal ? "CONSUMIDOR FINAL" : data.client.name.toUpperCase(), 65, 114);
    doc.setFont('helvetica', 'normal');
    doc.text(`Placa / Matrícula:`, 130, 114);
    
    doc.text(`Identificación:`, 12, 120);
    doc.setFont('helvetica', 'bold');
    doc.text(data.client.ruc, 65, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(`Guía:`, 130, 120);
    
    doc.text(`Fecha:`, 12, 126);
    doc.setFont('helvetica', 'bold');
    doc.text(data.date, 65, 126);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Dirección:`, 12, 132);
    const displayAddress = esConsumidorFinal 
      ? "CONSUMIDOR FINAL" 
      : (data.client.address || 'QUITO');
    doc.text(displayAddress.toUpperCase(), 65, 132, { maxWidth: 130 });

    const tableRows = data.items.map((item) => {
      const pUnitSinIva = item.unitPrice / 1.15;
      const descSinIva = (item.discountAmount || 0) / 1.15;
      const totalSinIva = (item.quantity * pUnitSinIva) - descSinIva;
      
      return [
        '0101', '0101',
        item.quantity.toFixed(2),
        (item.productName || item.description).toUpperCase(),
        '', 
        `$${pUnitSinIva.toFixed(2)}`,
        '0.00', '0.00', 
        `$${descSinIva.toFixed(2)}`,
        `$${totalSinIva.toFixed(2)}`
      ];
    });

    doc.autoTable({
      startY: 142,
      margin: { left: 10, right: 10 },
      head: [['Cod. Principal', 'Cod. Auxiliar', 'Cantidad', 'Descripción', 'Detalle Adicional', 'Precio Unitario', 'Subsidio', 'Precio sin Subsidio', 'Descuento', 'Precio Total']],
      body: tableRows,
      theme: 'grid',
      styles: { 
        fontSize: 7, 
        cellPadding: 2, 
        lineWidth: 0.3, 
        lineColor: [0, 0, 0],
        valign: 'middle',
        textColor: [0, 0, 0]
      },
      headStyles: { 
        fillColor: [255, 255, 255], 
        textColor: [0, 0, 0], 
        lineWidth: 0.3, 
        fontStyle: 'bold',
        halign: 'center'
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;
    
    doc.setLineWidth(0.3);
    doc.rect(10, finalY, 110, 6, 'S'); 
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Información Adicional', 65, finalY + 4.5, { align: 'center' });
    
    doc.rect(10, finalY + 6, 110, 12, 'S'); 
    doc.text('email:', 12, finalY + 11.5);
    if (!esConsumidorFinal) {
      doc.text(data.client.email || '', 65, finalY + 11.5, { align: 'center' });
    }
    
    if (data.client.transferNumber) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`Comp. No: ${data.client.transferNumber}`, 12, finalY + 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
    }
    
    const tablePaymentY = finalY + 22;
    doc.setFont('helvetica', 'bold');
    doc.rect(10, tablePaymentY, 80, 6, 'S');
    doc.text('Forma de pago', 50, tablePaymentY + 4.5, { align: 'center' });
    doc.rect(90, tablePaymentY, 30, 6, 'S');
    doc.text('Valor', 105, tablePaymentY + 4.5, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.rect(10, tablePaymentY + 6, 80, 8, 'S');
    const methodDesc = PAYMENT_MAP[data.client.paymentMethod || "01"] || "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO";
    doc.text(methodDesc, 12, tablePaymentY + 11.5, { maxWidth: 76 });

    doc.rect(90, tablePaymentY + 6, 30, 8, 'S');
    doc.text(data.total.toFixed(2), 118, tablePaymentY + 11.5, { align: 'right' });

    const totalX = 125;
    const valueX = 195;
    let currentY = finalY;

    const drawTotalRow = (label: string, value: string, isBold = false) => {
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.rect(totalX, currentY, 75, 5, 'S');
      doc.text(label, totalX + 2, currentY + 3.5);
      doc.text(value, valueX - 2, currentY + 3.5, { align: 'right' });
      currentY += 5;
    };

    const subtotalFinal = data.total / 1.15;
    const ivaFinal = data.total - subtotalFinal;
    const descuentoTotal = data.items.reduce((acc, item) => acc + (item.discountAmount || 0), 0) / 1.15;

    drawTotalRow('SUBTOTAL 15%', `${subtotalFinal.toFixed(2)}`);
    drawTotalRow('SUBTOTAL NO OBJETO DE IVA', '0.00');
    drawTotalRow('SUBTOTAL EXENTO DE IVA', '0.00');
    drawTotalRow('SUBTOTAL SIN IMPUESTOS', `${subtotalFinal.toFixed(2)}`);
    drawTotalRow('TOTAL DESCUENTO', `${descuentoTotal.toFixed(2)}`);
    drawTotalRow('ICE', '0.00');
    drawTotalRow('IRBPNR', '0.00');
    drawTotalRow('IVA 15%', `${ivaFinal.toFixed(2)}`);
    drawTotalRow('PROPINA', '0.00');
    drawTotalRow('VALOR TOTAL', `${data.total.toFixed(2)}`, true);

    currentY += 2;
    doc.rect(totalX, currentY, 75, 10, 'S');
    doc.text('VALOR TOTAL SIN SUBSIDIO', totalX + 2, currentY + 4);
    doc.text('0.00', valueX - 2, currentY + 4, { align: 'right' });
    doc.text('AHORRO POR SUBSIDIO:', totalX + 2, currentY + 8);
    doc.text('0.00', valueX - 2, currentY + 8, { align: 'right' });
  }

  return doc;
}

export function generateBillingPDF(data: PDFData) {
  if (typeof window === 'undefined') return;
  const doc = createPDFDoc(data);
  doc.save(`Factura_${data.docNumber || 'DOC'}.pdf`);
}

export function getBillingPDFBase64(data: PDFData): string {
  if (typeof window === 'undefined') return '';
  const doc = createPDFDoc(data);
  return doc.output('datauristring').split(',')[1];
}
