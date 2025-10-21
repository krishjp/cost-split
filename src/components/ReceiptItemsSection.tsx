import { useState } from 'react';
import { motion } from 'motion/react';
import { ReceiptItem, Guest } from '../App';
import { X, Edit2, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface ReceiptItemsSectionProps {
  items: ReceiptItem[];
  guests: Guest[];
  onToggleAssignment: (itemId: string, guestId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<ReceiptItem>) => void;
}

export function ReceiptItemsSection({ 
  items, 
  guests, 
  onToggleAssignment, 
  onRemoveItem,
  onUpdateItem 
}: ReceiptItemsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const startEdit = (item: ReceiptItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
  };

  const saveEdit = (itemId: string) => {
    const price = parseFloat(editPrice);
    if (editName.trim() && !isNaN(price) && price > 0) {
      onUpdateItem(itemId, { name: editName.trim(), price });
    }
    setEditingId(null);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No items yet. Upload a receipt to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
            className="relative"
          >
            <div className="bg-white rounded-full shadow-lg border-2 border-purple-200 hover:border-purple-400 transition-all p-4 pr-12 min-w-[180px]">
              {editingId === item.id ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    placeholder="Item name"
                  />
                  <Input
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="h-7 text-sm"
                    type="number"
                    step="0.01"
                    placeholder="Price"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveEdit(item.id)}
                    className="w-full h-7"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">{item.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(item)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-purple-600">${item.price.toFixed(2)}</p>
                  </div>

                  {guests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {guests.map((guest) => {
                        const isAssigned = item.assignedTo.includes(guest.id);
                        return (
                          <Badge
                            key={guest.id}
                            onClick={() => onToggleAssignment(item.id, guest.id)}
                            style={{ 
                              backgroundColor: isAssigned ? guest.color : '#e5e7eb',
                              color: isAssigned ? 'white' : '#6b7280'
                            }}
                            className="cursor-pointer text-xs"
                          >
                            {guest.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <button
                onClick={() => onRemoveItem(item.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
