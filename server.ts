import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import bodyParser from 'body-parser';
import { User, ChatMessage, ForumTopic, ForumPost, Comment, PrivateMessage } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3000;

// In-memory Database
const db = {
  users: [] as User[],
  globalMessages: [] as ChatMessage[],
  privateMessages: [] as PrivateMessage[],
  forumTopics: [] as ForumTopic[],
  forumPosts: [] as ForumPost[],
  comments: [] as Comment[],
  favorites: {} as Record<string, string[]>, // email -> animeIds
  watched: {} as Record<string, string[]>, // email -> animeIds
  history: {} as Record<string, any[]>, // email -> history items
  premiumRequests: [] as { userId: string, animeName: string, status: string }[]
};

app.use(cors());
app.use(bodyParser.json());

// API Routes

// Auth
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  
  const newUser: User = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    email,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    isPremium: false,
    watchedTime: "0ч 0м",
    episodesWatched: 0,
    bio: "",
    friends: [],
    watchedAnimeIds: []
  };
  
  // Store password separately ideally, but for demo we'll just store user object
  // In a real app, hash password. Here we simulate auth.
  (newUser as any).password = password;
  
  db.users.push(newUser);
  const { password: _, ...safeUser } = newUser as any;
  res.json(safeUser);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find((u: any) => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const { password: _, ...safeUser } = user as any;
  res.json(safeUser);
});

app.post('/api/auth/update', (req, res) => {
  const { email, updates } = req.body;
  const userIndex = db.users.findIndex(u => u.email === email);
  
  if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
  
  db.users[userIndex] = { ...db.users[userIndex], ...updates };
  const { password: _, ...safeUser } = db.users[userIndex] as any;
  res.json(safeUser);
});

// User Data
app.get('/api/user/:email/favorites', (req, res) => {
  res.json(db.favorites[req.params.email] || []);
});

app.post('/api/user/:email/favorites', (req, res) => {
  const { animeId } = req.body;
  const email = req.params.email;
  if (!db.favorites[email]) db.favorites[email] = [];
  
  const idx = db.favorites[email].indexOf(animeId);
  if (idx > -1) db.favorites[email].splice(idx, 1);
  else db.favorites[email].push(animeId);
  
  res.json(db.favorites[email]);
});

app.get('/api/user/:email/watched', (req, res) => {
  res.json(db.watched[req.params.email] || []);
});

app.post('/api/user/:email/watched', (req, res) => {
  const { animeId } = req.body;
  const email = req.params.email;
  if (!db.watched[email]) db.watched[email] = [];
  
  const idx = db.watched[email].indexOf(animeId);
  if (idx > -1) db.watched[email].splice(idx, 1);
  else db.watched[email].push(animeId);
  
  // Update user stats
  const user = db.users.find(u => u.email === email);
  if (user) {
    user.watchedAnimeIds = db.watched[email];
    user.episodesWatched = db.watched[email].length * 12; // Estimate
  }

  res.json(db.watched[email]);
});

app.get('/api/user/:email/history', (req, res) => {
  res.json(db.history[req.params.email] || []);
});

app.post('/api/user/:email/history', (req, res) => {
  const { anime, episode } = req.body;
  const email = req.params.email;
  if (!db.history[email]) db.history[email] = [];
  
  db.history[email] = db.history[email].filter(h => h.animeId !== anime.id);
  db.history[email].unshift({ 
    animeId: anime.id, 
    title: anime.title, 
    image: anime.image, 
    episode, 
    date: new Date().toISOString() 
  });
  db.history[email] = db.history[email].slice(0, 30);
  
  res.json(db.history[email]);
});

// Forum
app.get('/api/forum/topics', (req, res) => {
  const { animeId } = req.query;
  let topics = db.forumTopics;
  if (animeId) {
    topics = topics.filter(t => t.animeId === animeId);
  }
  res.json(topics.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

app.post('/api/forum/topics', (req, res) => {
  const topic = { ...req.body, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() };
  db.forumTopics.push(topic);
  res.json(topic);
});

// Chat
app.get('/api/chat/global', (req, res) => {
  res.json(db.globalMessages.slice(-100));
});

app.post('/api/chat/global', (req, res) => {
  const msg = { ...req.body, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() };
  db.globalMessages.push(msg);
  if (db.globalMessages.length > 200) db.globalMessages.shift();
  io.emit('global-message', msg);
  res.json(msg);
});

// Premium Upscale
app.post('/api/premium/upscale', (req, res) => {
  const { userId, animeName } = req.body;
  db.premiumRequests.push({ userId, animeName, status: 'pending' });
  res.json({ success: true });
});


// Socket.IO Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('watch-sync', (data) => {
    // Broadcast to others in the room
    socket.to(data.roomId).emit('watch-sync', data);
  });

  socket.on('room-message', (data) => {
    io.to(data.roomId).emit('room-message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start Server
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
