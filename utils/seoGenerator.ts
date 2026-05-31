/**
 * Utility for generating highly optimized long-tail SEO metadata
 * and page text templates to capture low-frequency search traffic (НЧ-запросы).
 */

interface SEOData {
  title: string;
  description: string;
  keywords: string;
  h1Text: string;
  promoText: string;
}

/**
 * Extracts the season number from an anime title.
 * E.g., "Клинок рассекающий демонов 3 сезон" -> 3
 */
export function extractSeasonNumber(title: string): number {
  if (!title) return 1;

  // Search for direct Russian representations "X сезон", "сезон X"
  const ruSeasonMatch = title.match(/(\d+)\s*(?:сезон|season)/i);
  if (ruSeasonMatch) return parseInt(ruSeasonMatch[1], 10);

  // Roman numerals
  if (/\bX\b/i.test(title)) return 10;
  if (/\bIX\b/i.test(title)) return 9;
  if (/\bVIII\b/i.test(title)) return 8;
  if (/\bVII\b/i.test(title)) return 7;
  if (/\bVI\b/i.test(title)) return 6;
  if (/\bV\b/i.test(title)) return 5;
  if (/\bIV\b/i.test(title)) return 4;
  if (/\bIII\b/i.test(title)) return 3;
  if (/\bII\b/i.test(title)) return 2;

  // Search for trailing lone digits which usually signify seasons, e.g. "Магическая битва 2"
  const endNumMatch = title.match(/\b([2-9])\b\s*$/);
  if (endNumMatch) return parseInt(endNumMatch[1], 10);

  return 1;
}

/**
 * Strips existing season mentions from the base title to prevent duplication
 * (e.g. "Клинок рассекающий демонов 3 сезон" -> "Клинок рассекающий демонов")
 */
export function getBaseAnimeTitle(title: string): string {
  if (!title) return "";
  let base = title;
  
  // Remove "N сезон", "сезон N"
  base = base.replace(/\d+\s*(?:сезон|season)/i, "");
  // Remove Roman numerals at the end
  base = base.replace(/\s+\b(?:X|IX|VIII|VII|VI|V|IV|III|II|I)\b\s*$/i, "");
  // Remove dangling numbers at the end
  base = base.replace(/\s+\b[2-9]\b\s*$/, "");
  
  return base.trim();
}

/**
 * Generates custom SEO tags, detailed template texts, and optimized keywords
 */
export function generateAnimeSEO(
  title: string,
  originalName: string = "",
  year: string | number = "",
  genres: string[] = [],
  description: string = "",
  paramEpisode?: string
): SEOData {
  const season = extractSeasonNumber(title);
  const baseTitle = getBaseAnimeTitle(title);
  const seasonSuffix = season > 1 ? `${season} сезон` : `1 сезон`;
  const formatYear = year ? ` (${year})` : "";

  // 1. Optimized Title Tag (Title)
  // Target: "Смотреть [Название аниме] [номер сезона] сезон в 4к качестве онлайн бесплатно"
  // Target: "В какой озвучке лучше смотреть [Название] без рекламы казино"
  let seoTitle = "";
  if (paramEpisode) {
    seoTitle = `Смотреть ${baseTitle} ${seasonSuffix} — ${paramEpisode} серия в 4К качестве онлайн бесплатно без всплывающей рекламы ставок`;
  } else {
    seoTitle = `Смотреть аниме ${baseTitle} ${seasonSuffix} в 4К качестве онлайн в Ultra HD бесплатно без рекламы казино`;
  }

  // 2. Optimized H1 Header
  const h1Text = paramEpisode
    ? `Смотреть аниме ${baseTitle} — ${seasonSuffix} ${paramEpisode} серия в 4К качестве`
    : `Смотреть аниме ${baseTitle} ${seasonSuffix} онлайн в Ultra HD 4K`;

  // 3. Dynamic SEO-Optimized Template description
  // Target low-frequency long tails: "без всплывающей рекламы ставок", "озвучки Анилибрия, DEEP", "в какой озвучке лучше смотреть"
  const cleanDesc = description 
    ? description.replace(/<[^>]*>/g, "").slice(0, 150)
    : `Увлекательное аниме в жанре ${genres.length > 0 ? genres.slice(0, 2).join(", ") : "приключения"}. Оцените потрясающий сюжет и любимых персонажей на KamiAnime.`;

  const seoDescription = paramEpisode
    ? `Смотреть ${paramEpisode}-ю серию аниме ${baseTitle} ${seasonSuffix} онлайн в Ultra HD 4K качестве абсолютно без всплывающей рекламы и ставок. В какой озвучке лучше смотреть? Доступны дубляж Анилибрия, DEEP, оригинальная дорожка с русскими субтитрами и другие топовые релизы.`
    : `Смотреть аниме ${baseTitle} ${seasonSuffix}${formatYear} все серии онлайн в оригинальном качестве Ultra HD 4K. Чистый звук, полное отсутствие всплывающей рекламы казино и ставок. Подробный разбор: узнайте, в какой озвучке лучше смотреть (${genres.slice(0, 3).join(", ")}) на KamiAnime!`;

  // 4. Promo Text block to render on the page for SEO crawlers (and users wishing to know where to watch)
  const promoText = `Смотреть аниме «${baseTitle}» в Ultra HD 4K качестве онлайн — это лучший способ погрузиться в захватывающий сюжет проекта${formatYear}. Мы позаботились о вашем комфорте: у нас вы можете наслаждаться любимым тайтлом полностью **без всплывающей рекламы ставок и казино**. Сомневаетесь, **в какой озвучке лучше смотреть**? Мы собрали все лучшие релиз-круппы на одной странице! Вас ждут озвучки **Анилибрия (Anilibria)**, **DEEP**, **JAM Club**, а также оригинальная японская аудиодорожка с качественными русскими субтитрами. Выбирайте любимый плеер, включайте 4К разрешение и наслаждайтесь плавным просмотром абсолютно бесплатно на KamiAnime!`;

  // 5. Long-tail Keywords setup for SEO bots
  const baseKeywords = [
    `смотреть ${baseTitle.toLowerCase()} в 4к качестве`,
    `аниме ${baseTitle.toLowerCase()} смотреть онлайн 4k`,
    `${baseTitle.toLowerCase()} ${seasonSuffix} в ультра ашд`,
    `${baseTitle.toLowerCase()} в какой озвучке лучше смотреть`,
    `смотреть ${baseTitle.toLowerCase()} бесплатно без рекламы казино`,
    `аниме ${baseTitle.toLowerCase()} без ставок`,
    `${baseTitle.toLowerCase()} анилибрия deep смотреть онлайн`,
    baseTitle.toLowerCase(),
    originalName.toLowerCase()
  ];

  if (paramEpisode) {
    baseKeywords.unshift(
      `смотреть ${baseTitle.toLowerCase()} ${seasonSuffix} ${paramEpisode} серия 4к`,
      `${baseTitle.toLowerCase()} ${paramEpisode} серия без рекламы`
    );
  }

  const seoKeywords = baseKeywords.join(", ");

  return {
    title: seoTitle,
    description: seoDescription,
    keywords: seoKeywords,
    h1Text,
    promoText
  };
}
