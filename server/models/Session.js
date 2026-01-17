import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    items: { type: Array, default: [] },
    guests: { type: Array, default: [] },
    tax: { type: Number, default: 0 },
    tip: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

export const Session = mongoose.model('Session', sessionSchema);
