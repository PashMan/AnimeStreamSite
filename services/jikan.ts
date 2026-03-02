
const BASE_URL = 'https://api.jikan.moe/v4';

export const fetchJikanImage = async (malId: string): Promise<string | null> => {
  try {
    // Add a small delay to avoid rate limiting if multiple requests happen at once
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    const res = await fetch(`${BASE_URL}/anime/${malId}`);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('Jikan API Rate Limit');
            return null;
        }
        throw new Error(`Jikan API Error: ${res.status}`);
    }
    const data = await res.json();
    
    // Try to get the best quality image
    const images = data.data?.images;
    return images?.webp?.large_image_url || 
           images?.jpg?.large_image_url || 
           images?.webp?.image_url || 
           images?.jpg?.image_url || 
           null;
  } catch (e) {
    console.error('Jikan fetch error:', e);
    return null;
  }
};
