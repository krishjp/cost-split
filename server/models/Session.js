import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    items: { type: Array, default: [] },
    guests: { type: Array, default: [] },
    tax: { type: Number, default: 0 },
    tip: { type: Number, default: 0 },
    // Whether tax/tip is a percentage of the subtotal or a flat dollar amount
    taxMode: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    tipMode: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    // Secrets are excluded from queries by default; opt in with .select('+adminPin +adminToken').
    adminPin: { type: String, required: true, select: false },
    adminToken: { type: String, select: false },
    createdAt: { type: Date, default: Date.now }
});

export const Session = mongoose.model('Session', sessionSchema);
