import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAnimes, GENRE_MAP } from '../services/shikimori';

interface CollectionCardProps {
  collection: {
    id: string;
    title: string;
    color: string;
    count: string;
    defaultGenre?: string;
    image: string;
  };
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection }) => {
  const [coverImage, setCoverImage] = useState<string>(collection.image);

  useEffect(() => {
    let isMounted = true;
    
    const fetchCover = async () => {
      if (!collection.defaultGenre) return;
      
      try {
        const genreId = GENRE_MAP[collection.defaultGenre];
        if (!genreId) return;
        
        const results = await fetchAnimes({
          limit: 9,
          order: 'popularity',
          genre: genreId
        });
        
        if (isMounted && results.length >= 9) {
          setCoverImage(results[8].image);
        } else if (isMounted && results.length > 0) {
          // Fallback to the last available if less than 9
          setCoverImage(results[results.length - 1].image);
        }
      } catch (error) {
        console.error('Failed to fetch cover for collection:', collection.id);
      }
    };

    fetchCover();

    return () => {
      isMounted = false;
    };
  }, [collection.id, collection.defaultGenre]);

  return (
    <Link to={`/collections/${collection.id}`} className="group relative h-56 rounded-3xl overflow-hidden block shadow-xl border border-white/5 animate-in fade-in zoom-in duration-500">
      <img src={coverImage} alt={collection.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
      <div className={`absolute inset-0 bg-gradient-to-t ${collection.color} mix-blend-multiply opacity-80 group-hover:opacity-90 transition-opacity`}></div>
      <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
        <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-white text-xs font-black w-fit mb-2 shadow-lg border border-white/10">
          {collection.count}
        </div>
        <h3 className="text-white font-bold text-xl leading-tight drop-shadow-lg">{collection.title}</h3>
      </div>
    </Link>
  );
};

export default CollectionCard;
