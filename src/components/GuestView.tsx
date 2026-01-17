import { useState, useMemo } from 'react';
import { ReceiptItem, Guest } from '../App';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Check, User, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';

interface GuestViewProps {
    items: ReceiptItem[];
    guests: Guest[];
    onToggleAssignment: (itemId: string, guestId: string) => void;
}

export function GuestView({ items, guests, onToggleAssignment }: GuestViewProps) {
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

    const myTotal = useMemo(() => {
        if (!selectedGuestId) return 0;
        return items.reduce((acc, item) => {
            if (item.assignedTo.includes(selectedGuestId)) {
                return acc + (item.price / item.assignedTo.length);
            }
            return acc;
        }, 0);
    }, [items, selectedGuestId]);

    if (!selectedGuestId) {
        return (
            <Card className="max-w-md mx-auto p-6 md:p-8 text-center space-y-6">
                <div>
                    <h2 className="text-2xl font-bold mb-2">Welcome! 👋</h2>
                    <p className="text-muted-foreground">Select your name to start selecting your items.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {guests.map((guest) => (
                        <button
                            key={guest.id}
                            onClick={() => setSelectedGuestId(guest.id)}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left"
                        >
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: guest.color }}
                            >
                                {guest.name[0].toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{guest.name}</span>
                        </button>
                    ))}
                </div>

                {guests.length === 0 && (
                    <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                        No guests found via this link. Ask the creator to add you first!
                    </p>
                )}
            </Card>
        );
    }

    const selectedGuest = guests.find(g => g.id === selectedGuestId);

    return (
        <div className="max-w-md mx-auto space-y-4">
            <Card className="p-4 flex items-center justify-between sticky top-4 z-10 shadow-md border-primary/20 bg-card/95 backdrop-blur">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedGuestId(null)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: selectedGuest?.color }}
                            />
                            <h2 className="font-bold">{selectedGuest?.name}'s Total</h2>
                        </div>

                        <p className="text-2xl font-bold text-primary mt-1">
                            ${myTotal.toFixed(2)}
                        </p>
                    </div>
                </div>
            </Card>

            <div className="space-y-3 pb-20">
                <h3 className="text-sm font-medium text-muted-foreground px-1">Tap items you shared or ate:</h3>
                {items.map((item) => {
                    const isSelected = item.assignedTo.includes(selectedGuestId);
                    return (
                        <motion.div
                            key={item.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onToggleAssignment(item.id, selectedGuestId)}
                            className={cn(
                                "p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between shadow-sm",
                                isSelected
                                    ? "bg-primary/5 border-primary shadow-md ring-1 ring-primary/20"
                                    : "bg-card border-border hover:border-primary/30"
                            )}
                        >
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="font-semibold text-primary ml-2">${item.price.toFixed(2)}</span>
                                </div>

                                {/* Split details */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground h-5">
                                    {item.assignedTo.length > 0 ? (
                                        <>
                                            <User className="w-3 h-3" />
                                            <span>
                                                Split by {item.assignedTo.length} person{item.assignedTo.length !== 1 && 's'}
                                                {isSelected && (
                                                    <span className="ml-1 text-primary font-medium">
                                                        (${(item.price / item.assignedTo.length).toFixed(2)} each)
                                                    </span>
                                                )}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground/50">Unassigned</span>
                                    )}
                                </div>
                            </div>

                            <div className={cn(
                                "w-6 h-6 rounded-full border-2 ml-4 flex items-center justify-center transition-colors",
                                isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                            )}>
                                {isSelected && <Check className="w-4 h-4" />}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
