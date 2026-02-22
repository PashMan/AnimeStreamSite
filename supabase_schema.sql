-- 1. Удаляем старые таблицы, чтобы изменить тип ID
drop table if exists public.forum_posts;
drop table if exists public.forum_topics;

-- 2. Включаем расширение UUID (для генерации ID обычных тем)
create extension if not exists "uuid-ossp";

-- 3. Создаем таблицу тем (Topics) с ID типа TEXT
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

-- 4. Создаем таблицу ответов (Posts) с ID типа TEXT
create table public.forum_posts (
  id text primary key default uuid_generate_v4()::text,
  topic_id text references public.forum_topics(id) on delete cascade not null,
  content text not null,
  author_email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Настраиваем права доступа (RLS)
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;

-- Политики для чтения (доступно всем)
create policy "Public topics select" on public.forum_topics for select using (true);
create policy "Public posts select" on public.forum_posts for select using (true);

-- Политики для записи (только авторизованные)
create policy "Auth topics insert" on public.forum_topics for insert to authenticated with check (true);
create policy "Auth posts insert" on public.forum_posts for insert to authenticated with check (true);

-- 6. Функции-счетчики (обновленные для типа TEXT)
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

-- 7. Исправление связей с профилями (если таблица profiles существует)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'profiles') then
      -- Добавляем FK только если его нет
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
