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

  // Helper functions for safe Cloudflare-native base64 encoding/decoding of unicode URLs
  const toBase64 = (str: string) => {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      return btoa(str);
    }
  };

  const fromBase64 = (str: string) => {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (e) {
      return atob(str);
    }
  };

  // Helper function to fetch ReManga chapters by titles
  const fetchRemangaChaptersByTitle = async (titles: string[]) => {
    const uniqueTitles = Array.from(new Set(titles.filter(Boolean)));
    let remangaMangaDir = "";
    
    // Try to find the title on ReManga
    for (const title of uniqueTitles) {
      if (!title) continue;
      try {
        const searchRes = await fetch(`https://api.remanga.org/api/search/?query=${encodeURIComponent(title)}&count=3`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const data: any = await searchRes.json();
        if (data && Array.isArray(data.content) && data.content.length > 0) {
          remangaMangaDir = data.content[0].dir;
          break;
        }
      } catch (e) {
        console.error(`[ReManga Search] failed for "${title}":`, e);
      }
    }

    if (!remangaMangaDir) return [];

    // Fetch branches
    try {
      const detailRes = await fetch(`https://api.remanga.org/api/titles/${remangaMangaDir}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const detailData: any = await detailRes.json();
      const content = detailData && detailData.content;
      if (!content || !content.branches || content.branches.length === 0) {
        return [];
      }

      const branches = content.branches;
      let allChapters: any[] = [];

      // Fetch chapters for each branch in parallel
      await Promise.allSettled(branches.map(async (branch: any) => {
        const branchId = branch.id;
        try {
          const chRes = await fetch(`https://api.remanga.org/api/titles/chapters/?branch_id=${branchId}&limit=250&page=1`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const chData: any = await chRes.json();
          const chList = chData && chData.content;
          if (Array.isArray(chList)) {
            chList.forEach((ch: any) => {
              const chNum = ch.chapter || '0';
              const grName = Array.isArray(branch.names) ? branch.names.join(', ') : (branch.names || 'Переводчики ReManga');
              allChapters.push({
                id: `remanga-${ch.id}`,
                chapter: chNum.toString(),
                volume: (ch.volume || '').toString(),
                title: ch.name || `Глава ${ch.chapter || ''}`,
                group: `ReManga: ${grName}`,
                publishAt: ch.pub_date || new Date().toISOString()
              });
            });
          }
        } catch (err) {
          console.error(`[ReManga] Fetch chapters failed for branch ${branchId}:`, err);
        }
      }));

      return allChapters;
    } catch (err) {
      console.error(`[ReManga] Detail fetch failed for "${remangaMangaDir}":`, err);
      return [];
    }
  };

  // 0. PAGE PROXY: /api/manga/page-proxy
  if (pathname === '/page-proxy' || pathname === 'page-proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    try {
      let referer = 'https://remanga.org/';
      if (targetUrl.includes('mangadex.org') || targetUrl.includes('mangadex.network')) {
        referer = 'https://mangadex.org/';
      } else if (targetUrl.includes('shikimori.one') || targetUrl.includes('shikimori.org')) {
        referer = 'https://shikimori.one/';
      } else if (url.searchParams.get('_zaza') || targetUrl.includes('rmr.rocks') || targetUrl.includes('one-way.work')) {
        referer = 'https://a.zazaza.me/';
      }
      
      let res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': referer,
          'Accept': 'image/*'
        }
      });

      if (!res.ok && targetUrl.includes('.mangadex.network')) {
        const chapterId = url.searchParams.get('chapterId');
        if (chapterId) {
          try {
            const nodeRes = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}?forcePort443=true`);
            const nodeData: any = await nodeRes.json();
            if (nodeData && nodeData.baseUrl) {
               const filename = targetUrl.split('/').pop();
               const marker = targetUrl.includes('/data-saver/') ? '/data-saver/' : '/data/';
               const hash = nodeData.chapter?.hash;
               if (hash && filename) {
                  const newUrl = `${nodeData.baseUrl}${marker}${hash}/${filename}`;
                  res = await fetch(newUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Referer': 'https://mangadex.org/'
                    }
                  });
               }
            }
          } catch(e) {}
        }

        if (!res.ok) {
          const index = targetUrl.indexOf('/data/');
          const indexSaver = targetUrl.indexOf('/data-saver/');
          const marker = indexSaver !== -1 ? '/data-saver/' : '/data/';
          const markerIndex = indexSaver !== -1 ? indexSaver : index;
          if (markerIndex !== -1) {
            try {
              const remainingPath = targetUrl.substring(markerIndex + marker.length);
              const fallbackUrl = `https://uploads.mangadex.org${marker}${remainingPath}`;
              res = await fetch(fallbackUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://mangadex.org/' }
              });
            } catch(e) {}
          }
        }
      }

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'Proxy fails' }), { status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      const blob = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      
      return new Response(blob, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch(err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // 1. SEARCH: /api/manga/search
  if (pathname === '/search' || pathname === 'search') {
    const query = url.searchParams.get('q') || '';
    const limitVal = Number(url.searchParams.get('limit') || '60');
    const offsetVal = Number(url.searchParams.get('offset') || '0');
    const order = url.searchParams.get('order') || '';
    const requestedSource = url.searchParams.get('source') || 'all';

    let mdUrl = `https://api.mangadex.org/manga?limit=${limitVal}&offset=${offsetVal}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=ru&hasAvailableChapters=true`;
    if (query) {
      mdUrl += `&title=${encodeURIComponent(query)}`;
    } else if (order) {
      if (order === 'latestUploadedChapter') {
        mdUrl += `&order[latestUploadedChapter]=desc`;
      } else {
        mdUrl += `&order[followedCount]=desc`;
      }
    } else {
      mdUrl += `&order[followedCount]=desc`;
    }

    let shikiUrl = `https://shikimori.one/api/mangas?limit=${limitVal}`;
    if (query) {
      shikiUrl += `&search=${encodeURIComponent(query)}`;
    } else {
      shikiUrl += `&page=${Math.floor(offsetVal / limitVal) + 1}`;
      if (order === 'followedCount' || order === 'rating' || !order) {
        shikiUrl += `&order=popularity`;
      } else {
        shikiUrl += `&order=id`;
      }
    }

    let rmUrl = `https://api.remanga.org/api/search/catalog/?count=${limitVal}&offset=${offsetVal}`;
    if (query) {
      rmUrl += `&search=${encodeURIComponent(query)}`;
    } else {
      if (order === 'latestUploadedChapter') {
        rmUrl += `&ordering=-chapter_date`;
      } else {
        rmUrl += `&ordering=-rating`;
      }
    }

    const shouldFetchMD = ['all', 'mangadex', 'mangalib', 'readmanga', 'mangaovh'].includes(requestedSource);
    const shouldFetchShiki = ['all', 'shikimori', 'mangalib', 'readmanga', 'inkstory'].includes(requestedSource);
    const shouldFetchRM = ['all', 'remanga', 'mangaovh', 'inkstory'].includes(requestedSource);

    try {
      const [mdRes, shikiRes, rmRes] = await Promise.allSettled([
        shouldFetchMD ? fetch(mdUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        shouldFetchShiki ? fetch(shikiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://shikimori.one/',
            'Accept': 'application/json'
          }
        }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        shouldFetchRM ? fetch(rmUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        }).then(r => r.ok ? r.json() : null) : Promise.resolve(null)
      ]);

      const hasCyrillic = (str: string) => /[а-яА-ЯёЁ]/.test(str);

      let mdResults: any[] = [];
      if (mdRes.status === 'fulfilled' && mdRes.value && mdRes.value.data) {
        mdResults = mdRes.value.data.map((manga: any) => {
          const id = manga.id;
          const attrs = manga.attributes || {};
          let title = attrs.title?.ru || 'Без названия';
          if (title === 'Без названия' && attrs.altTitles && Array.isArray(attrs.altTitles)) {
            const ruTitleObj = attrs.altTitles.find((t: any) => t.ru);
            if (ruTitleObj) title = ruTitleObj.ru;
          }
          if (title === 'Без названия' || !hasCyrillic(title)) return null;

          let description = attrs.description?.ru;
          if (!description) return null;

          const originalTitle = attrs.title?.['ja-ro'] || attrs.title?.ja || attrs.title?.en || '';
          let cover = '';
          const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
          if (coverRel && coverRel.attributes?.fileName) {
            const fileName = coverRel.attributes.fileName;
            cover = `/api/manga/page-proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${id}/${fileName}.512.jpg`)}&_cb=3`;
          } else {
            cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
          }
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
            genres: genres.slice(0, 3) || ["Манга"],
            chapters: attrs.lastChapter ? Number(attrs.lastChapter) : (attrs.lastVolume ? Number(attrs.lastVolume)*10 : 12)
          };
        }).filter(Boolean);
      }

      let rmResults: any[] = [];
      if (rmRes.status === 'fulfilled' && rmRes.value && rmRes.value.content) {
        rmResults = rmRes.value.content.map((m: any) => {
          let title = m.rus_name || 'Без названия';
          if (!hasCyrillic(title)) return null;
          if (!m.count_chapters || m.count_chapters === 0) return null;

          let rmCover = m.img?.high || m.img?.mid || m.cover_high || '';
          if (rmCover.startsWith('/')) rmCover = `https://remanga.org${rmCover}`;

          return {
            id: `remanga-${m.dir}`,
            title,
            originalTitle: m.en_name || '',
            rating: m.avg_rating ? parseFloat(m.avg_rating) : 8.0,
            status: m.issue_year ? `С ${m.issue_year}` : 'Статус неизвестен',
            description: 'Описание из ReManga.org',
            cover: rmCover ? `/api/manga/page-proxy?url=${encodeURIComponent(rmCover)}&_cb=3` : '',
            genres: m.categories ? m.categories.map((c: any) => c.name) : ["Манга"],
            chapters: m.count_chapters || 0
          };
        }).filter(Boolean);
      }

      const seenTitles = new Set();
      const interleaved: any[] = [];
      const pushIfUnique = (item: any) => {
        const canonical = item.title.toLowerCase().trim();
        if (!seenTitles.has(canonical)) {
          seenTitles.add(canonical);
          interleaved.push(item);
        }
      };

      const maxLength = Math.max(mdResults.length, rmResults.length);
      for (let i = 0; i < maxLength; i++) {
        if (i < rmResults.length) pushIfUnique(rmResults[i]);
        if (i < mdResults.length) pushIfUnique(mdResults[i]);
      }

      return new Response(JSON.stringify({ results: interleaved }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    } catch(err: any) {
      return new Response(JSON.stringify({ error: err.message, results: [] }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  // 1.5. SINGLE DETAILS: /api/manga/:id
  const singleMangaMatch = pathname.match(/^\/([a-zA-Z0-9\-_]{3,40})\/?$/);
  if (singleMangaMatch && !singleMangaMatch[1].endsWith('search') && !singleMangaMatch[1].endsWith('chapters') && !singleMangaMatch[1].endsWith('pages')) {
    const mangaId = singleMangaMatch[1];
    
    if (mangaId.startsWith('remanga-')) {
      const rawId = mangaId.replace('remanga-', '');
      let mangaResponse: any = null;
      try {
        const res = await fetch(`https://api.remanga.org/api/titles/${rawId}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data: any = await res.json();
        const content = data?.content;
        if (content) {
          const title = content.rus_name || 'Без названия';
          const originalTitle = content.en_name || content.dir || '';
          let coverUrl = content.img?.high ? `https://remanga.org${content.img.high}` : (content.img?.mid ? `https://remanga.org${content.img.mid}` : '');
          const cover = coverUrl ? `/api/manga/page-proxy?url=${encodeURIComponent(coverUrl)}&_cb=3` : 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80';
          const description = content.description || 'Описание отсутствует.';
          const genres = content.categories?.map((c: any) => c.name) || ["Манга"];
          const status = content.status?.name || 'Статус неизвестен';
          
          mangaResponse = {
            id: mangaId,
            title,
            originalTitle,
            rating: content.avg_rating ? parseFloat(content.avg_rating) : 8.0,
            status,
            description,
            cover,
            genres: genres.slice(0, 3)
          };
        }
      } catch (err: any) {}

      if (!mangaResponse) {
        try {
          const mdSearchUrl = `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(rawId.replace(/-/g, ' '))}&availableTranslatedLanguage[]=ru&includes[]=cover_art`;
          const mdRes = await fetch(mdSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const mdData: any = await mdRes.json();
          if (mdData && mdData.data && mdData.data.length > 0) {
             const m = mdData.data[0];
             const attrs = m.attributes;
             const title = attrs.title?.ru || attrs.title?.en || attrs.title?.['ja-ro'] || 'Без названия';
             const originalTitle = attrs.title?.['ja-ro'] || '';
             let cover = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80';
             const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art');
             if (coverRel && coverRel.attributes?.fileName) {
               cover = `/api/manga/page-proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.512.jpg`)}&_cb=3`;
             }
             mangaResponse = {
               id: mangaId,
               title,
               originalTitle,
               rating: 8.0,
               status: attrs.status || 'Статус неизвестен',
               description: attrs.description?.ru || attrs.description?.en || 'Описание отсутствует.',
               cover,
               genres: attrs.tags?.filter((t: any) => t.attributes?.group === 'genre').map((t: any) => t.attributes?.name?.ru || t.attributes?.name?.en).filter(Boolean).slice(0, 3) || ["Манга"]
             };
          }
        } catch(e) {}
      }

      if (mangaResponse) {
        return new Response(JSON.stringify({ manga: mangaResponse }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } else {
        return new Response(JSON.stringify({ error: 'Manga not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    if (mangaId.startsWith('shiki-')) {
      const rawId = mangaId.replace('shiki-', '');
      const shikiUrl = `https://shikimori.one/api/mangas/${rawId}`;
      try {
        const res = await fetch(shikiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://shikimori.one/',
            'Accept': 'application/json'
          }
        });
        const m: any = await res.json();
        if (!m || m.error) {
          return new Response(JSON.stringify({ error: 'Manga not found on Shikimori' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        const title = m.russian || m.name || 'Без названия';
        const originalTitle = m.name || '';
        let cover = '';
        if (m.image?.original) {
          const cleanPath = m.image.original.replace(/^\//, '');
          cover = `/api/image/${cleanPath}`;
        } else {
          cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
        }
        const description = m.description || 'Описание отсутствует.';
        const genres = m.genres?.map((g: any) => g.russian || g.name) || ["Манга"];
        return new Response(JSON.stringify({
          manga: {
            id: mangaId,
            title,
            originalTitle,
            rating: m.score ? parseFloat(m.score) : Number((8.1 + Math.random() * 1.6).toFixed(1)),
            status: m.status === 'released' ? 'Завершен' : (m.status === 'ongoing' ? 'Онгоинг' : 'Анонсирован'),
            description,
            cover,
            genres: genres.slice(0, 3)
          }
        }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    // Default MangaDex details fetch
    const dexUrl = `https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`;
    try {
      const res = await fetch(dexUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });
      const data: any = await res.json();
      if (!data || !data.data) {
        return new Response(JSON.stringify({ error: 'Manga not found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const manga = data.data;
      const attrs = manga.attributes || {};
      let title = attrs.title?.ru || 'Без названия';
      if (title === 'Без названия' && attrs.altTitles && Array.isArray(attrs.altTitles)) {
        const ruTitleObj = attrs.altTitles.find((t: any) => t.ru);
        if (ruTitleObj) title = ruTitleObj.ru;
      }
      if (title === 'Без названия') {
         title = attrs.title?.en || attrs.title?.['ja-ro'] || attrs.title?.ja || 'Без названия';
      }
      const originalTitle = attrs.title?.['ja-ro'] || attrs.title?.ja || attrs.title?.en || '';
      let cover = '';
      const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art');
      if (coverRel && coverRel.attributes?.fileName) {
        const fileName = coverRel.attributes.fileName;
        cover = `/api/manga/page-proxy?url=${encodeURIComponent(`https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`)}&_cb=3`;
      } else {
        cover = `https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80`;
      }
      let description = attrs.description?.ru || 'Описание отсутствует.';
      description = description.replace(/\[\w+=\w+\]/g, '').replace(/\[\/\w+\]/g, '').replace(/\[hr\]/g, '');
      const genres = attrs.tags
        ?.filter((t: any) => t.attributes?.group === 'genre')
        ?.map((t: any) => t.attributes?.name?.ru || t.attributes?.name?.en)
        ?.filter(Boolean) || [];

      return new Response(JSON.stringify({
        manga: {
          id: mangaId,
          title,
          originalTitle,
          rating: Number((8.1 + Math.random() * 1.6).toFixed(1)),
          status: attrs.status === 'ongoing' ? 'Онгоинг' : (attrs.status === 'completed' ? 'Завершен' : 'Приостановлен'),
          description,
          cover,
          genres: genres.slice(0, 3)
        }
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // 3. CHAPTERS LIST: /api/manga/:id/chapters
  const chaptersMatch = pathname.match(/^\/([a-zA-Z0-9\-_]+)\/chapters\/?$/);
  if (chaptersMatch) {
    let mangaId = chaptersMatch[1];
    let searchTitles: string[] = [];
    let explicitRemangaDir = '';

    if (mangaId.startsWith('remanga-')) {
      explicitRemangaDir = mangaId.replace('remanga-', '');
      try {
        const rmRes = await fetch(`https://api.remanga.org/api/titles/${explicitRemangaDir}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const rmData: any = await rmRes.json();
        if (rmData && rmData.content) {
          if (rmData.content.rus_name) searchTitles.push(rmData.content.rus_name);
          if (rmData.content.en_name) searchTitles.push(rmData.content.en_name);
        }
      } catch(e) {}
      
      if (searchTitles.length === 0 && explicitRemangaDir) {
        searchTitles.push(explicitRemangaDir.replace(/-/g, ' '));
      }

      let matchedId = '';
      for (const title of searchTitles) {
        if (!title) continue;
        try {
          const mdSearchUrl = `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(title)}&availableTranslatedLanguage[]=ru`;
          const mdRes = await fetch(mdSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const mdData: any = mdRes.ok ? await mdRes.json() : null;
          if (mdData && mdData.data && mdData.data.length > 0) {
            matchedId = mdData.data[0].id;
            break;
          }
        } catch (err) {}
      }
      if (matchedId) {
        mangaId = matchedId;
      }
    } else if (mangaId.startsWith('shiki-')) {
      const rawId = mangaId.replace('shiki-', '');
      try {
        const shikiRes = await fetch(`https://shikimori.one/api/mangas/${rawId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://shikimori.one/'
          }
        });
        const m: any = await shikiRes.json();
        if (m && !m.error) {
          if (m.russian) searchTitles.push(m.russian);
          if (m.name) searchTitles.push(m.name);
          if (m.japanese && m.japanese[0]) searchTitles.push(m.japanese[0]);
          if (m.japanese && Array.isArray(m.japanese)) {
            m.japanese.forEach((jpName: string) => searchTitles.push(jpName));
          }
        }
      } catch (e) {}

      let matchedId = '';
      for (const title of searchTitles) {
        if (!title) continue;
        const mdSearchUrl = `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(title)}&availableTranslatedLanguage[]=ru`;
        try {
          const mdRes = await fetch(mdSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const mdData: any = mdRes.ok ? await mdRes.json() : null;
          if (mdData && mdData.data && mdData.data.length > 0) {
            matchedId = mdData.data[0].id;
            break;
          }
        } catch (err) {}
      }

      if (matchedId) {
        mangaId = matchedId;
      }
    } else {
      // MangaDex native ID
      try {
        const mdRes = await fetch(`https://api.mangadex.org/manga/${mangaId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const mdData: any = await mdRes.json();
        if (mdData && mdData.data) {
          const attrs = mdData.data.attributes || {};
          if (attrs.title?.en) searchTitles.push(attrs.title.en);
          if (attrs.title?.ja) searchTitles.push(attrs.title.ja);
          if (attrs.title?.['ja-ro']) searchTitles.push(attrs.title['ja-ro']);
          if (attrs.altTitles && Array.isArray(attrs.altTitles)) {
            attrs.altTitles.forEach((t: any) => {
              if (t.ru) searchTitles.push(t.ru);
              if (t.en) searchTitles.push(t.en);
            });
          }
        }
      } catch(e) {}
    }

    // Try ZazaZa Global suggestion search
    let zazaPath = '';
    for (const title of searchTitles) {
      if (!title) continue;
      try {
        const suggRes = await fetch('https://a.zazaza.me/search/suggestion?query=' + encodeURIComponent(title));
        const suggData: any = await suggRes.json();
        const suggestion = suggData?.suggestions?.find((s: any) => s.link && (s.link.startsWith('/') || s.link.startsWith('http')));
        if (suggestion) {
          zazaPath = suggestion.link;
          break;
        }
      } catch(e) {}
    }

    if (zazaPath) {
      try {
        const fullUrl = zazaPath.startsWith('http') ? zazaPath + '?mtr=1' : 'https://a.zazaza.me' + zazaPath + '?mtr=1';
        const htmlRes = await fetch(fullUrl, {
           headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await htmlRes.text();
        const chapters: any[] = [];
        const regex = /href="(\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        const seen = new Set();
        while ((match = regex.exec(html)) !== null) {
            if (match[2].includes('Читать')) continue;
            if (!match[1].includes('/vol')) continue;
            let path = match[1];
            if (path.includes('?')) path = path.split('?')[0];
            if (path.includes('#')) path = path.split('#')[0];
            
            if (seen.has(path)) continue;
            seen.add(path);

            let chTitle = match[2].trim().replace(/<[^>]+>/g, '').trim();
            const targetUrl = zazaPath.startsWith('http') ? (new URL(zazaPath).origin + path) : path;
            chapters.push({
               id: `zaza-${toBase64(targetUrl)}`,
               title: chTitle || 'Глава',
               volume: path.match(/vol(\d+)/)?.[1] || '1',
               chapter: path.match(/vol\d+\/([\d.,]+)/)?.[1] || '0',
               group: 'ReadManga',
               publishAt: new Date().toISOString()
            });
        }
        
        chapters.reverse();

        if (chapters.length > 0) {
          return new Response(JSON.stringify({
            mangaId,
            chapters,
            total: chapters.length,
            isLicensed: false,
            source: 'ReadManga (ZazaZa)'
          }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      } catch (e) {
        console.error('ZazaZa chapters edge fetch failed', e);
      }
    }

    let mdChapters: any[] = [];
    let remangaChapters: any[] = [];

    const fetchMD = async () => {
      if (mangaId && !mangaId.startsWith('shiki-') && !mangaId.startsWith('remanga-')) {
        const getChapters = async (lang: string) => {
          const feedUrl = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=${lang}&order[chapter]=asc&limit=500&includes[]=scanlation_group`;
          try {
            const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data: any = await res.json();
            if (data && data.data && data.data.length > 0) {
              return data.data.map((ch: any) => {
                const attrs = ch.attributes || {};
                const sg = ch.relationships?.find((r: any) => r.type === 'scanlation_group');
                const groupName = sg?.attributes?.name || 'Внешний переводчик';
                return {
                  id: ch.id,
                  chapter: attrs.chapter || '0',
                  volume: attrs.volume || '',
                  title: attrs.title || `Глава ${attrs.chapter || ''}`,
                  group: `MangaDex: ${groupName} (${lang})`,
                  publishAt: attrs.publishAt
                };
              });
            }
          } catch(e) {}
          return [];
        };

        let chaps = await getChapters('ru');
        if (chaps.length === 0) chaps = await getChapters('en');
        return chaps;
      }
      return [];
    };

    const fetchRM = async () => {
      if (explicitRemangaDir) {
        try {
          const detailRes = await fetch(`https://api.remanga.org/api/titles/${explicitRemangaDir}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const detailData: any = await detailRes.json();
          const branches = detailData?.content?.branches;
          if (!branches || !branches.length) return [];
          let rChapters: any[] = [];
          await Promise.allSettled(branches.map(async (branch: any) => {
            const chRes = await fetch(`https://api.remanga.org/api/titles/chapters/?branch_id=${branch.id}&limit=250&page=1`, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const chData: any = await chRes.json();
            if (Array.isArray(chData?.content)) {
              chData.content.forEach((ch: any) => {
                const grName = Array.isArray(branch.names) ? branch.names.join(', ') : (branch.names || 'Переводчики ReManga');
                rChapters.push({
                  id: `remanga-${ch.id}`,
                  chapter: (ch.chapter || '0').toString(),
                  volume: (ch.volume || '').toString(),
                  title: ch.name || `Глава ${ch.chapter || ''}`,
                  group: `ReManga: ${grName}`,
                  publishAt: ch.pub_date || new Date().toISOString()
                });
              });
            }
          }));
          return rChapters;
        } catch(e) {
          return [];
        }
      }
      if (searchTitles.length > 0) {
        return await fetchRemangaChaptersByTitle(searchTitles);
      }
      return [];
    };

    const chapResults = await Promise.allSettled([fetchMD(), fetchRM()]);
    
    if (chapResults[0].status === 'fulfilled') {
      mdChapters = chapResults[0].value || [];
    }
    if (chapResults[1].status === 'fulfilled') {
      remangaChapters = chapResults[1].value || [];
    }

    const allChapters = [...mdChapters, ...remangaChapters];

    if (allChapters.length === 0) {
      const fallbackChapters = Array.from({ length: 15 }).map((_, idx) => {
        const chNum = (idx + 1).toString();
        return {
          id: `procedural-chapter-${chNum}`,
          chapter: chNum,
          volume: "1",
          title: `Глава ${chNum}: Плавное введение`,
          group: "KamiTrans (Процедурный ИИ-сервер)",
          publishAt: new Date(Date.now() - idx * 86400000).toISOString()
        };
      });
      return new Response(JSON.stringify({ chapters: fallbackChapters, isLicensed: false }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    const chKeys = new Set();
    const filteredChapters = allChapters.filter((ch: any) => {
      const key = `${ch.chapter}-${ch.group}`;
      if (chKeys.has(key)) return false;
      chKeys.add(key);
      return true;
    });

    filteredChapters.sort((a: any, b: any) => {
      const numA = parseFloat(a.chapter) || 0;
      const numB = parseFloat(b.chapter) || 0;
      return numA - numB;
    });

    return new Response(JSON.stringify({ chapters: filteredChapters, isLicensed: false }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  // 2. PAGES FOR CHAPTER: /api/manga/chapter/:chapterId/pages
  const chapterPagesMatch = pathname.match(/^\/chapter\/(.+)\/pages\/?$/);
  if (chapterPagesMatch) {
    const chapterId = chapterPagesMatch[1];

    if (chapterId.startsWith('procedural-')) {
      const backgroundUrls = [
        "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1540200049848-d9813ea0e120?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1080&auto=format&fit=crop&q=85"
      ];
      const pages = backgroundUrls.map((url) => `/api/manga/page-proxy?url=${encodeURIComponent(url)}`);
      return new Response(JSON.stringify({ pages }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (chapterId.startsWith('zaza-')) {
      const rawPath = fromBase64(chapterId.replace('zaza-', ''));
      try {
        const fullPath = rawPath.startsWith('http') ? `${rawPath}?mtr=1` : `https://a.zazaza.me${rawPath}?mtr=1`;
        const pageRes = await fetch(fullPath, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const pageHtml = await pageRes.text();
        const pagesMatch = pageHtml.match(/rm_h\.readerInit\([^,]*,\s*(\[\[.*?\]\])/);
        if (pagesMatch) {
          const arrayText = pagesMatch[1];
          const parsedArray = new Function("return " + arrayText)();
          
          let isDeleted = false;
          const pages = parsedArray.map((item: any) => {
            const fullUrl = `${item[0] || ''}${item[2] || ''}`;
            if (fullUrl.includes('deleted1.png')) {
               isDeleted = true;
            }
            return `/api/manga/page-proxy?url=${encodeURIComponent(fullUrl)}&_zaza=1`;
          });
          
          if (isDeleted) {
            return new Response(JSON.stringify({ error: 'Издательская блокировка: Главы удалены правообладателем в РФ.', isLicensed: true, pages: [] }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          }

          return new Response(JSON.stringify({ pages }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } else {
          return new Response(JSON.stringify({ pages: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
      } catch(e) {
        return new Response(JSON.stringify({ pages: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    if (chapterId.startsWith('remanga-')) {
      const rawChId = chapterId.replace('remanga-', '');
      const rmUrl = `https://api.remanga.org/api/titles/chapters/${rawChId}/`;
      try {
        const res = await fetch(rmUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        const data: any = await res.json();
        const cObj = data && data.content;
        if (!cObj) {
          return new Response(JSON.stringify({ pages: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        const servers = cObj.servers || ['https://img.remanga.org'];
        const pageItems = cObj.pages || cObj.scans || [];
        const pages = pageItems.map((page: any) => {
          let link = "";
          if (typeof page === 'string') {
            link = page;
          } else if (page && typeof page === 'object') {
            if (Array.isArray(page)) {
              link = page[2] || "";
            } else {
              link = page.link || page.url || "";
            }
          }
          if (link && !link.startsWith('http')) {
            if (!link.startsWith('/')) {
              link = '/' + link;
            }
            const mainServer = servers[0] ? servers[0].replace(/\/$/, '') : 'https://img.remanga.org';
            link = `${mainServer}${link}`;
          }
          if (link) {
            return `/api/manga/page-proxy?url=${encodeURIComponent(link)}`;
          }
          return '';
        }).filter(Boolean);

        return new Response(JSON.stringify({ pages }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message, pages: [] }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    const dexUrl = `https://api.mangadex.org/at-home/server/${chapterId}`;
    try {
      const res = await fetch(dexUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const data: any = await res.json();
      if (!data || !data.chapter) {
        return new Response(JSON.stringify({ pages: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      const hash = data.chapter.hash;
      const baseUrl = data.baseUrl;
      const filenames = data.chapter.data;
      const pages = filenames.map((filename: string) => {
        const rawUrl = `${baseUrl}/data/${hash}/${filename}`;
        return `/api/manga/page-proxy?url=${encodeURIComponent(rawUrl)}&chapterId=${chapterId}`;
      });
      return new Response(JSON.stringify({ pages }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message, pages: [] }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // Route not found
  return new Response(JSON.stringify({ error: `Not found: ${pathname}` }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
};
