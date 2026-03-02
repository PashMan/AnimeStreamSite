// Basic Russian profanity list for demonstration
// In a real application, this should be more comprehensive and ideally handled server-side.
const BAD_WORDS = [
  'блять', 'бля', 'сука', 'ебать', 'ебан', 'пиздец', 'пидор', 'хуй', 'хуйня', 'пизда',
  'мудак', 'гандон', 'шлюха', 'залупа', 'долбаеб', 'хуесос', 'уебок', 'пидорас', 'хер',
  'блядь', 'ебаный', 'ебаная', 'ебаное', 'ебаные', 'ебанутый', 'ебанутая', 'ебанутое', 'ебанутые',
  'пиздеть', 'спиздить', 'нахуй', 'похуй', 'хуево', 'охуенно', 'охуеть', 'охуел', 'охуела',
  'пиздобол', 'пиздолиз', 'пиздострадалец', 'пиздобратия', 'пиздокрыл', 'пиздоглазый',
  'еблан', 'еблыст', 'еблыстик', 'еблысточка', 'еблыстушка', 'еблыстушечка', 'еблыстушеночка',
  'еблыстушеночечка', 'еблыстушеночечечка', 'еблыстушеночечечечка'
];

export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  
  return BAD_WORDS.some(word => {
    // For very short words, use word boundaries to avoid false positives
    if (word.length <= 3) {
      const regex = new RegExp(`(?:^|\\s|[.,!?_\\-])${word}(?:$|\\s|[.,!?_\\-])`, 'i');
      return regex.test(lowerText);
    }
    // For longer words, a simple substring check is often more effective for Russian
    return lowerText.includes(word);
  });
};
