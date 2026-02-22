-- 1. Drop old tables to fix type mismatch
drop table if exists public.forum_posts;
drop table if exists public.forum_topics;

-- 2. Enable UUID extension (still useful for generating IDs)
create extension if not exists "uuid-ossp";

-- 3. Create Topics Table (ID is TEXT to support external IDs like 'news-123')
create table public.forum_topics (
  id text primary key default uuid_generate_v4()::text,
  title text not null,
  content text not null,
  author_email text not null,
  anime_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  category text default 'general',
  views integer default 0,
  replies_count integer default 0
);

-- 4. Create Posts Table
create table public.forum_posts (
  id text primary key default uuid_generate_v4()::text,
  topic_id text references public.forum_topics(id) on delete cascade not null,
  content text not null,
  author_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Enable RLS
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;

-- 6. Create Policies
create policy "Public topics" on public.forum_topics for select using (true);
create policy "Public posts" on public.forum_posts for select using (true);

create policy "Auth insert topics" on public.forum_topics for insert to authenticated with check (true);
create policy "Auth insert posts" on public.forum_posts for insert to authenticated with check (true);

-- 7. Helper Functions
create or replace function increment_topic_views(topic_id_param text)
returns void as $$
begin
  update public.forum_topics
  set views = views + 1
  where id = topic_id_param;
end;
$$ language plpgsql;

create or replace function increment_topic_replies(topic_id_param text)
returns void as $$
begin
  update public.forum_topics
  set replies_count = replies_count + 1
  where id = topic_id_param;
end;
$$ language plpgsql;
