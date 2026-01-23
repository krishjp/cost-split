import { ReceiptItem } from '../App';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function processReceiptImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ReceiptItem[]> {
  const formData = new FormData();
  formData.append('receipt', file);

  try {
    if (onProgress) onProgress(10); // Fake 10% progress

    const response = await fetch(`${API_URL}/api/parse-receipt`, {
      method: 'POST',
      body: formData,
    });

    if (onProgress) onProgress(50); // Fake 50% progress

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`Failed to parse receipt: ${response.statusText}`);
    }

    const items: ReceiptItem[] = await response.json();

    if (onProgress) onProgress(100);

    // Validate/Transform items if necessary
    return items.map((item, index) => ({
      ...item,
      // Ensure ID exists if backend didn't provide one, or make it unique
      id: item.id || `api-item-${Date.now()}-${index}`,
      assignedTo: item.assignedTo || Array.from({ length: item.quantity }, () => [])
    }));

  } catch (error) {
    console.error('Receipt Parsing Error:', error);
    // Return a dummy item so the user knows something happened but failed
    return [
      { id: `err-${Date.now()}`, name: 'Error parsing receipt. Please try again.', price: 0, quantity: 1, assignedTo: [[]] }
    ];
  }
}