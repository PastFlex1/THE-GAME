'use client';

/**
 * Utilidad de validación para documentos de identidad de Ecuador (Cédula y RUC).
 * Implementa el algoritmo de Módulo 10 y verificaciones de estructura del SRI.
 */

export function validateEcuadorianId(id: string): { isValid: boolean; type: 'CEDULA' | 'RUC' | 'CONSUMIDOR_FINAL' | 'INVALIDO' } {
  const cleanId = id.trim();

  // 1. Caso Consumidor Final
  if (cleanId === '9999999999999') {
    return { isValid: true, type: 'CONSUMIDOR_FINAL' };
  }

  // 2. Validación de Cédula (10 dígitos)
  if (cleanId.length === 10) {
    return { isValid: isValidCedula(cleanId), type: isValidCedula(cleanId) ? 'CEDULA' : 'INVALIDO' };
  }

  // 3. Validación de RUC (13 dígitos)
  if (cleanId.length === 13) {
    const isRuc = isValidRuc(cleanId);
    return { isValid: isRuc, type: isRuc ? 'RUC' : 'INVALIDO' };
  }

  return { isValid: false, type: 'INVALIDO' };
}

function isValidCedula(cedula: string): boolean {
  if (cedula.length !== 10 || !/^\d+$/.test(cedula)) return false;

  const province = parseInt(cedula.substring(0, 2), 10);
  if (province < 1 || (province > 24 && province !== 30)) return false;

  const digits = cedula.split('').map(Number);
  const lastDigit = digits.pop();
  
  const sum = digits.reduce((acc, digit, i) => {
    let val = (i % 2 === 0) ? digit * 2 : digit;
    if (val > 9) val -= 9;
    return acc + val;
  }, 0);

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === lastDigit;
}

function isValidRuc(ruc: string): boolean {
  if (ruc.length !== 13 || !/^\d+$/.test(ruc)) return false;
  if (!ruc.endsWith('001')) return false;

  const thirdDigit = parseInt(ruc[2], 10);

  // RUC Persona Natural (Basado en cédula)
  if (thirdDigit < 6) {
    return isValidCedula(ruc.substring(0, 10));
  }

  // RUC Sociedades Privadas / Extranjeros (Dígito 9)
  if (thirdDigit === 9) {
    const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const digits = ruc.substring(0, 9).split('').map(Number);
    const lastDigit = parseInt(ruc[9], 10);
    const sum = digits.reduce((acc, d, i) => acc + (d * coefficients[i]), 0);
    const checkDigit = (11 - (sum % 11)) % 11;
    return (checkDigit === 11 ? 0 : checkDigit) === lastDigit;
  }

  // RUC Instituciones Públicas (Dígito 6)
  if (thirdDigit === 6) {
    const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
    const digits = ruc.substring(0, 8).split('').map(Number);
    const lastDigit = parseInt(ruc[8], 10);
    const sum = digits.reduce((acc, d, i) => acc + (d * coefficients[i]), 0);
    const checkDigit = (11 - (sum % 11)) % 11;
    return (checkDigit === 11 ? 0 : checkDigit) === lastDigit;
  }

  return false;
}
