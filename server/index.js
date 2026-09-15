import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import crypto from 'crypto';
import { Session } from './models/Session.js';
import {
    ValidationError,
    isId,
    normalizeAssignedTo,
    sanitizeParsedItems,
    validateSessionUpdate
} from './validation.js';

dotenv.config();

import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;
const PARSER_TIMEOUT_MS = 90 * 1000;

class UploadRejectedError extends Error {}

// Configure multer for temporary file storage
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: MAX_RECEIPT_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        // Browsers often send HEIC with an empty or generic MIME type, so fall back to the extension.
        const isImage = file.mimetype.startsWith('image/') || /\.(heic|heif)$/i.test(file.originalname);
        cb(isImage ? null : new UploadRejectedError('Receipt must be an image file'), isImage);
    }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const app = express();

// Behind a reverse proxy (Render sets RENDER=true), req.ip is the proxy's address unless
// Express trusts X-Forwarded-For, which would make every rate limit shared by all users.
const trustProxy = process.env.TRUST_PROXY ?? (process.env.RENDER ? '1' : undefined);
if (trustProxy !== undefined) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    if (req.body) mongoSanitize.sanitize(req.body);
    if (req.params) mongoSanitize.sanitize(req.params);
    if (req.query) mongoSanitize.sanitize(req.query);
    next();
});

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

// Helpers

const generateAdminToken = () => crypto.randomBytes(32).toString('base64url');

// Constant-time string comparison; hashing first keeps the lengths equal.
const secretsMatch = (expected, provided) => {
    if (typeof expected !== 'string' || typeof provided !== 'string') return false;
    const digest = (value) => crypto.createHash('sha256').update(value).digest();
    return crypto.timingSafeEqual(digest(expected), digest(provided));
};

const findSessionWithSecrets = (sessionId) =>
    Session.findOne({ sessionId: String(sessionId) }).select('+adminPin +adminToken');

// The only session shape that should ever leave the server.
const toClientSession = (session) => ({
    id: session.sessionId,
    items: session.items,
    guests: session.guests,
    tax: session.tax,
    tip: session.tip,
    taxMode: session.taxMode,
    tipMode: session.tipMode,
    createdAt: session.createdAt
});

// Serializes read-modify-write cycles per session so concurrent socket events
// (e.g. two guests tapping items at once) don't overwrite each other's changes.
// In-process only: this assumes a single server instance.
const sessionLocks = new Map();
const withSessionLock = (sessionId, task) => {
    const previous = sessionLocks.get(sessionId) ?? Promise.resolve();
    const run = previous.then(task);
    const tail = run.catch(() => {});
    sessionLocks.set(sessionId, tail);
    tail.then(() => {
        if (sessionLocks.get(sessionId) === tail) sessionLocks.delete(sessionId);
    });
    return run;
};

const rateLimitDefaults = { standardHeaders: true, legacyHeaders: false };

// API Endpoints

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});


// Create a new session
app.post('/api/create-session', async (req, res) => {
    const { pin } = req.body;

    if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be 4-6 digits" });
    }

    const sessionId = uuidv4();
    const token = generateAdminToken();
    try {
        const session = new Session({
            sessionId,
            adminPin: pin,
            adminToken: token,
            items: [],
            guests: []
        });
        await session.save();
        res.json({ sessionId, token });
    } catch (err) {
        console.error("Error creating session:", err);
        res.status(500).json({ error: "Failed to create session" });
    }
});

// PINs are short, so failed guesses are limited per IP and per session (successful logins don't count).
const pinIpLimiter = rateLimit({
    ...rateLimitDefaults,
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: { error: 'Too many PIN attempts. Please try again in 15 minutes.' },
});
const pinSessionLimiter = rateLimit({
    ...rateLimitDefaults,
    windowMs: 60 * 60 * 1000,
    limit: 30,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `session:${String(req.body?.sessionId)}`,
    message: { error: 'Too many PIN attempts for this session. Please try again later.' },
});

// Verify a PIN and hand out the session's admin token
app.post('/api/verify-pin', pinIpLimiter, pinSessionLimiter, async (req, res) => {
    const { sessionId, pin } = req.body;
    try {
        const session = await findSessionWithSecrets(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (!secretsMatch(session.adminPin, pin)) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Sessions created before admin tokens existed get one on first login.
        if (!session.adminToken) {
            session.adminToken = generateAdminToken();
            await session.save();
        }
        res.json({ success: true, token: session.adminToken });
    } catch (err) {
        console.error("Error verifying pin:", err);
        res.status(500).json({ error: "Verification failed" });
    }
});

// Check a stored admin token (used to restore admin mode on page load)
app.post('/api/verify-admin-token', async (req, res) => {
    const { sessionId, token } = req.body;
    try {
        const session = await findSessionWithSecrets(sessionId);
        if (session && secretsMatch(session.adminToken, token)) {
            return res.json({ success: true });
        }
        res.status(401).json({ error: 'Invalid admin token' });
    } catch (err) {
        console.error("Error verifying admin token:", err);
        res.status(500).json({ error: "Verification failed" });
    }
});


// Get session data
app.get('/api/session/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const session = await Session.findOne({ sessionId: String(id) });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(toClientSession(session));
    } catch (err) {
        console.error("Error fetching session:", err);
        res.status(500).json({ error: "Failed to fetch session" });
    }
});

// Socket.io Handlers

class ActionError extends Error {}

