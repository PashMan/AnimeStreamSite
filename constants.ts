
import { Anime, Episode, ScheduleItem, User, NewsItem } from './types';

// Fix: Add missing email property to match the User interface requirement
export const CURRENT_USER: User = {
  name: "Hiroshi_K",
  email: "hiroshi@example.com",
  avatar: "https://picsum.photos/seed/user123/200",
  isPremium: true,
  episodesWatched: 142,
  watchedTime: "48ч 12м"
};

export const MOCK_ANIME: Anime[] = [
  {
    id: "1",
    title: "Поднятие уровня в одиночку",
    originalName: "Solo Leveling",
    image: "https://picsum.photos/seed/anime1/300/450",
    cover: "https://picsum.photos/seed/anime1cover/1920/800",
    rating: 9.8,
    year: 2024,
    type: "TV Series",
    genres: ["Экшен", "Фэнтези"],
    episodes: 12,
    status: "Ongoing",
    studio: "A-1 Pictures",
    description: "Десять лет назад появились «Врата», соединившие мир людей с измерением монстров. Обычные люди получили сверхспособности и стали «Охотниками». Сон Джин-Ву — слабейший охотник E-ранга, который пытается выжить в этом новом жестоком мире."
  },
  {
    id: "2",
    title: "Провожающая в последний путь Фрирен",
    originalName: "Sousou no Frieren",
    image: "https://picsum.photos/seed/anime2/300/450",
    cover: "https://picsum.photos/seed/anime2cover/1920/800",
    rating: 9.6,
    year: 2023,
    type: "TV Series",
    genres: ["Приключения", "Фэнтези", "Драма"],
    episodes: 28,
    status: "Ongoing",
    studio: "Madhouse",
    description: "Король демонов повержен, и отряд героев возвращается домой. Эльфийка-маг Фрирен, герой Химмель, священник Хайтер и воин Айзен вспоминают свое десятилетнее путешествие. Но для эльфа время течет иначе..."
  },
  {
    id: "3",
    title: "Магическая битва",
    originalName: "Jujutsu Kaisen",
    image: "https://picsum.photos/seed/anime3/300/450",
    cover: "https://picsum.photos/seed/anime3cover/1920/800",
    rating: 9.5,
    year: 2023,
    type: "TV Series",
    genres: ["Экшен", "Мистика"],
    episodes: 24,
    status: "Completed",
    studio: "MAPPA",
    description: "Юдзи Итадори — старшеклассник с выдающимися физическими данными, который вступает в клуб оккультизма. Вскоре он сталкивается с реальными проклятиями и становится сосудом для могущественного духа Сукуны."
  },
  {
    id: "4",
    title: "Человек-бензопила",
    originalName: "Chainsaw Man",
    image: "https://picsum.photos/seed/anime4/300/450",
    cover: "https://picsum.photos/seed/anime4cover/1920/800",
    rating: 8.9,
    year: 2022,
    type: "TV Series",
    genres: ["Экшен", "Ужасы"],
    episodes: 12,
    status: "Completed",
    studio: "MAPPA",
    description: "Дэнджи мечтает о простой жизни: вкусной еде и девушке рядом. Но долги отца заставляют его работать охотником на демонов вместе со своим питомцем-демоном Почитой. Предательство меняет всё..."
  },
  {
    id: "5",
    title: "Атака титанов: Финал",
    originalName: "Shingeki no Kyojin: The Final Season",
    image: "https://picsum.photos/seed/anime5/300/450",
    cover: "https://picsum.photos/seed/anime5cover/1920/800",
    rating: 9.9,
    year: 2023,
    type: "TV Series",
    genres: ["Экшен", "Драма", "Военное"],
    episodes: 30,
    status: "Completed",
    studio: "MAPPA",
    description: "Война за Парадиз достигает кульминации. Эрен Йегер запускает Гул Земли, чтобы уничтожить врагов острова, в то время как его бывшие товарищи пытаются остановить апокалипсис."
  },
  {
    id: "6",
    title: "Семья шпиона",
    originalName: "Spy x Family",
    image: "https://picsum.photos/seed/anime6/300/450",
    cover: "https://picsum.photos/seed/anime6cover/1920/800",
    rating: 8.8,
    year: 2022,
    type: "TV Series",
    genres: ["Комедия", "Экшен"],
    episodes: 25,
    status: "Completed",
    studio: "Wit Studio",
    description: "Шпион под кодовым именем «Сумрак» должен создать фиктивную семью для выполнения миссии. Он не знает, что его жена — наемная убийца, а приемная дочь — телепат."
  }
];

export const MOCK_EPISODES: Episode[] = Array.from({ length: 12 }, (_, i) => ({
  id: `ep-${i + 1}`,
  number: i + 1,
  title: `Эпизод ${i + 1}: Начало конца`,
  duration: "24:00",
  thumbnail: `https://picsum.photos/seed/ep${i}/300/170`,
  isFiller: i === 7 // Arbitrary filler
}));

export const SCHEDULE: ScheduleItem[] = [
  { day: "Пн", animes: [{ id: "1", time: "20:30", title: "Поднятие уровня" }, { id: "2", time: "22:00", title: "Волейбол!!" }] },
  { day: "Вт", animes: [{ id: "4", time: "18:00", title: "Человек-бензопила" }] },
  { day: "Ср", animes: [{ id: "3", time: "19:30", title: "Магическая битва" }, { id: "6", time: "21:00", title: "Семья шпиона" }] },
  { day: "Чт", animes: [{ id: "2", time: "20:00", title: "Фрирен" }] },
  { day: "Пт", animes: [{ id: "5", time: "23:00", title: "Атака титанов" }] },
  { day: "Сб", animes: [{ id: "1", time: "10:00", title: "Ван-Пис" }] },
  { day: "Вс", animes: [{ id: "6", time: "12:00", title: "Истребитель демонов" }] },
];

export const MOCK_NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "Анонсирован 3 сезон «Магической битвы»",
    summary: "Студия MAPPA официально подтвердила работу над продолжением. Арка «Culling Game» будет экранизирована.",
    date: "12 Окт 2024",
    category: "Анонсы"
  },
  {
    id: "n2",
    title: "Фильм «Человек-бензопила» выйдет в 2025 году",
    summary: "Полнометражная арка про Резе выйдет на большие экраны. Тизер-трейлер уже доступен.",
    date: "10 Окт 2024",
    category: "Фильмы"
  },
  {
    id: "n3",
    title: "Топ-10 лучших опенингов сезона",
    summary: "Мы собрали подборку самых запоминающихся музыкальных тем этой осени.",
    date: "08 Окт 2024",
    category: "Подборки"
  },
  {
    id: "n4",
    title: "Интервью с создателем «One Piece»",
    summary: "Эйитиро Ода рассказал о финальной саге и о том, что ждет Луффи в конце пути.",
    date: "05 Окт 2024",
    category: "Интервью"
  }
];