export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);
  const title = url.searchParams.get('title');
  const year = url.searchParams.get('year');
  const shikimori_id = url.searchParams.get('shikimori_id');

  // Helper to normalize strings for comparison
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]/g, '');
  const targetTitle = title ? normalize(title) : '';

  if (!title && !shikimori_id) {
    return new Response(JSON.stringify({ error: 'Title or Shikimori ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const players: any[] = [
    { name: 'Kodik', iframe: null },
    { name: 'Anilibria', iframe: null }
  ];
  
  let kinopoisk_id: string | null = null;
  let imdb_id: string | null = null;
  let world_art_id: string | null = null;

  // Helper to validate result title
  const isValidResult = (resultTitle: string) => {
    if (!targetTitle) return true;
    const normalizedResult = normalize(resultTitle);
    return normalizedResult.includes(targetTitle) || targetTitle.includes(normalizedResult);
  };

  const ids = {
    shikimori_id,
    kinopoisk_id: null as string | null,
    imdb_id: null as string | null,
    world_art_id: null as string | null,
    anilibria_id: null as number | null
  };

  // 1. Kodik
  try {
    const kodikUrl = `https://kodik-api.com/search?token=17cc4ee691bc251131a9041e6e89e78e&${shikimori_id ? `shikimori_id=${shikimori_id}` : `title=${encodeURIComponent(String(title))}`}&with_material_data=true`;
    const kodikRes = await fetch(kodikUrl);
    const kodikData = await kodikRes.json();
    if (kodikData.results && kodikData.results.length > 0) {
      const resultWithIds = kodikData.results.find((r: any) => r.kinopoisk_id || r.imdb_id || r.worldart_id);
      if (resultWithIds) {
        kinopoisk_id = resultWithIds.kinopoisk_id || null;
        imdb_id = resultWithIds.imdb_id || null;
        world_art_id = resultWithIds.worldart_id || null;
        ids.kinopoisk_id = kinopoisk_id;
        ids.imdb_id = imdb_id;
        ids.world_art_id = world_art_id;
      }

      const res = kodikData.results[0];
      const kodikPlayer = players.find(p => p.name === 'Kodik');
      if (kodikPlayer) {
        kodikPlayer.iframe = res.link.startsWith('//') ? `https:${res.link}` : res.link;
      }
    }
  } catch (e) {}

  // 2. Collaps removed


  // 3. Anilibria
  try {
    const anilibriaRes = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(String(title))}`);
    if (anilibriaRes.ok) {
      const anilibriaData = await anilibriaRes.json();
      if (anilibriaData && anilibriaData.length > 0) {
        let bestMatch = anilibriaData[0];
        if (year) {
          const yearMatch = anilibriaData.find((r: any) => r.year === parseInt(String(year)));
          if (yearMatch) bestMatch = yearMatch;
        }
        const anilibriaPlayer = players.find(p => p.name === 'Anilibria');
        if (anilibriaPlayer) {
          anilibriaPlayer.iframe = `https://www.anilibria.tv/public/iframe.php?id=${bestMatch.id}`;
          ids.anilibria_id = bestMatch.id;
        }
      }
    }
  } catch (e) {}

  return new Response(JSON.stringify({ players, ids }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=300' // Cache for 5 minutes
    }
  });
}
