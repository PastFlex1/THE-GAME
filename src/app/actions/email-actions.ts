
'use server';

import { Resend } from 'resend';

/**
 * Servidor de correos institucional THEGAMEEC S.A.S.
 * Utiliza Resend para el envío de comprobantes electrónicos con XML y PDF adjuntos.
 */

const resend = new Resend('re_KQyG4CqQ_NDZNgXeCMXU1Hysx8nzkyKTx');

interface EmailResponse {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Envía la factura electrónica al cliente incluyendo el XML SRI y el PDF RIDE.
 * @param to Correo del receptor
 * @param invoiceNumber Número de comprobante
 * @param customerName Nombre del cliente
 * @param total Monto total de la liquidación
 * @param xmlContent Contenido del XML generado en formato SRI (Texto plano)
 * @param pdfBase64 Contenido del PDF en formato base64
 */
export async function sendInvoiceEmail(
  to: string, 
  invoiceNumber: string, 
  customerName: string, 
  total: number,
  xmlContent?: string,
  pdfBase64?: string
): Promise<EmailResponse> {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Correo electrónico inválido.' };
  }

  try {
    const attachments = [];
    
    // Adjuntar XML Autorizado (asegurando codificación UTF-8)
    if (xmlContent && xmlContent.trim().length > 0) {
      attachments.push({
        filename: `${invoiceNumber}.xml`,
        content: Buffer.from(xmlContent, 'utf-8'),
      });
    }

    // Adjuntar PDF RIDE (decodificando el base64 a binario real)
    if (pdfBase64 && pdfBase64.trim().length > 0) {
      // Limpiar prefijo data:application/pdf;base64, si existe
      const cleanBase64 = pdfBase64.includes('base64,') 
        ? pdfBase64.split('base64,')[1] 
        : pdfBase64;

      attachments.push({
        filename: `${invoiceNumber}.pdf`,
        content: Buffer.from(cleanBase64, 'base64'),
      });
    }

    const { data, error } = await resend.emails.send({
      from: 'THEGAMEEC S.A.S <comprobantes@thegame.ink>',
      to: [to],
      subject: `Comprobante Electrónico: ${invoiceNumber} - THEGAMEEC S.A.S`,
      attachments,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f1f5f9; border-radius: 32px; background-color: #ffffff; color: #0f172a;">
          <div style="text-align: center; margin-bottom: 48px;">
            <div style="display: inline-block; padding: 12px; background-color: #000000; border-radius: 16px; margin-bottom: 16px;">
               <h1 style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; margin: 0; text-transform: uppercase;">THEGAME</h1>
            </div>
            <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; color: #94a3b8; margin: 0;">Graphic Production</p>
          </div>
          
          <div style="margin-bottom: 40px;">
            <h2 style="font-size: 24px; font-weight: 900; color: #000000; margin-bottom: 20px; letter-spacing: -1px;">¡Gracias por su confianza!</h2>
            <p style="font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 16px;">
              Estimado(a) <strong style="color: #000000;">${customerName}</strong>,
            </p>
            <p style="font-size: 15px; color: #475569; line-height: 1.7;">
              Es un placer saludarle. Le informamos que su comprobante electrónico ha sido generado exitosamente tras su reciente adquisición en <strong>THEGAMEEC S.A.S</strong>.
            </p>
            <p style="font-size: 15px; color: #475569; line-height: 1.7;">
              Adjunto a este mensaje encontrará los archivos oficiales (XML y PDF) que acreditan legalmente su transacción ante el Servicio de Rentas Internas (SRI).
            </p>
          </div>

          <div style="background-color: #f8fafc; padding: 32px; border-radius: 24px; margin-bottom: 40px; border: 1px solid #f1f5f9;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Comprobante No:</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 800; color: #000000;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Fecha de Emisión:</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 800; color: #000000;">${new Date().toLocaleDateString('es-ES')}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 20px; border-top: 1px solid #e2e8f0;"></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #000000; font-weight: 900; font-size: 16px;">VALOR TOTAL:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 900; font-size: 22px; color: #000000; letter-spacing: -1px;">$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 32px;">
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
              Este es un documento con plena validez tributaria. Le sugerimos archivar los documentos adjuntos para sus registros contables personales.
            </p>
            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
              © ${new Date().getFullYear()} THEGAMEEC S.A.S
            </div>
            <p style="font-size: 9px; color: #cbd5e1; margin-top: 8px; text-transform: uppercase; font-weight: 700;">
              SISTEMA DE GESTIÓN INTEGRAL THEGAME FLOW
            </p>
            <div style="margin-top: 24px; padding: 16px; border-radius: 16px; background-color: #f8fafc; border: 1px solid #f1f5f9;">
              <p style="font-size: 10px; color: #64748b; margin: 0; line-height: 1.5;">
                <strong style="color: #0f172a;">Soporte y Desarrollo Tecnológico:</strong><br />
                Esta plataforma ha sido desarrollada por <strong style="color: #0f172a;">Palma Nexus Solutions</strong>.<br />
                Para asistencia técnica, contacte al <strong style="color: #0f172a;">099 821 2307</strong>.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error enviando email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Excepción en envío de email:', err);
    return { success: false, error: 'No se pudo conectar con el servidor de correos.' };
  }
}
