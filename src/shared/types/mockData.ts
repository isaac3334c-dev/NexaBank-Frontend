import type { Account, Contact, Transaction } from './domain';

export const mockAccount: Account = {
  id: 'acc-001',
  ownerName: 'Daniela Flores',
  balance: { amount: '4280.50', currency: 'PEN' },
};

export const mockContacts: Contact[] = [
  { id: 'c1', name: 'Rodrigo Salazar', identifier: '+51 987 654 321', frequent: true },
  { id: 'c2', name: 'Camila Vargas', identifier: '+51 912 345 678', frequent: true },
  { id: 'c3', name: 'Luis Fernando Chávez', identifier: '+51 965 112 334', frequent: true },
  { id: 'c4', name: 'María José Rentería', identifier: '+51 998 221 456', frequent: true },
  { id: 'c5', name: 'Jorge Huamán', identifier: '+51 944 778 902', frequent: false },
  { id: 'c6', name: 'Valentina Torres', identifier: '+51 921 334 556', frequent: false },
  { id: 'c7', name: 'Sebastián Quiroga', identifier: '+51 933 221 887', frequent: false },
];

export const mockTransactions: Transaction[] = [
  {
    id: 't1',
    type: 'TRANSFER_IN',
    status: 'COMPLETED',
    amount: { amount: '350.00', currency: 'PEN' },
    counterparty: { name: 'Rodrigo Salazar', identifier: '+51 987 654 321' },
    description: 'Pago compartido almuerzo',
    createdAt: '2026-10-20T14:32:00-05:00',
  },
  {
    id: 't2',
    type: 'CARD_PAYMENT',
    status: 'COMPLETED',
    amount: { amount: '89.90', currency: 'PEN' },
    counterparty: { name: 'Plaza Vea San Borja', identifier: 'COM-44221' },
    description: 'Compra en supermercado',
    createdAt: '2026-10-19T19:05:00-05:00',
  },
  {
    id: 't3',
    type: 'TRANSFER_OUT',
    status: 'COMPLETED',
    amount: { amount: '120.00', currency: 'PEN' },
    counterparty: { name: 'Camila Vargas', identifier: '+51 912 345 678' },
    description: 'Parte del alquiler',
    createdAt: '2026-10-18T09:14:00-05:00',
  },
  {
    id: 't4',
    type: 'TOPUP',
    status: 'COMPLETED',
    amount: { amount: '500.00', currency: 'PEN' },
    description: 'Recarga desde BCP ****4521',
    createdAt: '2026-10-16T11:48:00-05:00',
  },
  {
    id: 't5',
    type: 'QR_PAYMENT',
    status: 'PENDING',
    amount: { amount: '45.50', currency: 'PEN' },
    counterparty: { name: 'Café Altura', identifier: 'COM-90112' },
    description: 'Pago con QR',
    createdAt: '2026-10-15T08:21:00-05:00',
  },
  {
    id: 't6',
    type: 'WITHDRAWAL',
    status: 'COMPLETED',
    amount: { amount: '200.00', currency: 'PEN' },
    description: 'Retiro en agente',
    createdAt: '2026-10-12T16:40:00-05:00',
  },
  {
    id: 't7',
    type: 'FEE',
    status: 'COMPLETED',
    amount: { amount: '3.50', currency: 'PEN' },
    description: 'Comisión por transferencia interbancaria',
    createdAt: '2026-10-11T10:02:00-05:00',
  },
];

export const TRANSFER_FEE: Transaction['amount'] = { amount: '2.00', currency: 'PEN' };
