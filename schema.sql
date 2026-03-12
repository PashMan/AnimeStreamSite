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
  watching_anime_ids TEXT DEFAULT '[]',
  dropped_anime_ids TEXT DEFAULT '[]',
  friends TEXT DEFAULT '[]',
  role TEXT DEFAULT 'user',
  is_banned BOOLEAN DEFAULT FALSE,
  banned_until DATETIME,
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until DATETIME,
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
  topic_id TEXT REFERENCES forum_topics(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Private Messages
CREATE TABLE IF NOT EXISTS private_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Reports
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_content TEXT,
  target_link TEXT,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_email TEXT REFERENCES profiles(email) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_email, anime_id)
);

-- 7. Global Messages
CREATE TABLE IF NOT EXISTS global_messages (
  id TEXT PRIMARY KEY,
  user_email TEXT REFERENCES profiles(email) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Comments
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Premium Requests
CREATE TABLE IF NOT EXISTS premium_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  anime_name TEXT NOT NULL,
  type TEXT DEFAULT 'upscale',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  anime_id TEXT NOT NULL,
  user_email TEXT REFERENCES profiles(email) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating_plot INTEGER DEFAULT 0,
  rating_sound INTEGER DEFAULT 0,
  rating_visuals INTEGER DEFAULT 0,
  rating_overall INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Clubs
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  creator_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Club Members
CREATE TABLE IF NOT EXISTS club_members (
  club_id TEXT REFERENCES clubs(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, user_id)
);

-- 13. Club Messages
CREATE TABLE IF NOT EXISTS club_messages (
  id TEXT PRIMARY KEY,
  club_id TEXT REFERENCES clubs(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Community Collections
CREATE TABLE IF NOT EXISTS community_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  creator_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Collection Items
CREATE TABLE IF NOT EXISTS community_collection_items (
  collection_id TEXT REFERENCES community_collections(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  anime_title TEXT,
  anime_image TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, anime_id)
);
