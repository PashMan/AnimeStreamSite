-- Cloudflare D1 Schema (SQLite)

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT DEFAULT 'User',
  avatar TEXT,
  bio TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until DATETIME,
  watched_time INTEGER DEFAULT 0,
  episodes_watched INTEGER DEFAULT 0,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  theme_color TEXT,
  profile_layout TEXT,
  profile_banner TEXT,
  profile_bg TEXT,
  card_blur TEXT,
  card_opacity TEXT,
  avatar_shape TEXT,
  watched_anime_ids TEXT DEFAULT '[]',
  friends TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Forum Topics
CREATE TABLE IF NOT EXISTS forum_topics (
  id TEXT PRIMARY KEY,
  author_id TEXT REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  anime_id TEXT,
  views INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Forum Posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  topic_id TEXT REFERENCES forum_topics(id),
  author_id TEXT REFERENCES profiles(id),
  content TEXT NOT NULL,
  parent_id TEXT REFERENCES forum_posts(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Private Messages
CREATE TABLE IF NOT EXISTS private_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES profiles(id),
  receiver_id TEXT REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES profiles(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_content TEXT,
  target_link TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
