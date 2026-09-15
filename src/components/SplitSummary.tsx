import { useState, useEffect } from 'react';
import { Guest, ReceiptItem } from '../App';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { cn } from '../utils';
import {
  Charges,
  ChargeMode,
  MAX_PERCENT,
  calculateBillTotals,
  calculateGuestTotals,
  chargeAmount,
  convertCharge,
  formatCharge,
} from '../utils/split';


interface SplitSummaryProps {
  items: ReceiptItem[];
  guests: Guest[];
  charges: Charges;
  onUpdateCharges: (update: Partial<Charges>) => void;
  isAdmin: boolean;
  onUpdatePayment: (guestId: string, amount: number) => void;
}

export function SplitSummary({
  items,
  guests,
  charges,
  onUpdateCharges,
  isAdmin,
  onUpdatePayment
}: SplitSummaryProps) {

  const { subtotal, tax: taxAmount, tip: tipAmount, total: totalAmount } = calculateBillTotals(items, charges);

  const chargeRowLabel = (label: string, value: number, mode: ChargeMode) =>
    mode === 'percent' ? `${label} (${formatCharge(value, mode)})` : label;

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
      <div className="space-y-3">
        <ChargeField
          label="Tax"
          value={charges.tax}
          mode={charges.taxMode}
          subtotal={subtotal}
          disabled={!isAdmin}
          onChange={(tax, taxMode) => onUpdateCharges({ tax, taxMode })}
        />
        <ChargeField
          label="Tip"
          value={charges.tip}
          mode={charges.tipMode}
          subtotal={subtotal}
          disabled={!isAdmin}
          onChange={(tip, tipMode) => onUpdateCharges({ tip, tipMode })}
        />
      </div>

      <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/50">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{chargeRowLabel('Tax', charges.tax, charges.taxMode)}</span>
          <span>${taxAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{chargeRowLabel('Tip', charges.tip, charges.tipMode)}</span>
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
            const guestTotal = calculateGuestTotals(items, guest.id, charges).total;
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
                      {remaining > 0.01 ? `Owes $${remaining.toFixed(2)}` : 'Settled Up'}
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

interface ChargeFieldProps {
  label: string;
  value: number;
  mode: ChargeMode;
  subtotal: number;
  disabled: boolean;
  onChange: (value: number, mode: ChargeMode) => void;
}

// Tax/tip input with a %/$ toggle. Sized to 44px on mobile so the toggle is easy to tap.
function ChargeField({ label, value, mode, subtotal, disabled, onChange }: ChargeFieldProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value, mode]);

  const commit = () => {
    const num = parseFloat(localValue);
    if (isNaN(num)) {
      setLocalValue(value.toString());
      return;
    }
    const clamped = Math.max(0, mode === 'percent' ? Math.min(num, MAX_PERCENT) : num);
    setLocalValue(clamped.toString());
    if (clamped !== value) onChange(clamped, mode);
  };

  const switchMode = (next: string) => {
    if ((next !== 'percent' && next !== 'amount') || next === mode) return;
    // Convert so the bill total stays the same after switching
    onChange(convertCharge(value, mode, subtotal), next);
  };

  const hint = mode === 'percent'
    ? `= $${chargeAmount(value, mode, subtotal).toFixed(2)}`
    : subtotal > 0 ? `≈ ${((value / subtotal) * 100).toFixed(1)}% of subtotal` : null;

  const toggleItemClass = "h-11 min-w-11 md:h-9 md:min-w-9 text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className="w-8 shrink-0 text-sm text-muted-foreground">{label}</Label>
        <div className="relative flex-1 min-w-0">
          {mode === 'amount' && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          )}
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            max={mode === 'percent' ? MAX_PERCENT : undefined}
            step={mode === 'percent' ? '0.1' : '0.01'}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            disabled={disabled}
            aria-label={`${label} ${mode === 'percent' ? 'percentage' : 'dollar amount'}`}
            className={cn("h-11 md:h-9 text-right", mode === 'amount' && "pl-6")}
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={mode}
          onValueChange={switchMode}
          disabled={disabled}
          aria-label={`${label} type`}
        >
          <ToggleGroupItem value="percent" aria-label="Percentage" className={toggleItemClass}>%</ToggleGroupItem>
          <ToggleGroupItem value="amount" aria-label="Dollar amount" className={toggleItemClass}>$</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground pl-10">{hint}</p>}
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

