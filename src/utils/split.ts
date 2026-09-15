import type { ReceiptItem } from '../App';

// Tax and tip can each be entered as a percentage of the subtotal or a flat dollar amount.
export type ChargeMode = 'percent' | 'amount';

export interface Charges {
  tax: number;
  tip: number;
  taxMode: ChargeMode;
  tipMode: ChargeMode;
}

export const DEFAULT_CHARGES: Charges = { tax: 0, tip: 0, taxMode: 'percent', tipMode: 'percent' };

export const MAX_PERCENT = 100;

export const calculateSubtotal = (items: ReceiptItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

// Items only: each unit's price is split evenly among the guests assigned to it
export const calculateGuestSubtotal = (items: ReceiptItem[], guestId: string): number =>
  items.reduce((total, item) => {
    let itemTotalForGuest = 0;
    for (let i = 0; i < item.quantity; i++) {
      const unitAssignments = item.assignedTo[i] || [];
      if (unitAssignments.includes(guestId)) {
        itemTotalForGuest += item.price / unitAssignments.length;
      }
    }
    return total + itemTotalForGuest;
  }, 0);

// Dollar value of a tax/tip for the whole bill
export const chargeAmount = (value: number, mode: ChargeMode, subtotal: number): number =>
  mode === 'amount' ? value : subtotal * (value / 100);

// Re-expresses a charge in the other mode so switching doesn't change the bill
export const convertCharge = (value: number, from: ChargeMode, subtotal: number): number => {
  if (from === 'percent') return Math.round(chargeAmount(value, from, subtotal) * 100) / 100;
  if (subtotal <= 0) return 0;
  return Math.min(Math.round((value / subtotal) * 100 * 100) / 100, MAX_PERCENT);
};

export const formatCharge = (value: number, mode: ChargeMode): string =>
  mode === 'amount' ? `$${value.toFixed(2)}` : `${value}%`;

export interface BillTotals {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export const calculateBillTotals = (items: ReceiptItem[], charges: Charges): BillTotals => {
  const subtotal = calculateSubtotal(items);
  const tax = chargeAmount(charges.tax, charges.taxMode, subtotal);
  const tip = chargeAmount(charges.tip, charges.tipMode, subtotal);
  return { subtotal, tax, tip, total: subtotal + tax + tip };
};

// A guest's share of the bill: their items plus tax and tip pro-rated by their share of the subtotal
export const calculateGuestTotals = (items: ReceiptItem[], guestId: string, charges: Charges): BillTotals => {
  const bill = calculateBillTotals(items, charges);
  const subtotal = calculateGuestSubtotal(items, guestId);
  const ratio = bill.subtotal > 0 ? subtotal / bill.subtotal : 0;
  const tax = bill.tax * ratio;
  const tip = bill.tip * ratio;
  return { subtotal, tax, tip, total: subtotal + tax + tip };
};
