-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Topics Table
create table if not exists public.forum_topics (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text not null,
  author_email text not null,
  anime_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  category text default 'general',
  views integer default 0,
  replies_count integer default 0
);

-- 3. Create Posts Table
create table if not exists public.forum_posts (
  id uuid default uuid_generate_v4() primary key,
  topic_id uuid references public.forum_topics(id) on delete cascade not null,
  content text not null,
  author_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable RLS
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;

-- 5. Drop old policies to avoid conflicts
drop policy if exists "Public topics" on public.forum_topics;
drop policy if exists "Public posts" on public.forum_posts;
drop policy if exists "Auth insert topics" on public.forum_topics;
drop policy if exists "Auth insert posts" on public.forum_posts;

-- 6. Create Policies
-- Read access for everyone
create policy "Public topics" on public.forum_topics for select using (true);
create policy "Public posts" on public.forum_posts for select using (true);

-- Insert access for authenticated users
create policy "Auth insert topics" on public.forum_topics for insert to authenticated with check (true);
create policy "Auth insert posts" on public.forum_posts for insert to authenticated with check (true);

-- 7. Helper Functions
create or replace function increment_topic_views(topic_id_param uuid)
returns void as $$
begin
  update public.forum_topics
  set views = views + 1
  where id = topic_id_param;
end;
$$ language plpgsql;

create or replace function increment_topic_replies(topic_id_param uuid)
returns void as $$
begin
  update public.forum_topics
  set replies_count = replies_count + 1
  where id = topic_id_param;
end;
$$ language plpgsql;
