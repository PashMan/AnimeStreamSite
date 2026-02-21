import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || "https://tx3sdmc9np539dimkirn.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_gDNvqJupeWJBcINBwFtTwA_LWKiL_Be";
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Random Anime API
  app.get("/api/anime/random", async (req, res) => {
    // This would ideally call Shikimori or our DB
    res.json({ id: "random_id" }); 
  });

  // Premium Upscale Request
  app.post("/api/premium/upscale", async (req, res) => {
    const { userId, animeName } = req.body;
    // Check if user is premium and hasn't requested yet
    const { data, error } = await supabase
      .from("upscale_requests")
      .upsert({ user_id: userId, anime_name: animeName }, { onConflict: "user_id" });
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("send-global-message", (message) => {
      io.emit("global-message", message);
    });

    socket.on("watch-sync", (data) => {
      // data: { roomId, action: 'play' | 'pause' | 'seek', time, userId }
      socket.to(data.roomId).emit("watch-sync", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
