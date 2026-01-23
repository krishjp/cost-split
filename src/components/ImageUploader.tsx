import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { processReceiptImage } from '../utils/ocrProcessor';
import { ReceiptItem } from '../App';
import { Progress } from './ui/progress';
import heic2any from 'heic2any';

interface ImageUploaderProps {
  onItemsExtracted: (items: ReceiptItem[]) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

export function ImageUploader({ onItemsExtracted, isProcessing, setIsProcessing }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      try {
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.7
        });

        const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const url = URL.createObjectURL(blobToUse);
        setPreview(url);
      } catch (err) {
        console.error("Error generating HEIC preview:", err);
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    // Process image
    setIsProcessing(true);
    setProgress(10);

    try {
      const items = await processReceiptImage(file, (p) => {
        setProgress(10 + (p * 0.9));
      });
      onItemsExtracted(items);
      setProgress(100);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process receipt. Please try again.');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 500);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          onClick={handleUploadClick}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Receipt
            </>
          )}
        </Button>

        {preview && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <ImageIcon className="w-4 h-4" />
            Receipt uploaded
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-gray-600 text-center">
            Extracting text from receipt...
          </p>
        </div>
      )}

      {preview && !isProcessing && (
        <div className="mt-4">
          <img
            src={preview}
            alt="Receipt preview"
            className="max-h-48 rounded-lg border-2 border-gray-200 object-contain"
          />
        </div>
      )}
    </div>
  );
}
