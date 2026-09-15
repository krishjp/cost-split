import { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ReceiptItemsSection } from './components/ReceiptItemsSection';
import { GuestsSection } from './components/GuestsSection';
import { SplitSummary } from './components/SplitSummary';
import { GuestView } from './components/GuestView';
import { CreateSessionDialog } from './components/CreateSessionDialog';
import { AdminLoginDialog } from './components/AdminLoginDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { Receipt, Users, Calculator, Link as LinkIcon, Share2, LogOut } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { Loader2, ServerCrash } from 'lucide-react';
import { Charges, DEFAULT_CHARGES } from './utils/split';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[][]; // Index i = assignments for unit i
}

export interface Guest {
  id: string;
  name: string;
  color: string;
  paidAmount: number;
}

interface SessionData extends Partial<Charges> {
  items?: any[];
  guests?: Guest[];
}

interface ActionResult {
  ok: boolean;
  error?: string;
  session?: SessionData;
}

const adminTokenKey = (sid: string) => `cost-splitting-admin-${sid}`;
// Older builds cached the raw PIN; it is exchanged for a token on next load.
const legacyPinKey = (sid: string) => `cost-splitting-pin-${sid}`;

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [charges, setCharges] = useState<Charges>(DEFAULT_CHARGES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isGuestView, setIsGuestView] = useState(true);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const isAdmin = adminToken !== null;
  const [serverStatus, setServerStatus] = useState<'checking' | 'awake' | 'down'>('checking');

  // Check Server Health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`, { method: 'GET', signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          setServerStatus('awake');
        } else {
          throw new Error("Server not ready");
        }
      } catch (err) {
        console.log("Server sleeping...", err);
        setServerStatus('down');
        // Retry after 2 seconds
        setTimeout(checkHealth, 2000);
      }
    };
    checkHealth();
  }, []);

  // Initialize Socket and Session
  useEffect(() => {
    if (serverStatus !== 'awake') return;

    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');

    // Check if we are in "Guest View" directly (e.g. ?view=guest)
    // or if we just want to default to guest view if session exists?
    // For now, let's keep it simple: Everyone sees the same thing, 
    // but we can toggle a "Guest Mode" for the simplified UI.

    if (sid) {
      setSessionId(sid);
      restoreAdmin(sid);
      connectSocket(sid);
    }
    // Removed auto createSession
  }, [serverStatus]);

  // Restore admin mode on this device from a cached admin token
  const restoreAdmin = async (sid: string) => {
    let token = localStorage.getItem(adminTokenKey(sid));
    const legacyPin = localStorage.getItem(legacyPinKey(sid));
    localStorage.removeItem(legacyPinKey(sid));

    if (!token && legacyPin) {
      token = await verifyPin(sid, legacyPin);
    } else if (token && !(await verifyAdminToken(sid, token))) {
      token = null;
    }

    if (token) {
      localStorage.setItem(adminTokenKey(sid), token);
      setAdminToken(token);
      setIsGuestView(false);
    } else {
      localStorage.removeItem(adminTokenKey(sid));
    }
  };

  // Returns the session's admin token if the PIN is correct
  const verifyPin = async (sid: string, pin: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_URL}/api/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, pin })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        return data.token;
      }
      if (res.status === 429 && data.error) {
        toast.error(data.error);
      }
    } catch (err) {
      console.error("Verify PIN failed", err);
    }
    return null;
  };

  const verifyAdminToken = async (sid: string, token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/verify-admin-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, token })
      });
      return res.ok;
    } catch (err) {
      console.error("Verify admin token failed", err);
      return false;
    }
  };

  // normalize items to ensure backward compatibility
  const normalizeItems = (items: any[]): ReceiptItem[] => {
    return items.map(item => {
      const quantity = item.quantity || 1;
      let assignedTo = item.assignedTo;

      if (Array.isArray(assignedTo) && (assignedTo.length === 0 || typeof assignedTo[0] === 'string')) {
        assignedTo = [assignedTo];
      }

      if (!Array.isArray(assignedTo)) {
        assignedTo = [];
      }

      while (assignedTo.length < quantity) {
        assignedTo.push([]);
      }

      return {
        ...item,
        quantity,
        assignedTo: assignedTo as string[][]
      };
    });
  };

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
      .then(applySessionData)
      .catch(err => console.error("Failed to load session", err));

    newSocket.on('session-updated', (data) => {
      console.log('Session updated:', data);
      applySessionData(data);
    });

    return () => newSocket.close();
  };

  const applySessionData = (data: SessionData) => {
    if (data.items) setReceiptItems(normalizeItems(data.items));
    if (data.guests) setGuests(data.guests);
    setCharges(prev => ({
      tax: data.tax ?? prev.tax,
      tip: data.tip ?? prev.tip,
      taxMode: data.taxMode ?? prev.taxMode,
      tipMode: data.tipMode ?? prev.tipMode,
    }));
  };

  // The server rejects invalid or unauthorized changes and sends back its current
  // state, which replaces the optimistic local update.
  const handleActionResult = (result: ActionResult) => {
    if (result.ok) return;
    toast.error(result.error || "Update failed");
    if (result.session) applySessionData(result.session);
  };

  const createSession = async (pin: string) => {
    try {
      setIsProcessing(true);
      const res = await fetch(`${API_URL}/api/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const sid = data.sessionId;
      setSessionId(sid);
      setAdminToken(data.token);
      setIsGuestView(false);

      // Keep admin access on this device
      localStorage.setItem(adminTokenKey(sid), data.token);

      const url = new URL(window.location.href);
      url.searchParams.set('session', sid);
      window.history.pushState({}, '', url);

      connectSocket(sid);
      toast.success("Session Created!");
    } catch (err) {
      console.error("Failed to create session", err);
      toast.error("Failed to connect to server.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminLogin = async (pin: string) => {
    if (!sessionId) return false;
    const token = await verifyPin(sessionId, pin);
    if (token) {
      setAdminToken(token);
      setIsGuestView(false);
      localStorage.setItem(adminTokenKey(sessionId), token);
      toast.success("Admin Access Granted");
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setAdminToken(null);
    setIsGuestView(true);
    if (sessionId) {
      localStorage.removeItem(adminTokenKey(sessionId));
    }
    toast.info("Logged out of Admin mode");
  }

  // Admin-only changes; the server verifies the token before applying them
  const syncUpdate = (data: { items?: ReceiptItem[], guests?: Guest[] } & Partial<Charges>) => {
    if (!socket || !sessionId) return;
    socket.emit('update-session', { sessionId, token: adminToken, data }, handleActionResult);
  };

  const handleUpdateCharges = (update: Partial<Charges>) => {
    setCharges(prev => ({ ...prev, ...update }));
    syncUpdate(update);
  };

  // HANDLERS

  const handleItemsExtracted = (items: any[]) => {
    const newItems = normalizeItems(items);
    const updatedItems = [...receiptItems, ...newItems];
    setReceiptItems(updatedItems);
    syncUpdate({ items: updatedItems });
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
      assignedTo: item.assignedTo.map(unitSplits => unitSplits.filter(id => id !== guestId))
    }));
    setReceiptItems(newItems);

    syncUpdate({ guests: newGuests, items: newItems });
  };

  // Anyone with the link can claim items, so this uses its own event rather than an admin update
  const handleToggleAssignment = (itemId: string, guestId: string, unitIndex: number = 0) => {
    const targetItem = receiptItems.find(item => item.id === itemId);
    const assigned = !(targetItem?.assignedTo[unitIndex] || []).includes(guestId);

    const newItems = receiptItems.map(item => {
      if (item.id === itemId) {
        // Ensure assignedTo has enough arrays for the quantity
        const currentAssignedTo = [...item.assignedTo];
        // Fill gaps if needed
        while (currentAssignedTo.length < item.quantity) {
          currentAssignedTo.push([]);
        }

        const unitAssignments = currentAssignedTo[unitIndex] || [];

        const newUnitAssignments = assigned
          ? [...unitAssignments, guestId]
          : unitAssignments.filter(id => id !== guestId);

        currentAssignedTo[unitIndex] = newUnitAssignments;

        return {
          ...item,
          assignedTo: currentAssignedTo
        };
      }
      return item;
    });
    setReceiptItems(newItems);
    if (socket && sessionId) {
      socket.emit('toggle-assignment', { sessionId, itemId, guestId, unitIndex, assigned }, handleActionResult);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const newItems = receiptItems.filter(item => item.id !== itemId);
    setReceiptItems(newItems);
    syncUpdate({ items: newItems });
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ReceiptItem>) => {
    const newItems = receiptItems.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, ...updates };
        // If quantity changed, adjust assignedTo array size
        if (updates.quantity !== undefined) {
          const newQty = updates.quantity;
          let newAssignedTo = [...item.assignedTo];
          if (newQty > newAssignedTo.length) {
            while (newAssignedTo.length < newQty) newAssignedTo.push([]);
          } else if (newQty < newAssignedTo.length) {
            newAssignedTo = newAssignedTo.slice(0, newQty);
          }
          updatedItem.assignedTo = newAssignedTo;
        }
        return updatedItem;
      }
      return item;
    });
    setReceiptItems(newItems);
    syncUpdate({ items: newItems });
  };

  const handleUpdatePayment = (guestId: string, amount: number) => {
    const newGuests = guests.map(g =>
      g.id === guestId ? { ...g, paidAmount: amount } : g
    );
    setGuests(newGuests);
    syncUpdate({ guests: newGuests });
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  // Landing Page
  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-8 p-8 max-w-lg">
          <div>
            <h1 className="text-6xl mb-4">🍱</h1>
            <h1 className="text-4xl font-bold text-primary mb-2">Cost Splitting Portal</h1>
            <p className="text-muted-foreground text-lg">
              Easily split bills with friends. Upload receipts, assign items, and track payments.
            </p>
          </div>

          {serverStatus === 'awake' ? (
            <CreateSessionDialog
              onCreateSession={createSession}
              isProcessing={isProcessing}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 bg-muted/50 p-6 rounded-lg border border-border">
              {serverStatus === 'checking' ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Connecting to server...</p>
                </>
              ) : (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Waking up server...</p>
                    <p className="text-xs text-muted-foreground">This may take up to 60 seconds on the free tier.</p>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-8">
            No account needed. Just create a session and share the link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl mb-2 font-bold text-primary">🍱 Cost Splitting Portal</h1>
            <p className="text-muted-foreground">Upload a receipt or add items manually to split the bill.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-center md:justify-end">
            {isAdmin ? (
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                <LogOut className="w-4 h-4 mr-2" />
                Admin Logout
              </Button>
            ) : (
              <AdminLoginDialog onVerifyPin={handleAdminLogin} />
            )}

            <Button variant="outline" onClick={() => setIsGuestView(!isGuestView)}>
              {isGuestView ? "Switch to Summary View" : "Guest View"}
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
            charges={charges}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Section */}
            {adminToken && sessionId && (
              <Card className="lg:col-span-3 p-6 bg-card border-2 border-dashed border-border shadow-sm">
                <div className="flex flex-col items-center">
                  <p className="text-sm text-muted-foreground mb-4">Start by adding items manually below, or upload a receipt image.</p>
                  <ImageUploader
                    onItemsExtracted={handleItemsExtracted}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    admin={{ sessionId, token: adminToken }}
                  />
                </div>
              </Card>
            )}

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
                    isAdmin={isAdmin}
                  />
                </TabsContent>

                <TabsContent value="guests" className="mt-6">
                  <GuestsSection
                    guests={guests}
                    onAddGuest={handleAddGuest}
                    onRemoveGuest={handleRemoveGuest}
                    isAdmin={isAdmin}
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
                  charges={charges}
                  onUpdateCharges={handleUpdateCharges}
                  isAdmin={isAdmin}
                  onUpdatePayment={handleUpdatePayment}
                />
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
