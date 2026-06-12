export const onRequest = async (context: any) => {
  const { request } = context;
  const url = new URL(request.url);

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const pathname = url.pathname.replace(/^\/api\/manga/, '');

  // 1. SEARCH: /api/manga/search
  if (pathname === '/search' || pathname === 'search') {
    const query = url.searchParams.get('q') || '';
    const limit = url.searchParams.get('limit') || '30';
    let targetUrl = `https://api.mangadex.org/manga?limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
    if (query) {
      targetUrl += `&title=${encodeURIComponent(query)}`;
    } else {
      targetUrl += `&order[followedCount]=desc`;
    }

    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });
      const data: any = await res.json();
      if (!data || !data.data) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const results = data.data.map((manga: any) => {
        const id = manga.id;
        const attrs = manga.attributes || {};
        let title = attrs.title?.en || attrs.title?.['ja-ro'] || attrs.title?.ja || 'Без названия';
        if (attrs.altTitles && Array.isArray(attrs.altTitles)) {
          const ruTitleObj = attrs.altTitles.find((t: any) => t.ru);
          if (ruTitleObj) title = ruTitleObj.ru;
        }
        const originalTitle = attrs.title?.['ja-ro'] || attrs.title?.ja || attrs.title?.en || '';
        let cover = '';
        const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
        if (coverRel && coverRel.attributes?.fileName) {
          const fileName = coverRel.attributes.fileName;
          cover = `https://uploads.mangadex.org/covers/${id}/${fileName}.512.jpg`;
        } else {
          cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
        }
        let description = attrs.description?.ru || attrs.description?.en || 'Описание отсутствует.';
        description = description.replace(/\[\w+=\w+\]/g, '').replace(/\[\/\w+\]/g, '').replace(/\[hr\]/g, '');
        const genres = attrs.tags
          ?.filter((t: any) => t.attributes?.group === 'genre')
          ?.map((t: any) => t.attributes?.name?.ru || t.attributes?.name?.en)
          ?.filter(Boolean) || [];

        return {
          id,
          title,
          originalTitle,
          rating: Number((8.1 + Math.random() * 1.6).toFixed(1)),
          status: attrs.status === 'ongoing' ? 'Онгоинг' : (attrs.status === 'completed' ? 'Завершен' : 'Приостановлен'),
          description,
          cover,
          genres: genres.slice(0, 3),
          chapters: 0
        };
      });

      return new Response(JSON.stringify({ results }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // 2. PAGES FOR CHAPTER: /api/manga/chapter/:chapterId/pages
  const chapterPagesMatch = pathname.match(/^\/chapter\/([a-zA-Z0-9\-]+)\/pages\/?$/);
  if (chapterPagesMatch) {
    const chapterId = chapterPagesMatch[1];
    const targetUrl = `https://api.mangadex.org/at-home/server/${chapterId}`;

    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data: any = await res.json();
      if (!data || !data.chapter) {
        return new Response(JSON.stringify({ pages: [] }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const hash = data.chapter.hash;
      const baseUrl = data.baseUrl;
      const filenames = data.chapter.data;
      const pages = filenames.map((filename: string) => {
        return `${baseUrl}/data/${hash}/${filename}`;
      });

      return new Response(JSON.stringify({ pages }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // 3. CHAPTERS LIST: /api/manga/:id/chapters
  const chaptersMatch = pathname.match(/^\/([a-zA-Z0-9\-]+)\/chapters\/?$/);
  if (chaptersMatch) {
    const mangaId = chaptersMatch[1];
    const targetUrl = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=ru&order[chapter]=asc&limit=500&includes[]=scanlation_group`;

    try {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data: any = await res.json();
      if (!data || !data.data) {
        return new Response(JSON.stringify({ chapters: [] }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const chapters = data.data.map((ch: any) => {
        const attrs = ch.attributes || {};
        const sg = ch.relationships?.find((r: any) => r.type === 'scanlation_group');
        const groupName = sg?.attributes?.name || 'Внешний переводчик';
        return {
          id: ch.id,
          chapter: attrs.chapter || '0',
          volume: attrs.volume || '',
          title: attrs.title || `Глава ${attrs.chapter || ''}`,
          group: groupName,
          publishAt: attrs.publishAt
        };
      });

      // Sort chapters numerically
      chapters.sort((a: any, b: any) => {
        const numA = parseFloat(a.chapter) || 0;
        const numB = parseFloat(b.chapter) || 0;
        return numA - numB;
      });

      return new Response(JSON.stringify({ chapters }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // Route not found
  return new Response(JSON.stringify({ error: `Not found: ${pathname}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
};
