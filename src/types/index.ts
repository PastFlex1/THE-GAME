
export type UserRole = 'OWNER' | 'ADMIN' | 'CASHIER' | 'ACCOUNTANT';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
  ptoEmi?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  cost: number;
  defaultPrice: number;
  inventoryLevel: number;
  branchId: string;
  isService?: boolean;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  discount?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  buyerInfo: {
    rucOrCedula: string;
    razonSocial: string;
    direccion: string;
    email: string;
    telefono: string;
  };
  branchId: string;
  cashierId: string;
  createdAt: string;
  items: InvoiceItem[];
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalCost: number;
  profit: number;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
  paymentMethod: string;
}

export interface InventoryTransfer {
  id: string;
  sourceBranchId: string;
  targetBranchId: string;
  productId: string;
  productName: string;
  quantity: number;
  createdAt: string;
  status: 'COMPLETED' | 'PENDING';
}

export interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: UserRole;
  associatedBranchIds: string[];
}
