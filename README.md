# 🍱 Cost Splitting Portal

> A premium, intelligent, and real-time web application to split bills with friends effortlessly. No accounts required.

![Project Banner](https://img.shields.io/badge/Status-Active-success?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## Overview

The **Cost Splitting Portal** solves the headache of dining out with large groups. Instead of passing around a receipt and doing napkin math, one person (the Admin) creates a session, uploads a photo of the receipt, and shares a link. 

Using **Gemini-based OCR**, the app automatically extracts items and prices. Guests can join the session from their own phones and simply claim what they ordered. Everything syncs in **real-time**, so when someone claims an item, everyone sees the bill update instantly.

## Key Features

- **OCR Text Extraction**: Uses Google Gemini & Python-based OCR to intelligently parse receipt images into editable line items.
- **Real-Time Collaboration**: Built with **Socket.io**, ensuring that splits, joins, and payments update across all devices instantly without refreshing.
- **Role-Based Access**:
  - **Admin**: Created via PIN protection. Can edit items, upload receipts, and manage guests.
  - **Guest**: Can join via link, claim items, and view their personal total.
- **Smart Calculations**: Automatically handles tax and tip distribution based on the subtotal of items claimed by each guest.

## Technology Stack

### Frontend
- **Framework**: [React](https://react.dev/) (powered by [Vite](https://vitejs.dev/))
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/) (headless accessibility)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State/Notifications**: [Sonner](https://sonner.emilkowal.ski/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Real-Time**: [Socket.io](https://socket.io/)
- **Database**: [MongoDB](https://www.mongodb.com/) (Atlas)
- **OCR Service**: Python script integrating `heic2any` concepts and **Google Gemini API** for vision processing.

### Infrastructure & Deployment
- **Frontend Hosting**: [Vercel](https://vercel.com/) (Edge Network)
- **Backend Hosting**: [Render](https://render.com/) (Node.js + Python environment)
- **Database Hosting**: MongoDB Atlas (Cloud)

## Project Structure

```bash
├── server/
│   ├── index.js             # Main Express server & Socket.io entry
│   ├── receipt_parser.py    # Python script for AI OCR processing
│   ├── models/              # Mongoose database schemas
│   └── requirements.txt     # Python dependencies
├── src/
│   ├── components/          # React functional components
│   │   ├── ui/              # Reusable UI primitives (Button, Card, etc.)
│   │   └── ...              # Feature-specific components (ReceiptItems, etc.)
│   ├── utils/               # Helper functions
│   ├── App.tsx              # Main application logic & routing
│   └── main.tsx             # Entry point
└── ...config files
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- MongoDB connection string
- Google Gemini API Key

### Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cost-splitting.git
   cd cost-splitting
   ```

2. **Install Dependencies**
   ```bash
   # Install Frontend & Backend Node dependencies
   npm install
   
   # Install Python dependencies (for OCR)
   pip install -r server/requirements.txt
   ```

3. **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
    GEMINI_API_KEY=your_google_gemini_key
    PORT=3001
    VITE_API_URL=http://localhost:3001
    ```

4. **Run Locally**
   You need two terminals for local development:

   **Terminal 1 (Backend):**
   ```bash
   npm run start
   ```

   **Terminal 2 (Frontend):**
   ```bash
   npm run dev
   ```

   Visit `http://localhost:5173` to see the app.

## Cloud Deployment

### Backend (Render)
The backend requires a cleaner environment that supports both Node.js and Python (for the receipt parser).
- **Build Command**: `./render-build.sh` (This custom script installs both Node and Python deps)
- **Start Command**: `npm start`
- **Env Vars**: `MONGO_URI`, `GEMINI_API_KEY`

### Frontend (Vercel)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Env Vars**: `VITE_API_URL` (Set this to your Render backend URL)

## License
MIT License.