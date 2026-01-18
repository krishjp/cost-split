
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
import { Lock } from 'lucide-react';

interface AdminLoginDialogProps {
    onVerifyPin: (pin: string) => Promise<boolean>;
}

export function AdminLoginDialog({ onVerifyPin }: AdminLoginDialogProps) {
    const [pin, setPin] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setError('');

        const success = await onVerifyPin(pin);

        if (success) {
            setIsOpen(false);
            setPin('');
        } else {
            setError('Incorrect PIN');
        }
        setIsProcessing(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <Lock className="w-4 h-4" />
                    Admin Login
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Admin Login</DialogTitle>
                    <DialogDescription>
                        Enter the PIN created with this session to verify payments.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="PIN"
                            value={pin}
                            onChange={(e) => {
                                setPin(e.target.value.replace(/[^0-9]/g, ''));
                                setError('');
                            }}
                            className="text-center text-2xl tracking-widest"
                            autoFocus
                        />
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isProcessing || pin.length < 4} className="w-full">
                            {isProcessing ? "Verifying..." : "Verify"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
