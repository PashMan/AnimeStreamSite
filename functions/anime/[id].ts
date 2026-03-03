
export const onRequest = async (context) => {
  const { id } = context.params;
  
  if (!id || Array.isArray(id)) {
    return context.next();
  }

  const animeId = (id as string).split('-')[0];
  
  try {
    // Fetch anime data
    const res = await fetch(`https://shikimori.one/api/animes/${animeId}`, {
      headers: { 'User-Agent': 'AnimeStream/1.0' }
    });
    
    if (!res.ok) {
      return context.next();
    }

    const anime = await res.json() as any;
    
    // Fetch the original index.html (SPA fallback)
    // We fetch the root "/" to get index.html content
    const url = new URL(context.request.url);
    url.pathname = '/index.html';
    
    let originalResponse: Response;
    // @ts-ignore
    if (context.env.ASSETS) {
       // @ts-ignore
       originalResponse = await context.env.ASSETS.fetch(url);
    } else {
       originalResponse = await fetch(url);
    }
    
    let html = await originalResponse.text();

    const title = `Смотреть ${anime.russian || anime.name} онлайн бесплатно`;
    const description = anime.description ? anime.description.slice(0, 160).replace(/"/g, '&quot;') : `Смотреть аниме ${anime.russian || anime.name} в хорошем качестве.`;
    const image = anime.image?.original ? `https://shikimori.one${anime.image.original}` : '';

    // Replace <title>
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    
    // Replace or Add Meta Description
    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${description}"`);
    } else {
      html = html.replace('</head>', `<meta name="description" content="${description}">\n</head>`);
    }

    // Add OG Tags
    const ogTags = `
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:image" content="${image}" />
      <meta property="og:type" content="video.movie" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${description}" />
      <meta name="twitter:image" content="${image}" />
    `;
    
    html = html.replace('</head>', `${ogTags}\n</head>`);

    // Inject content into body for bots (hidden or replaced by React)
    const botContent = `
      <div style="display:none">
        <h1>${anime.russian || anime.name}</h1>
        <p>${anime.description}</p>
        <img src="${image}" alt="${anime.russian || anime.name}" />
      </div>
    `;
    // Try to inject into root div if it exists
    if (html.includes('<div id="root"></div>')) {
        html = html.replace('<div id="root"></div>', `<div id="root">${botContent}</div>`);
    } else if (html.includes('<div id="root">')) {
        // If root div is not empty or formatted differently
        html = html.replace('<div id="root">', `<div id="root">${botContent}`);
    }

    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (e) {
    console.error('Failed to fetch anime data', e);
    return context.next();
  }
};
