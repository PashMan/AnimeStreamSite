-- 1. Drop old tables to ensure clean state
drop table if exists public.forum_posts;
drop table if exists public.forum_topics;

-- 2. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 3. Create Topics Table (ID is TEXT)
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

-- 4. Create Posts Table (ID is TEXT)
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

-- 6. Create Policies (ALLOW PUBLIC ACCESS for this app architecture)
-- Since the app handles auth via a custom 'profiles' table and not Supabase Auth,
-- all requests come as 'anon'. We must allow 'anon' to insert.

-- Read access (Public)
create policy "Public topics select" on public.forum_topics for select using (true);
create policy "Public posts select" on public.forum_posts for select using (true);

-- Insert access (Public/Anon - required for custom auth)
create policy "Public topics insert" on public.forum_topics for insert with check (true);
create policy "Public posts insert" on public.forum_posts for insert with check (true);

-- Update/Delete access (Public/Anon - ideally restricted by app logic)
create policy "Public topics update" on public.forum_topics for update using (true);
create policy "Public posts update" on public.forum_posts for update using (true);
create policy "Public topics delete" on public.forum_topics for delete using (true);
create policy "Public posts delete" on public.forum_posts for delete using (true);

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

-- 8. Foreign Keys (if profiles table exists)
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
