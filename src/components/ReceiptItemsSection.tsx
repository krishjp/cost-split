import { useState } from 'react';
import { motion } from 'motion/react';
import { ReceiptItem, Guest } from '../App';
import { X, Edit2, Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from './ui/dropdown-menu';

interface ReceiptItemsSectionProps {
  items: ReceiptItem[];
  guests: Guest[];
  onToggleAssignment: (itemId: string, guestId: string, unitIndex: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<ReceiptItem>) => void;
  onAddItem: (item: ReceiptItem) => void;
  isAdmin: boolean;
}

export function ReceiptItemsSection({
  items,
  guests,
  onToggleAssignment,
  onRemoveItem,
  onUpdateItem,
  onAddItem,
  isAdmin
}: ReceiptItemsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');

  // Manual Entry State
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');

  const handleManualAdd = () => {
    if (newItemName.trim() && newItemPrice) {
      const price = parseFloat(newItemPrice);
      const quantity = parseInt(newItemQuantity) || 1;
      if (!isNaN(price) && price > 0 && quantity > 0) {
        onAddItem({
          id: `manual-${Date.now()}`,
          name: newItemName.trim(),
          price,
          quantity,
          assignedTo: Array(quantity).fill([])
        });
        setNewItemName('');
        setNewItemPrice('');
        setNewItemQuantity('1');
      }
    }
  };

  const startEdit = (item: ReceiptItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price.toString());
    setEditQuantity(item.quantity.toString());
  };

  const saveEdit = (itemId: string) => {
    const price = parseFloat(editPrice);
    const quantity = parseInt(editQuantity);
    if (editName.trim() && !isNaN(price) && price > 0 && !isNaN(quantity) && quantity > 0) {
      onUpdateItem(itemId, { name: editName.trim(), price, quantity });
    }
    setEditingId(null);
  };

  const renderAssignmentDropdown = (item: ReceiptItem, unitIndex: number) => {
    const currentAssignments = item.assignedTo[unitIndex] || [];

    return (
      <DropdownMenu key={unitIndex}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs justify-between font-normal text-muted-foreground hover:text-foreground mb-1"
          >
            <span>Unit #{unitIndex + 1}</span>
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {guests
                  .filter(g => currentAssignments.includes(g.id))
                  .slice(0, 3)
                  .map(g => (
                    <div key={g.id} className="w-2 h-2 rounded-full ring-1 ring-background" style={{ backgroundColor: g.color }} />
                  ))}
              </div>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {/* <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
            {`Who ate Unit #${unitIndex + 1}?`}
          </div> */}
          {guests.map(guest => (
            <DropdownMenuCheckboxItem
              key={guest.id}
              checked={currentAssignments.includes(guest.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onToggleAssignment(item.id, guest.id, unitIndex)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: guest.color }}
                />
                <span>{guest.name}</span>
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-6">
      {/* Manual Entry Form */}
      {isAdmin && (
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Add Item Manually</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Item Name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-grow"
            />
            <Input
              type="number"
              placeholder="Qty"
              className="w-16"
              min="1"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Price"
              className="w-24"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
            />
            <Button onClick={handleManualAdd} disabled={!newItemName || !newItemPrice}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No items yet. Add items manually above or upload a receipt!</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative group"
            >
              <div className="bg-card rounded-xl shadow-sm border border-border hover:border-primary/50 transition-all p-4 pr-10 min-w-[220px]">
                {editingId === item.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Item name"
                    />
                    <div className="flex gap-1">
                      <Input
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="h-8 text-sm w-16"
                        type="number"
                        placeholder="Qty"
                      />
                      <Input
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="h-8 text-sm"
                        type="number"
                        step="0.01"
                        placeholder="Price"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(item.id)}
                      className="w-full h-8"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{item.name}</p>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(item)}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      <div className="flex justify-between items-baseline">
                        <p className="text-muted-foreground text-xs">
                          {item.quantity} x ${item.price.toFixed(2)}
                        </p>
                        <p className="text-primary font-bold">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      {/* Guest Badges (Consolidated view) */}
                      <div className="flex flex-wrap gap-1 mb-2 min-h-[1.5em]">
                        {Array.from(new Set(item.assignedTo.flat())).map(guestId => {
                          const guest = guests.find(g => g.id === guestId);
                          if (!guest) return null;
                          return (
                            <Badge
                              key={guest.id}
                              style={{ backgroundColor: guest.color }}
                              className="text-[10px] text-white px-1.5 py-0.5 pointer-events-none"
                            >
                              {guest.name}
                            </Badge>
                          );
                        })}
                      </div>

                      {/* Assignment Dropdowns per Unit */}
                      {guests.length > 0 && (
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                          {Array.from({ length: item.quantity }).map((_, unitIdx) =>
                            renderAssignmentDropdown(item, unitIdx)
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {isAdmin && (
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
