import { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ReceiptItemsSection } from './components/ReceiptItemsSection';
import { GuestsSection } from './components/GuestsSection';
import { SplitSummary } from './components/SplitSummary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Card } from './components/ui/card';
import { Receipt, Users, Calculator } from 'lucide-react';

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
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleItemsExtracted = (items: ReceiptItem[]) => {
    setReceiptItems(items);
  };

  const handleAddGuest = (guest: Guest) => {
    setGuests([...guests, guest]);
  };

  const handleRemoveGuest = (guestId: string) => {
    setGuests(guests.filter(g => g.id !== guestId));
    // Remove guest from all item assignments
    setReceiptItems(receiptItems.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(id => id !== guestId)
    })));
  };

  const handleToggleAssignment = (itemId: string, guestId: string) => {
    setReceiptItems(receiptItems.map(item => {
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
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setReceiptItems(receiptItems.filter(item => item.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ReceiptItem>) => {
    setReceiptItems(receiptItems.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl mb-2">💸 Cost Splitting Portal</h1>
          <p className="text-gray-600">Upload a receipt, add guests, and split the bill easily</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <Card className="lg:col-span-3 p-6">
            <ImageUploader 
              onItemsExtracted={handleItemsExtracted}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="items" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="items" className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Receipt Items ({receiptItems.length})
                </TabsTrigger>
                <TabsTrigger value="guests" className="flex items-center gap-2">
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
            <Card className="p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5" />
                <h2 className="text-xl">Split Summary</h2>
              </div>
              <SplitSummary
                items={receiptItems}
                guests={guests}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
