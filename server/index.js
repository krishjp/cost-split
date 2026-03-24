import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Session } from './models/Session.js';

import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secure-secret-key-change-this';

// Configure helmet for security headers
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
});

// Configure multer for temporary file storage
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|heic/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const app = express();

// Security Middleware
app.use(helmetConfig);
app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'another-secure-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));


// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
        req.user = user;
        next();
    });
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cost-splitting';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));


// API Endpoints

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Create a new session
app.post('/api/create-session', async (req, res) => {
    const { pin } = req.body;

    if (!pin || pin.length < 4 || pin.length > 6) {
        return res.status(400).json({ error: "PIN must be 4-6 digits" });
    }

    const sessionId = uuidv4();
    try {
        const session = new Session({
            sessionId,
            adminPin: pin,
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

app.post('/api/verify-pin', async (req, res) => {
    const { sessionId, pin } = req.body;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.adminPin === pin) {
            // Generate a token that expires in 24 hours
            const token = jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ error: 'Invalid PIN' });
        }
    } catch (err) {
        console.error("Error verifying pin:", err);
        res.status(500).json({ error: "Verification failed" });
    }
});


// Get session data - Protected by JWT and sessionId check
app.get('/api/session/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // IDOR protection: Ensure the token belongs to the requested session
    if (req.user.sessionId !== id) {
        return res.status(403).json({ error: 'Forbidden: Access to other sessions is denied' });
    }

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
            const session = await Session.findOne({ sessionId });

            if (!session) {
                console.log(`Session ${sessionId} not found in DB.`);
                return;
            }

            if (Array.isArray(data.items)) {
                session.items = data.items.map(item => ({
                    name: String(item.name || ''),
                    price: Number(item.price || 0),
                    quantity: Number(item.quantity || 1)
                }));
            }

            if (Array.isArray(data.guests)) {
                session.guests = data.guests.map(guest => ({
                    name: String(guest.name || ''),
                    selections: Array.isArray(guest.selections) ? guest.selections.map(Number) : []
                }));
                session.markModified('guests');
            }

            if (data.tax !== undefined) session.tax = Number(data.tax);
            if (data.tip !== undefined) session.tip = Number(data.tip);

            await session.save();

            // Broadcast to everyone else in the room
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

app.post('/api/parse-receipt', upload.single('receipt'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No receipt image uploaded' });
    }

    const imagePath = req.file.path;
    const resolvedPath = path.resolve(imagePath);
    const uploadsDir = path.resolve(__dirname, '../uploads');
    if (imagePath.includes('..') || !imagePath.startsWith('uploads')) {
        return res.status(403).json({ error: 'Project security prohibits this path' });
    }

    const scriptPath = path.join(__dirname, 'receipt_parser.py');
    const pythonPath = 'python3';

    console.log(`Processing receipt: ${imagePath} using ${pythonPath}`);

    // Standard fork for isolation
    const pythonProcess = spawn(pythonPath, [scriptPath, imagePath]);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
        // Clean up uploaded file
        fs.unlink(imagePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        if (code !== 0) {
            console.error(`Python script exited with code ${code}`);
            console.error(`Python stderr: ${errorString}`);
            return res.status(500).json({ error: 'Failed to parse receipt', details: errorString });
        }

        try {
            const items = JSON.parse(dataString);
            res.json(items);
        } catch (e) {
            console.error('Failed to parse Python output:', dataString);
            res.status(500).json({ error: 'Invalid response from parser' });
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
