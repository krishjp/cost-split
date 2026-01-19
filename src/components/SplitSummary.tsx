import { useState, useEffect } from 'react';
import { Guest, ReceiptItem } from '../App';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';


interface SplitSummaryProps {
  items: ReceiptItem[];
  guests: Guest[];
  taxPercentage: number;
  tipPercentage: number;
  onUpdateTaxTip: (tax: number, tip: number) => void;
  isAdmin: boolean;
  onUpdatePayment: (guestId: string, amount: number) => void;
}

export function SplitSummary({
  items,
  guests,
  taxPercentage,
  tipPercentage,
  onUpdateTaxTip,
  isAdmin,
  onUpdatePayment
}: SplitSummaryProps) {

  // Calculate raw subtotal for a guest (items only)
  const calculateGuestSubtotal = (guestId: string): number => {
    return items.reduce((total, item) => {
      let itemTotalForGuest = 0;
      // Iterate through each unit of quantity
      for (let i = 0; i < item.quantity; i++) {
        const unitAssignments = item.assignedTo[i] || [];
        if (unitAssignments.includes(guestId) && unitAssignments.length > 0) {
          itemTotalForGuest += (item.price / unitAssignments.length);
        }
      }
      return total + itemTotalForGuest;
    }, 0);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Calculate Tax and Tip amounts based on percentages
  const taxAmount = subtotal * (taxPercentage / 100);
  const tipAmount = subtotal * (tipPercentage / 100);
  const totalAmount = subtotal + taxAmount + tipAmount;

  const assignedSubtotal = items.reduce((sum, item) => {
    let itemAssignedValue = 0;
    for (let i = 0; i < item.quantity; i++) {
      const unitAssignments = item.assignedTo[i] || [];
      if (unitAssignments.length > 0) {
        itemAssignedValue += item.price;
      }
    }
    return sum + itemAssignedValue;
  }, 0);

  const unassignedSubtotal = subtotal - assignedSubtotal;

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p className="text-sm">Upload a receipt to see the split</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tax and Tip Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tax (%)</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={taxPercentage}
              onChange={(e) => onUpdateTaxTip(parseFloat(e.target.value) || 0, tipPercentage)}
              className="h-8 text-right pr-6"
            />
            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tip (%)</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={tipPercentage}
              onChange={(e) => onUpdateTaxTip(taxPercentage, parseFloat(e.target.value) || 0)}
              className="h-8 text-right pr-6"
            />
            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/50">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Tax ({taxPercentage}%)</span>
          <span>${taxAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Tip ({tipPercentage}%)</span>
          <span>${tipAmount.toFixed(2)}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between items-center font-bold text-lg">
          <span>Total</span>
          <span className="text-primary">${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <Separator />

      {guests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Add guests to see individual amounts
        </p>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Per Person Breakdown</h3>
          {guests.map((guest) => {
            const guestSubtotal = calculateGuestSubtotal(guest.id);
            // Pro-rated tax and tip based on their share of the subtotal
            const ratio = subtotal > 0 ? (guestSubtotal / subtotal) : 0;
            const guestTax = taxAmount * ratio;
            const guestTip = tipAmount * ratio;
            const guestTotal = guestSubtotal + guestTax + guestTip;
            const paidAmount = guest.paidAmount || 0;
            const remaining = guestTotal - paidAmount;

            const itemCount = items.reduce((count, item) => {
              const unitsInvolved = item.assignedTo.filter(unitSplits => unitSplits.includes(guest.id)).length;
              return count + unitsInvolved;
            }, 0);

            return (
              <div key={guest.id} className="p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: guest.color }}
                    />
                    <div>
                      <span className="text-sm font-medium block">{guest.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {itemCount} items
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold block">${guestTotal.toFixed(2)}</span>
                    <span className={`text-[10px] ${remaining > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                      {remaining > 0.01 ? `Owes $${remaining.toFixed(2)}` : 'Setted Up'}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/30 rounded p-2 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">Paid Amount:</span>
                  {isAdmin ? (
                    <PaymentInput
                      value={paidAmount}
                      onChange={(amount) => onUpdatePayment(guest.id, amount)}
                    />
                  ) : (
                    <span className="font-medium">${paidAmount.toFixed(2)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unassignedSubtotal > 0 && guests.length > 0 && (
        <div className="mt-4 p-3 bg-orange-50/50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-700 dark:text-orange-400">
            💡 <strong>Unassigned:</strong> ${unassignedSubtotal.toFixed(2)} + tax/tip remains.
          </p>
        </div>
      )}
    </div>
  );
}

function PaymentInput({ value, onChange }: { value: number, onChange: (val: number) => void }) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    const num = parseFloat(localValue);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    }
  };

  return (
    <div className="relative w-24">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleBlur();
            e.currentTarget.blur();
          }
        }}
        className="h-7 text-right pl-4 bg-background"
      />
    </div>
  );
}

