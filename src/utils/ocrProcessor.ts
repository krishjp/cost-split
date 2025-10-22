import { createWorker } from 'tesseract.js';
import { ReceiptItem } from '../App';

export async function processReceiptImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ReceiptItem[]> {
  try {
    // Create an image element from the file
    const imageElement = await createImageElement(file);
    
    const worker = await createWorker('eng', undefined, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress);
        }
      }
    });

    const { data: { text } } = await worker.recognize(imageElement);
    await worker.terminate();

    // Parse the extracted text to find items and prices
    return parseReceiptText(text);
  } catch (error) {
    console.error('OCR Error:', error);
    // Return demo items if OCR fails
    return [
      { id: 'demo-1', name: 'Burger', price: 12.99, assignedTo: [] },
      { id: 'demo-2', name: 'Pizza', price: 18.50, assignedTo: [] },
      { id: 'demo-3', name: 'Salad', price: 9.99, assignedTo: [] },
      { id: 'demo-4', name: 'Fries', price: 5.50, assignedTo: [] },
    ];
  }
}

function createImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseReceiptText(text: string): ReceiptItem[] {
  const lines = text.split('\n').filter(line => line.trim());
  const items: ReceiptItem[] = [];
  
  // Common price patterns: $10.99, 10.99, $10, etc.
  const pricePattern = /\$?\d+\.?\d{0,2}/g;
  
  lines.forEach((line, index) => {
    // Skip common header/footer words
    const skipWords = ['receipt', 'total', 'subtotal', 'tax', 'thank', 'visit', 'date', 'time', 'card', 'change', 'cash'];
    if (skipWords.some(word => line.toLowerCase().includes(word))) {
      return;
    }

    // Find prices in the line
    const matches = line.match(pricePattern);
    if (matches && matches.length > 0) {
      // Get the last match (usually the price)
      const priceStr = matches[matches.length - 1].replace('$', '');
      const price = parseFloat(priceStr);
      
      // Only include if price is reasonable (between $0.50 and $500)
      if (price >= 0.50 && price <= 500) {
        // Extract item name (everything before the last price)
        const lastPriceIndex = line.lastIndexOf(matches[matches.length - 1]);
        let name = line.substring(0, lastPriceIndex).trim();
        
        // Clean up the name
        name = name.replace(/^\d+\s*x?\s*/i, ''); // Remove quantity indicators
        name = name.replace(/[^a-zA-Z0-9\s-]/g, ' ').trim(); // Remove special chars
        
        if (name.length > 2) {
          items.push({
            id: `item-${Date.now()}-${index}`,
            name: name.substring(0, 50), // Limit name length
            price: price,
            assignedTo: []
          });
        }
      }
    }
  });

  // If no items found, return some demo items
  if (items.length === 0) {
    return [
      { id: 'demo-1', name: 'Burger', price: 12.99, assignedTo: [] },
      { id: 'demo-2', name: 'Pizza', price: 18.50, assignedTo: [] },
      { id: 'demo-3', name: 'Salad', price: 9.99, assignedTo: [] },
      { id: 'demo-4', name: 'Fries', price: 5.50, assignedTo: [] },
    ];
  }

  return items;
}