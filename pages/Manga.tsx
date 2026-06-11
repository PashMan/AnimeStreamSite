import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Star, Sparkles, ArrowLeft, ChevronRight, ChevronLeft, Heart, Eye, Share2, Crown, LayoutGrid, CheckCircle } from 'lucide-react';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';

interface MangaItem {
  id: string;
  title: string;
  originalTitle: string;
  rating: number;
  chapters: number;
  genres: string[];
  status: string;
  description: string;
  cover: string;
  isPremium?: boolean;
  pages: string[];
}

const MANGA_LIST: MangaItem[] = [
  {
    id: '1',
    title: 'Человек-бензопила',
    originalTitle: 'Chainsaw Man',
    rating: 9.3,
    chapters: 154,
    genres: ['Экшен', 'Сверхъестественное', 'Драма'],
    status: 'Онгоинг',
    description: 'Дэндзи — обычный парень, который живёт в крайней бедности и работает охотником на демонов, чтобы расплатиться с огромными долгами своего покойного отца. Вместе со своим верным демоническим псом Почитой они сражаются ради выживания. Но после предательства и гибели Почита соединяется с его сердцем, превращая Дэндзи в Человека-бензопилу.',
    cover: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    isPremium: false,
    pages: [
      'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1614036417651-efe5912149d8?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: '2',
    title: 'Магическая битва',
    originalTitle: 'Jujutsu Kaisen',
    rating: 9.4,
    chapters: 250,
    genres: ['Сёнэн', 'Боевые искусства', 'Фэнтези'],
    status: 'Завершен',
    description: 'Юдзи Итадори — старшеклассник с выдающимися физическими способностями, который проводит дни в клубе оккультных исследований. Однажды его друзья случайно вскрывают запечатанный проклятый объект высшего ранга — палец могущественного двуликого демона Сукуны. Чтобы спасти друзей от напавших проклятий, Юдзи поглощает палец и становится сосудом демона.',
    cover: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    isPremium: true,
    pages: [
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: '3',
    title: 'Поднятие уровня в одиночку',
    originalTitle: 'Solo Leveling',
    rating: 9.7,
    chapters: 200,
    genres: ['Экшен', 'РПГ', 'Приключения'],
    status: 'Завершен',
    description: 'В мире, где открылись таинственные Врата, соединяющие реальность с обителью монстров, появились люди с особыми силами — Охотники. Сон Джин-у — самый слабый Охотник человечества ранга Е, который рискует жизнью даже в нижайших подземельях. Но после смертельного инцидента в скрытом двойном подземелье перед ним всплывает уникальная игровая "Система", дарующая редкую способность повышать уровень.',
    cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    isPremium: false,
    pages: [
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: '4',
    title: 'Атака титанов',
    originalTitle: 'Shingeki no Kyojin',
    rating: 9.6,
    chapters: 139,
    genres: ['Экшен', 'Военное', 'Драма'],
    status: 'Завершен',
    description: 'Более века человечество изнывало под гнетом колоссальных людоедов под названием Титаны. Горстка выживших людей укрылась за тремя пятидесятиметровыми стенами — Мария, Роза и Сина. Но сто лет мирного существования рушатся, когда сверхтяжёлый бронированный Титан пробивают внешнюю стену, унося жизни близких Эрена Йегера.',
    cover: 'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=600&auto=format&fit=crop&q=80',
    isPremium: true,
    pages: [
      'https://images.unsplash.com/photo-1579783928121-7a13d66a2e6a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    id: '5',
    title: 'Клинок, рассекающий демонов',
    originalTitle: 'Kimetsu no Yaiba',
    rating: 9.5,
    chapters: 205,
    genres: ['Исторический', 'Сёнэн', 'Фэнтези'],
    status: 'Завершен',
    description: 'Эпоха Тайсё. Тандзиро Камадо — скромный торговец углём, содержащий большую семью после смерти отца. Но в один из дней возвращение домой оборачивается немыслимым ужасом: его мать, братья и сёстры беспощадно растерзаны кровожадными демонами, а единственная выжившая сестра Нэдзуко сама превратилась в демона.',
    cover: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    isPremium: false,
    pages: [
      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80'
    ]
  }
];

const Manga: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [mangaReaderPage, setMangaReaderPage] = useState<number>(0);
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleStartReading = (manga: MangaItem, chapterNum: number) => {
    if (manga.isPremium && !user?.isPremium) {
      alert('Чтение глав этой премиум-манги временно доступно только подписчикам Premium! Пожалуйста, оформите подписку для продолжения.');
      return;
    }
    setSelectedManga(manga);
    setActiveChapter(chapterNum);
    setMangaReaderPage(0);
  };

  return (
    <div className="bg-[#141519] min-h-screen text-slate-100 pb-24 font-sans select-none">
      <SEO 
        title="Читать Мангу Онлайн Полноэкранно - Crunchyroll"
        description="Эксклюзивная подборка манги на русском языке. Читайте популярные комиксы без рекламы и в премиум-интерфейсе."
      />

      {/* Crunchyroll Premium Manga Banner */}
      <div className="bg-gradient-to-r from-[#F47521]/20 via-[#141519]/90 to-[#141519] border-b border-[#F47521]/10 py-10 px-4 sm:px-8 lg:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-[#F47521] text-xs font-black uppercase tracking-wider rounded-md text-white flex items-center gap-1.5 w-fit">
              <BookOpen className="w-3.5 h-3.5" /> Читальня Crunchyroll
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
              Лицензионная Манга
            </h1>
            <p className="text-slate-400 font-medium text-sm md:text-base max-w-2xl">
              Официальный сервис лицензионных цифровых томов. Наслаждайтесь потрясающим кадрированием и переводом одновременно с выходом релизов в Японии.
            </p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/premium'}
            className="flex items-center gap-2.5 px-6 py-4 bg-gradient-to-r from-[#F47521] to-[#ff8e3c] rounded-xl text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#F47521]/20 self-start md:self-auto"
          >
            <Crown className="w-4 h-4 fill-current" /> Попробовать Premium
          </motion.button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 mt-12">
        <h2 className="text-xl font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2.5">
          <span className="w-1.5 h-6 bg-[#F47521] rounded-full inline-block animate-pulse" /> Наша коллекция манги
        </h2>

        {/* Manga bento shelf */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {MANGA_LIST.map((manga) => {
            const isFaved = favorites.includes(manga.id);
            return (
              <div 
                key={manga.id}
                onClick={() => setSelectedManga(manga)}
                className="group cursor-pointer bg-[#23252b] border border-white/5 rounded-2xl overflow-hidden hover:border-[#F47521]/50 hover:shadow-2xl hover:shadow-[#F47521]/10 flex flex-col justify-between transition-all duration-300"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden">
                  <img 
                    src={manga.cover} 
                    alt={manga.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/45 opacity-70 group-hover:opacity-90 transition-opacity" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {manga.isPremium && (
                      <span className="p-1 px-2.5 bg-[#F47521] text-black font-black rounded-lg text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-[#F47521]/30">
                        <Crown className="w-3 h-3 fill-current" /> Premium
                      </span>
                    )}
                    <span className="p-1 px-2.5 bg-black/50 backdrop-blur-md rounded-lg text-[9px] text-slate-300 font-extrabold uppercase tracking-wider">
                      {manga.status}
                    </span>
                  </div>

                  <button 
                    onClick={(e) => toggleFavorite(manga.id, e)}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-[#F47521] text-white hover:text-black transition-all shadow-md active:scale-90"
                  >
                    <Heart className={`w-4 h-4 ${isFaved ? 'fill-current text-[#F47521] hover:text-black' : ''}`} />
                  </button>

                  {/* Hover stats overlay */}
                  <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
                    <span className="text-xs font-black text-white bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/5 flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" /> {manga.rating}
                    </span>
                    <span className="text-xs font-black text-slate-200 bg-[#F47521]/90 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
                      {manga.chapters} гл.
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2 flex-grow flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-[#F47521] uppercase text-[10px] tracking-widest truncate">
                      {manga.originalTitle}
                    </h3>
                    <h4 className="font-black text-lg text-white group-hover:text-[#F47521] transition-colors leading-snug line-clamp-1">
                      {manga.title}
                    </h4>
                    <p className="text-slate-400 text-xs font-medium leading-relaxed line-clamp-2">
                      {manga.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {manga.genres.map(genre => (
                      <span key={genre} className="px-2 py-0.5 bg-white/5 rounded-md text-[9px] font-extrabold uppercase text-slate-400">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manga Detail overlay */}
      <AnimatePresence>
        {selectedManga && activeChapter === null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1c1d21] border border-white/5 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setSelectedManga(null)}
                className="absolute top-6 right-6 p-3 bg-[#23252b] hover:bg-[#F47521] hover:text-black rounded-2xl text-white transition-all active:scale-95 z-50 shadow-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-6 sm:p-10">
                {/* Visual Cover bar col */}
                <div className="col-span-1 md:col-span-4 space-y-4">
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl relative border border-white/5">
                    <img src={selectedManga.cover} alt={selectedManga.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-[#23252b] p-4 rounded-xl flex items-center justify-around border border-white/5">
                    <div className="text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-extrabold">Рекорд</div>
                      <div className="text-lg font-black text-white flex items-center gap-1.5 justify-center">
                        <Star className="w-4.5 h-4.5 text-yellow-400 fill-current" /> {selectedManga.rating}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="text-center">
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-extrabold">Главы</div>
                      <div className="text-lg font-black text-[#F47521]">{selectedManga.chapters}</div>
                    </div>
                  </div>
                </div>

                {/* Info and chapters panel */}
                <div className="col-span-1 md:col-span-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-[#F47521]/15 text-[#F47521] text-[10px] font-black uppercase tracking-wider rounded-lg border border-[#F47521]/30">
                        МАНГА
                      </span>
                      {selectedManga.isPremium && (
                        <span className="px-3 py-1 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg shadow-yellow-500/25 flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 fill-current" /> Premium
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
                        {selectedManga.title}
                      </h2>
                      <h3 className="text-lg font-bold text-slate-400">
                        {selectedManga.originalTitle}
                      </h3>
                    </div>
                    <p className="text-slate-300 text-sm md:text-base leading-relaxed font-medium">
                      {selectedManga.description}
                    </p>
                  </div>

                  {/* Chapters List */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#F47521]">Доступные Главы</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const chapterNum = index + 1;
                        return (
                          <button
                            key={chapterNum}
                            onClick={() => handleStartReading(selectedManga, chapterNum)}
                            className="p-4 bg-[#23252b] border border-white/5 rounded-2xl hover:border-[#F47521] hover:bg-[#F47521]/10 text-left transition-all active:scale-95 group/chapter flex items-center justify-between"
                          >
                            <div>
                              <div className="text-[9px] font-extrabold uppercase text-slate-500 group-hover/chapter:text-[#F47521]">Том 1</div>
                              <div className="text-sm font-black text-white">Глава {chapterNum}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover/chapter:text-[#F47521] transition-transform group-hover/chapter:translate-x-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Manga Page reader */}
      <AnimatePresence>
        {selectedManga && activeChapter !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0c0d10] z-[120] flex flex-col justify-between"
          >
            {/* Top Toolbar */}
            <div className="bg-[#141519] px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setActiveChapter(null); setMangaReaderPage(0); }}
                  className="p-2 bg-[#23252b] text-white hover:text-[#F47521] rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-extrabold text-xs text-[#F47521] uppercase tracking-wider truncate max-w-[200px]">
                    {selectedManga.title}
                  </h3>
                  <h4 className="font-extrabold text-sm text-white">
                    Глава {activeChapter}, страница {mangaReaderPage + 1}/{selectedManga.pages.length}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  disabled={mangaReaderPage === 0}
                  onClick={() => setMangaReaderPage(prev => prev - 1)}
                  className="p-3 bg-[#23252b] hover:bg-[#F47521]/20 rounded-xl text-white hover:text-[#F47521] disabled:opacity-30 disabled:hover:bg-[#23252b] disabled:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  disabled={mangaReaderPage === selectedManga.pages.length - 1}
                  onClick={() => setMangaReaderPage(prev => prev + 1)}
                  className="p-3 bg-[#23252b] hover:bg-[#F47521]/20 rounded-xl text-white hover:text-[#F47521] disabled:opacity-30 disabled:hover:bg-[#23252b] disabled:hover:text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Comic panel canvas stage */}
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#040406]">
              <div className="relative max-w-2xl w-full h-[75vh] flex items-center justify-center border border-white/5 rounded-3xl bg-[#141519]/40 p-4 shadow-2xl group overflow-hidden">
                <img 
                  src={selectedManga.pages[mangaReaderPage]} 
                  alt="Manga Comic Strip Panel Artwork" 
                  className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl group-hover:scale-102 transition-transform duration-500"
                />
                
                {/* Interactive hot areas */}
                <div 
                  onClick={() => { if (mangaReaderPage > 0) setMangaReaderPage(prev => prev - 1); }}
                  className="absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize z-10 flex items-center justify-start pl-6 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/40 to-transparent"
                >
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white">
                    <ChevronLeft className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  onClick={() => { if (mangaReaderPage < selectedManga.pages.length - 1) setMangaReaderPage(prev => prev + 1); }}
                  className="absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize z-10 flex items-center justify-end pr-6 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/40 to-transparent"
                >
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom quick navigation bar */}
            <div className="bg-[#141519] p-4 flex items-center justify-center gap-2 border-t border-white/5">
              {selectedManga.pages.map((_, idx) => (
                <button 
                  key={idx}
                  onClick={() => setMangaReaderPage(idx)}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${idx === mangaReaderPage ? 'bg-[#F47521] scale-125' : 'bg-slate-700 hover:bg-slate-500'}`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Manga;
