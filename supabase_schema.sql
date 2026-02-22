-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Ensure profiles email is unique
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'profiles') then
    if not exists (select 1 from pg_constraint where conname = 'profiles_email_key') then
      alter table public.profiles add constraint profiles_email_key unique (email);
    end if;
  end if;
end $$;

-- Create Tables
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

create table if not exists public.forum_posts (
  id uuid default uuid_generate_v4() primary key,
  topic_id uuid references public.forum_topics(id) on delete cascade not null,
  content text not null,
  author_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Functions
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

-- RLS
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "forum_topics_select" on public.forum_topics;
drop policy if exists "forum_posts_select" on public.forum_posts;
drop policy if exists "forum_topics_insert" on public.forum_topics;
drop policy if exists "forum_posts_insert" on public.forum_posts;
drop policy if exists "Forum topics are viewable by everyone" on public.forum_topics;
drop policy if exists "Forum posts are viewable by everyone" on public.forum_posts;
drop policy if exists "Users can create topics" on public.forum_topics;
drop policy if exists "Users can create posts" on public.forum_posts;

-- Create Policies
create policy "forum_topics_select" on public.forum_topics for select using (true);
create policy "forum_posts_select" on public.forum_posts for select using (true);

create policy "forum_topics_insert" on public.forum_topics for insert with check (auth.role() = 'authenticated');
create policy "forum_posts_insert" on public.forum_posts for insert with check (auth.role() = 'authenticated');

-- FK Constraints
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'profiles') then
      if not exists (select 1 from pg_constraint where conname = 'forum_topics_author_email_fkey') then
        alter table public.forum_topics
        add constraint forum_topics_author_email_fkey
        foreign key (author_email)
        references public.profiles(email)
        on delete cascade;
      end if;
      
      if not exists (select 1 from pg_constraint where conname = 'forum_posts_author_email_fkey') then
        alter table public.forum_posts
        add constraint forum_posts_author_email_fkey
        foreign key (author_email)
        references public.profiles(email)
        on delete cascade;
      end if;
  end if;
end $$;
