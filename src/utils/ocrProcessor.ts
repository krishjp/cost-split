import { ReceiptItem } from '../App';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function processReceiptImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ReceiptItem[]> {
  const formData = new FormData();
  formData.append('receipt', file);

  if (onProgress) onProgress(10); // Start progress

  const response = await fetch(`${API_URL}/api/parse-receipt`, {
    method: 'POST',
    body: formData,
  });

  if (onProgress) onProgress(50); // Halfway there

  if (!response.ok) {
    let errorMessage = `Failed to parse receipt (${response.statusText})`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Keep fallback message
      }
    }
    throw new Error(errorMessage);
  }

  const items: ReceiptItem[] = await response.json();

  if (onProgress) onProgress(100);

  // Validate/Transform items
  return items.map((item, index) => ({
    ...item,
    id: item.id || `api-item-${Date.now()}-${index}`,
    assignedTo: item.assignedTo || Array.from({ length: item.quantity }, () => [])
  }));
}