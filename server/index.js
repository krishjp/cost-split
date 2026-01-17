import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Session } from './models/Session.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cost-splitting';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// API Endpoints

// Create a new session
app.post('/api/create-session', async (req, res) => {
    const sessionId = uuidv4();
    try {
        const session = new Session({
            sessionId,
            items: [],
            guests: []
        });
        await session.save();
        res.json({ sessionId });
    } catch (err) {
        console.error("Error creating session:", err);
        res.status(500).json({ error: "Failed to create session" });
    }
});

// Get session data
app.get('/api/session/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const session = await Session.findOne({ sessionId: id });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(session);
    } catch (err) {
        console.error("Error fetching session:", err);
        res.status(500).json({ error: "Failed to fetch session" });
    }
});

// Socket.io Handlers
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        socket.join(sessionId);
        console.log(`Socket ${socket.id} joined session ${sessionId}`);
    });

    socket.on('update-session', async ({ sessionId, data }) => {
        try {
            // Check if session exists, if not create it (upsert-like behavior for safety)
            let session = await Session.findOne({ sessionId });

            if (!session) {
                console.log(`Session ${sessionId} not found in DB. Creating new entry.`);
                session = new Session({ sessionId });
            }

            // Update fields
            if (data.items) session.items = data.items;
            if (data.guests) session.guests = data.guests;
            if (data.tax !== undefined) session.tax = data.tax;
            if (data.tip !== undefined) session.tip = data.tip;

            await session.save();

            // Broadcast to everyone else in the room
            // We send back the plain object
            const sessionData = {
                id: session.sessionId,
                items: session.items,
                guests: session.guests,
                tax: session.tax,
                tip: session.tip,
                createdAt: session.createdAt
            };

            socket.to(sessionId).emit('session-updated', sessionData);
        } catch (err) {
            console.error("Error updating session:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
