'use server';

/**
 * Servicio de integración granular con el middleware SRI de THEGAME.
 * 
 * Este servicio maneja EXCLUSIVAMENTE el intercambio de archivos XML. 
 * El RIDE (PDF) NO se envía al SRI, ya que el sistema nacional solo procesa datos estructurados.
 */

const BASE_URL = "https://sri-the-game-production.up.railway.app";

/**
 * 1. Firma el XML usando el certificado digital alojado en el servidor.
 */
export async function firmarXML(xml: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/sri/firmar`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: xml
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Falla en firma: ${res.statusText}`);
    }
    return { success: true, xmlFirmado: await res.text() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 2. Envía el XML firmado a los servidores de recepción del SRI.
 */
export async function validarRecepcion(xmlFirmado: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/sri/recepcion`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: xmlFirmado
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Falla en recepción: ${res.statusText}`);
    }
    return { success: true, data: await res.text() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 3. Consulta el estado de autorización final en el SRI.
 */
export async function consultarAutorizacion(claveAcceso: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/sri/autorizacion/${claveAcceso}`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `Falla en autorización: ${res.statusText}`);
    }
    return { success: true, data: await res.text() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * CICLO COMPLETO DE FACTURA (Firma -> Recepción -> Autorización)
 */
export async function emitirFactura(xml: string) {
  try {
    // 1. 🔐 Firmar
    const resFirma = await fetch(`${BASE_URL}/api/sri/firmar`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: xml
    });
    if (!resFirma.ok) throw new Error(await resFirma.text());
    const xmlFirmado = await resFirma.text();

    // 2. 📡 Recepción
    const resRecepcion = await fetch(`${BASE_URL}/api/sri/recepcion`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: xmlFirmado
    });
    if (!resRecepcion.ok) throw new Error(await resRecepcion.text());
    const recepcion = await resRecepcion.text();

    // Extraer Clave Acceso para consulta
    const claveAccesoMatch = xml.match(/<claveAcceso>(.*?)<\/claveAcceso>/);
    if (!claveAccesoMatch) throw new Error("No se encontró la clave de acceso.");
    const claveAcceso = claveAccesoMatch[1];

    // 3. 🔍 Autorización (Intento inmediato)
    const resAutorizacion = await fetch(`${BASE_URL}/api/sri/autorizacion/${claveAcceso}`);
    if (!resAutorizacion.ok) throw new Error(await resAutorizacion.text());
    const autorizacion = await resAutorizacion.text();

    return {
      success: true,
      xmlFirmado,
      recepcion,
      autorizacion,
      claveAcceso
    };
  } catch (error: any) {
    console.error("Error en ciclo completo Factura:", error);
    return { success: false, error: error.message || "Falla en proceso SRI de Factura" };
  }
}

/**
 * Proceso integral de emisión de Nota de Crédito.
 */
export async function emitirNotaCredito(xml: string) {
  try {
    const resFirma = await fetch(`${BASE_URL}/api/sri/firmar`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: xml
    });
    if (!resFirma.ok) throw new Error(await resFirma.text());
    const xmlFirmado = await resFirma.text();

    const resRecepcion = await fetch(`${BASE_URL}/api/sri/recepcion`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: xmlFirmado
    });
    if (!resRecepcion.ok) throw new Error(await resRecepcion.text());
    const recepcion = await resRecepcion.text();

    const claveAccesoMatch = xml.match(/<claveAcceso>(.*?)<\/claveAcceso>/);
    if (!claveAccesoMatch) throw new Error("No se encontró la clave de acceso.");
    const claveAcceso = claveAccesoMatch[1];

    const resAutorizacion = await fetch(`${BASE_URL}/api/sri/autorizacion/${claveAcceso}`);
    if (!resAutorizacion.ok) throw new Error(await resAutorizacion.text());
    const autorizacion = await resAutorizacion.text();

    return {
      success: true,
      xmlFirmado,
      recepcion,
      autorizacion,
      claveAcceso
    };
  } catch (error: any) {
    console.error("Error NC:", error);
    return { success: false, error: error.message || "Falla en proceso SRI de NC" };
  }
}
