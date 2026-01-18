
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
    <Toaster position="top-center" richColors />
  </>
);
