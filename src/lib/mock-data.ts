
import { Branch, Customer, Product, Invoice, AppUser } from "@/types";

export const MOCK_BRANCHES: Branch[] = [
  { id: 'b1', name: 'República del Salvador (Principal)', address: 'República del Salvador', phone: '02-2894-123', active: true, ptoEmi: '001' },
  { id: 'b2', name: 'Sucursal (Iñaquito)', address: 'Amazonas y Villalengua', phone: '02-2456-789', active: true, ptoEmi: '002' },
  { id: 'b3', name: 'Planta Industrial', address: 'Panamericana Sur km 20', phone: '02-3987-456', active: false, ptoEmi: '003' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Publicidad Total S.A.', email: 'billing@publitotal.com', phone: '099-111-222', taxId: '1790011223001', branchId: 'b1' },
  { id: 'c2', name: 'Diseños Modernos', email: 'finanzas@dmodernos.com', phone: '098-333-444', taxId: '1792233445001', branchId: 'b1' },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Impresión Gran Formato (Lona)', price: 15.00, taxRate: 0.15, stock: 500, branchId: 'b1' },
  { id: 'p2', name: 'Vinil Adhesivo Mate/Brillante', price: 12.00, taxRate: 0.15, stock: 200, branchId: 'b1' },
  { id: 'p3', name: 'Troquelado Digital (m2)', price: 8.50, taxRate: 0.15, stock: 1000, branchId: 'b1' },
  { id: 'p4', name: 'Diseño Gráfico Corporativo', price: 45.00, taxRate: 0.15, stock: 999, branchId: 'b1' },
];

export const MOCK_USERS: AppUser[] = [
  { id: 'u1', firstName: 'LUIS FELIPE', lastName: 'LOPEZ RUALES', email: 'luis.lopez@thegame.com', roleId: 'OWNER', associatedBranchIds: ['b1'] },
  { id: 'u2', firstName: 'Ana', lastName: 'Martinez', email: 'ana@thegame.com', roleId: 'ADMIN', associatedBranchIds: ['b1'] },
  { id: 'u3', firstName: 'David', lastName: 'Smith', email: 'david@thegame.com', roleId: 'CASHIER', associatedBranchIds: ['b1'] },
  { id: 'u4', firstName: 'Elena', lastName: 'Gomez', email: 'elena@thegame.com', roleId: 'ACCOUNTANT', associatedBranchIds: ['b2'] },
  { id: 'u5', firstName: 'Carlos', lastName: 'Ortega', email: 'carlos@thegame.com', roleId: 'CASHIER', associatedBranchIds: ['b2'] },
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'i1',
    invoiceNumber: '002-001-000000001',
    buyerInfo: {
      rucOrCedula: '1790011223001',
      razonSocial: 'Publicidad Total S.A.',
      direccion: 'Quito',
      email: 'billing@publitotal.com',
      telefono: '099111222'
    },
    branchId: 'b1',
    cashierId: 'u1',
    createdAt: '2024-03-01T10:00:00Z',
    items: [
      { productId: 'p1', productName: 'Impresión Gran Formato (Lona)', quantity: 10, unitPrice: 15, lineTotal: 150 },
    ],
    subtotalAmount: 150,
    taxAmount: 22.5,
    totalAmount: 172.5,
    status: 'PAID',
    paymentMethod: '01'
  },
];
