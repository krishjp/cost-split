
import { useState } from 'react';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface CreateSessionDialogProps {
    onCreateSession: (pin: string) => Promise<void>;
    isProcessing: boolean;
}

export function CreateSessionDialog({ onCreateSession, isProcessing }: CreateSessionDialogProps) {
    const [pin, setPin] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length < 4 || pin.length > 6) {
            setError('PIN must be 4-6 digits');
            return;
        }

        setError('');
        await onCreateSession(pin);
        // If successful (parent handles navigation), this unmounts. 
        // If error, parent handles toast.
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="w-full md:w-auto text-lg py-6 shadow-lg animate-pulse">
                    Start a New Split
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Session PIN</DialogTitle>
                    <DialogDescription>
                        Set a 4-6 digit PIN. You'll need this to access admin features (like marking payments) later.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pin">Admin PIN</Label>
                        <Input
                            id="pin"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="1234"
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value.replace(/[^0-9]/g, ''));
                                setError('');
                            }}
                            className="text-center text-2xl tracking-widest letter-spacing-4"
                            autoFocus
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isProcessing || pin.length < 4}>
                            {isProcessing ? "Creating..." : "Create Session"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
