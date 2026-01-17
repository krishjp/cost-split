import { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ReceiptItemsSection } from './components/ReceiptItemsSection';
import { GuestsSection } from './components/GuestsSection';
import { SplitSummary } from './components/SplitSummary';
import { GuestView } from './components/GuestView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { Receipt, Users, Calculator, Link as LinkIcon, Share2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
}

export interface Guest {
  id: string;
  name: string;
  color: string;
}

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isGuestView, setIsGuestView] = useState(false);

  // Initialize Socket and Session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');

    // Check if we are in "Guest View" directly (e.g. ?view=guest)
    // or if we just want to default to guest view if session exists?
    // For now, let's keep it simple: Everyone sees the same thing, 
    // but we can toggle a "Guest Mode" for the simplified UI.

    if (sid) {
      setSessionId(sid);
      connectSocket(sid);
    } else {
      createSession();
    }
  }, []);

  const connectSocket = (sid: string) => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      newSocket.emit('join-session', sid);
    });

    // Initial data fetch
    fetch(`${API_URL}/api/session/${sid}`)
      .then(res => res.json())
      .then(data => {
        if (data.items) setReceiptItems(data.items);
        if (data.guests) setGuests(data.guests);
        if (data.tax !== undefined) setTaxPercentage(data.tax);
        if (data.tip !== undefined) setTipPercentage(data.tip);
      })
      .catch(err => console.error("Failed to load session", err));

    newSocket.on('session-updated', (data) => {
      console.log('Session updated:', data);
      if (data.items) setReceiptItems(data.items);
      if (data.guests) setGuests(data.guests);
      if (data.tax !== undefined) setTaxPercentage(data.tax);
      if (data.tip !== undefined) setTipPercentage(data.tip);
    });

    return () => newSocket.close();
  };

  const createSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/create-session`, { method: 'POST' });
      const data = await res.json();
      const sid = data.sessionId;
      setSessionId(sid);

      // Update URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.set('session', sid);
      window.history.pushState({}, '', url);

      connectSocket(sid);
    } catch (err) {
      console.error("Failed to create session", err);
      toast.error("Failed to connect to server. Ensure local backend is running.");
    }
  };

  const syncUpdate = (data: { items?: ReceiptItem[], guests?: Guest[], tax?: number, tip?: number }) => {
    if (!socket || !sessionId) return;
    socket.emit('update-session', { sessionId, data });
  };

  const handleUpdateTaxTip = (tax: number, tip: number) => {
    setTaxPercentage(tax);
    setTipPercentage(tip);
    syncUpdate({ tax, tip });
  };

  // HANDLERS

  const handleItemsExtracted = (items: ReceiptItem[]) => {
    const newItems = [...receiptItems, ...items];
    setReceiptItems(newItems);
    syncUpdate({ items: newItems });
  };

  const handleAddGuest = (guest: Guest) => {
    const newGuests = [...guests, guest];
    setGuests(newGuests);
    syncUpdate({ guests: newGuests });
  };

  const handleRemoveGuest = (guestId: string) => {
    const newGuests = guests.filter(g => g.id !== guestId);
    setGuests(newGuests);

    // Remove guest from assignments
    const newItems = receiptItems.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(id => id !== guestId)
    }));
    setReceiptItems(newItems);

    syncUpdate({ guests: newGuests, items: newItems });
  };

  const handleToggleAssignment = (itemId: string, guestId: string) => {
    const newItems = receiptItems.map(item => {
      if (item.id === itemId) {
        const isAssigned = item.assignedTo.includes(guestId);
        return {
          ...item,
          assignedTo: isAssigned
            ? item.assignedTo.filter(id => id !== guestId)
            : [...item.assignedTo, guestId]
        };
      }
      return item;
    });
    setReceiptItems(newItems);
    syncUpdate({ items: newItems });
  };

  const handleRemoveItem = (itemId: string) => {
    const newItems = receiptItems.filter(item => item.id !== itemId);
    setReceiptItems(newItems);
    syncUpdate({ items: newItems });
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ReceiptItem>) => {
    const newItems = receiptItems.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    setReceiptItems(newItems);
    syncUpdate({ items: newItems });
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  if (!sessionId) return <div className="flex items-center justify-center min-h-screen">Loading Session...</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl mb-2 font-bold text-primary">🍱 Cost Splitting Portal</h1>
            <p className="text-muted-foreground">Upload a receipt or add items manually to split the bill.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsGuestView(!isGuestView)}>
              {isGuestView ? "Switch to Creator View" : "Guest View Preview"}
            </Button>
            <Button onClick={copyShareLink} className="gap-2">
              <Share2 className="w-4 h-4" />
              Share Session
            </Button>
          </div>
        </div>

        {isGuestView ? (
          <GuestView
            items={receiptItems}
            guests={guests}
            onToggleAssignment={handleToggleAssignment}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Section - Moved to less prominent location or kept here but styled */}
            <Card className="lg:col-span-3 p-6 bg-card border-2 border-dashed border-border shadow-sm">
              <div className="flex flex-col items-center">
                <p className="text-sm text-muted-foreground mb-4">Start by adding items manually below, or upload a receipt image.</p>
                <ImageUploader
                  onItemsExtracted={handleItemsExtracted}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />
              </div>
            </Card>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-xl">
                  <TabsTrigger value="items" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Receipt className="w-4 h-4" />
                    Receipt Items ({receiptItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="guests" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Users className="w-4 h-4" />
                    Guests ({guests.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-6">
                  <ReceiptItemsSection
                    items={receiptItems}
                    guests={guests}
                    onToggleAssignment={handleToggleAssignment}
                    onRemoveItem={handleRemoveItem}
                    onUpdateItem={handleUpdateItem}
                    // Pass manual add handler directly or handle inside component?
                    // Better to handle inside component and emit up, but we need a prop for it.
                    onAddItem={(item) => {
                      const newItems = [...receiptItems, item];
                      setReceiptItems(newItems);
                      syncUpdate({ items: newItems });
                    }}
                  />
                </TabsContent>

                <TabsContent value="guests" className="mt-6">
                  <GuestsSection
                    guests={guests}
                    onAddGuest={handleAddGuest}
                    onRemoveGuest={handleRemoveGuest}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Summary Section */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-6 bg-card shadow-md border-border">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <Calculator className="w-5 h-5" />
                  <h2 className="text-xl font-semibold">Split Summary</h2>
                </div>
                <SplitSummary
                  items={receiptItems}
                  guests={guests}
                  taxPercentage={taxPercentage}
                  tipPercentage={tipPercentage}
                  onUpdateTaxTip={handleUpdateTaxTip}
                />
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
