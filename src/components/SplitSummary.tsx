import { Guest, ReceiptItem } from '../App';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

interface SplitSummaryProps {
  items: ReceiptItem[];
  guests: Guest[];
}

export function SplitSummary({ items, guests }: SplitSummaryProps) {
  const calculateGuestTotal = (guestId: string): number => {
    return items.reduce((total, item) => {
      if (item.assignedTo.includes(guestId) && item.assignedTo.length > 0) {
        return total + (item.price / item.assignedTo.length);
      }
      return total;
    }, 0);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
  const assignedAmount = items.reduce((sum, item) => {
    if (item.assignedTo.length > 0) {
      return sum + item.price;
    }
    return sum;
  }, 0);
  const unassignedAmount = totalAmount - assignedAmount;

  if (items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="text-sm">Upload a receipt to see the split</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Amount</span>
          <span className="text-lg">${totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Assigned</span>
          <span className="text-sm text-green-600">${assignedAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Unassigned</span>
          <span className="text-sm text-orange-600">${unassignedAmount.toFixed(2)}</span>
        </div>
      </div>

      <Separator />

      {guests.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          Add guests to see individual amounts
        </p>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm text-gray-600">Per Person</h3>
          {guests.map((guest) => {
            const total = calculateGuestTotal(guest.id);
            const itemCount = items.filter(item => item.assignedTo.includes(guest.id)).length;
            
            return (
              <div key={guest.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: guest.color }}
                  />
                  <span className="text-sm">{guest.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                <span className="font-medium">${total.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}

      {unassignedAmount > 0 && guests.length > 0 && (
        <div className="mt-4 p-3 bg-orange-50 rounded-lg">
          <p className="text-xs text-orange-800">
            💡 Tip: ${unassignedAmount.toFixed(2)} worth of items haven't been assigned to anyone yet.
          </p>
        </div>
      )}
    </div>
  );
}
