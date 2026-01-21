import { useState } from 'react';
import { motion } from 'motion/react';
import { Guest } from '../App';
import { X, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../utils';

interface GuestsSectionProps {
  guests: Guest[];
  onAddGuest: (guest: Guest) => void;
  onRemoveGuest: (guestId: string) => void;
  isAdmin: boolean;
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export function GuestsSection({ guests, onAddGuest, onRemoveGuest, isAdmin }: GuestsSectionProps) {
  const [newGuestName, setNewGuestName] = useState('');

  const handleAddGuest = () => {
    if (newGuestName.trim()) {
      const color = COLORS[guests.length % COLORS.length];
      onAddGuest({
        id: `guest-${Date.now()}`,
        name: newGuestName.trim(),
        color,
        paidAmount: 0
      });
      setNewGuestName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddGuest();
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex gap-2">
          <Input
            value={newGuestName}
            onChange={(e) => setNewGuestName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter guest name..."
            className="flex-1"
          />
          <Button onClick={handleAddGuest} disabled={!newGuestName.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Guest
          </Button>
        </div>
      )}

      {guests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No guests yet. Add guests to split the bill!</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {guests.map((guest, index) => (
            <motion.div
              key={guest.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative"
            >
              <div
                className={cn(
                  "rounded-full shadow-lg border-2 hover:scale-105 transition-transform p-4 min-w-[140px]",
                  isAdmin ? "pr-12" : "px-6"
                )}
                style={{
                  backgroundColor: guest.color,
                  borderColor: guest.color,
                }}
              >
                <p className="text-white text-center">{guest.name}</p>
                {isAdmin && (
                  <button
                    onClick={() => onRemoveGuest(guest.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
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