// Runs a session mutation under the session lock and reports the outcome through the
// client's ack callback. On failure the client also gets the authoritative session state
// so it can roll back its optimistic update.
const runSessionAction = async (socket, sessionId, ack, action) => {
    const respond = typeof ack === 'function' ? ack : () => {};
    const safeSessionId = String(sessionId);
    try {
        await withSessionLock(safeSessionId, async () => {
            const session = await findSessionWithSecrets(safeSessionId);
            if (!session) throw new ActionError('Session not found');

            action(session);
            session.markModified('items');
            session.markModified('guests');
            await session.save();

            socket.to(safeSessionId).emit('session-updated', toClientSession(session));
        });
        respond({ ok: true });
    } catch (err) {
        const isExpected = err instanceof ActionError || err instanceof ValidationError;
        if (!isExpected) console.error("Error updating session:", err);
        const current = await Session.findOne({ sessionId: safeSessionId }).catch(() => null);
        respond({
            ok: false,
            error: isExpected ? err.message : 'Failed to update session',
            session: current ? toClientSession(current) : undefined
        });
    }
};

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        socket.join(String(sessionId));
        console.log(`Socket ${socket.id} joined session ${sessionId}`);
    });

    // Admin-only: replace items, guests, and/or tax/tip values and modes.
    socket.on('update-session', (payload, ack) => {
        const { sessionId, token, data } = payload || {};
        runSessionAction(socket, sessionId, ack, (session) => {
            if (!secretsMatch(session.adminToken, token)) {
                throw new ActionError('Admin access required');
            }
            Object.assign(session, validateSessionUpdate(data, session));
        });
    });

    // Open to anyone with the session link: claim or unclaim one unit of an item for a guest.
    socket.on('toggle-assignment', (payload, ack) => {
        const { sessionId, itemId, guestId, unitIndex, assigned } = payload || {};
        runSessionAction(socket, sessionId, ack, (session) => {
            if (!isId(itemId) || !isId(guestId) || !Number.isInteger(unitIndex) || typeof assigned !== 'boolean') {
                throw new ActionError('Invalid assignment');
            }
            const guestIds = new Set(session.guests.map((guest) => guest.id));
            if (!guestIds.has(guestId)) throw new ActionError('Guest not found');

            const item = session.items.find((candidate) => candidate.id === itemId);
            if (!item) throw new ActionError('Item not found');
            if (unitIndex < 0 || unitIndex >= item.quantity) throw new ActionError('Invalid item unit');

            const assignedTo = normalizeAssignedTo(item.assignedTo, item.quantity, guestIds);
            const unit = assignedTo[unitIndex].filter((id) => id !== guestId);
            assignedTo[unitIndex] = assigned ? [...unit, guestId] : unit;

            session.items = session.items.map((candidate) =>
                candidate.id === itemId ? { ...candidate, assignedTo } : candidate
            );
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Receipt parsing costs Gemini quota, so it's limited to session admins.
const requireAdmin = async (req, res, next) => {
    const sessionId = req.get('X-Session-Id');
    const token = req.get('X-Admin-Token');
    try {
        const session = sessionId ? await findSessionWithSecrets(sessionId) : null;
        if (!session || !secretsMatch(session.adminToken, token)) {
            return res.status(401).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        console.error("Error checking admin token:", err);
        res.status(500).json({ error: 'Verification failed' });
    }
};

const receiptUpload = (req, res, next) => {
    upload.single('receipt')(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `Receipt image must be ${MAX_RECEIPT_BYTES / (1024 * 1024)} MB or smaller` });
        }
        if (err instanceof multer.MulterError || err instanceof UploadRejectedError) {
            return res.status(400).json({ error: err instanceof UploadRejectedError ? err.message : 'Invalid upload' });
        }
        if (err) return next(err);
        next();
    });
};

// Rate limiting specifically for receipt parsing to protect Gemini API free tier (15 RPM global limit)
const receiptParseLimiter = rateLimit({
    ...rateLimitDefaults,
    windowMs: 60 * 1000, // 1 minute
    limit: 5, // Limit each IP to 5 requests per minute
    message: { error: 'Too many receipt uploads from this IP. Please try again in a minute.' },
});

app.post('/api/parse-receipt', receiptParseLimiter, requireAdmin, receiptUpload, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No receipt image uploaded' });
    }

    const imagePath = req.file.path;
    const scriptPath = path.join(__dirname, 'receipt_parser.py');
    const pythonPath = 'python3';

    console.log(`Processing receipt: ${imagePath} using ${pythonPath}`);

    const pythonProcess = spawn(pythonPath, [scriptPath, imagePath]);

    let dataString = '';
    let errorString = '';
    let finished = false;

    const timeout = setTimeout(() => {
        console.error(`Receipt parser timed out after ${PARSER_TIMEOUT_MS}ms`);
        pythonProcess.kill();
    }, PARSER_TIMEOUT_MS);

    // 'error' and 'close' can both fire for one process; clean up and respond only once.
    const finish = (status, body) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        fs.unlink(imagePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
        res.status(status).json(body);
    };

    pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorString += data.toString();
    });

    pythonProcess.on('error', (err) => {
        console.error('Failed to start receipt parser:', err);
        finish(500, { error: 'Failed to parse receipt' });
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python script exited with code ${code}`);
            console.error(`Python stdout: ${dataString}`);
            console.error(`Python stderr: ${errorString}`);
            return finish(500, { error: 'Failed to parse receipt' });
        }

        try {
            finish(200, sanitizeParsedItems(JSON.parse(dataString)));
        } catch (e) {
            console.error('Failed to parse Python output:', dataString);
            finish(500, { error: 'Invalid response from parser' });
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
