'use client';

/**
 * Simplificación del sistema de errores para modo sin autenticación.
 * Se elimina la simulación de 'request.auth' para evitar ruidos en el reporte.
 */

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly path: string;
  public readonly operation: string;

  constructor(context: SecurityRuleContext) {
    const message = `Error de base de datos en ${context.path} durante operación ${context.operation}.`;
    super(message);
    this.name = 'FirebaseError';
    this.path = context.path;
    this.operation = context.operation;
  }
}
