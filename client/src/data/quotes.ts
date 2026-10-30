export interface Quote {
  text: string;
  author?: string;
}

export const quotes: Quote[] = [
  {
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Will Durant',
  },
  {
    text: 'Small disciplines repeated with consistency every day lead to great achievements.',
    author: 'John C. Maxwell',
  },
  {
    text: 'First we make our habits, then our habits make us.',
    author: 'John Dryden',
  },
  {
    text: 'Motivation is what gets you started. Habit is what keeps you going.',
    author: 'Jim Ryun',
  },
  {
    text: 'Continuous effort—not strength or intelligence—is the key to unlocking our potential.',
    author: 'Winston Churchill',
  },
  {
    text: 'Drop by drop is the water pot filled.',
    author: 'The Dhammapada',
  },
  {
    text: 'Success is the sum of small efforts, repeated day in and day out.',
    author: 'Robert Collier',
  },
  {
    text: 'Consistency is the foundation of virtue.',
    author: 'Francis Bacon',
  },
  {
    text: 'It is easier to prevent bad habits than to break them.',
    author: 'Benjamin Franklin',
  },
  {
    text: 'A journey of a thousand miles begins with a single step.',
    author: 'Lao Tzu',
  },
  {
    text: 'Little by little does the trick.',
    author: 'Aesop',
  },
  {
    text: 'Habit is a cable; we weave a thread each day, and at last we cannot break it.',
    author: 'Horace Mann',
  },
  {
    text: 'Energy and persistence conquer all things.',
    author: 'Benjamin Franklin',
  },
  {
    text: 'In diligence lie all accomplishments.',
    author: 'Ancient Proverb',
  },
  {
    text: 'Step by step walk the thousand-mile road.',
    author: 'Miyamoto Musashi',
  },
];

/**
 * Returns a daily quote that stays consistent throughout the local day
 * and changes daily based on whole days since a fixed reference point.
 * Never uses toISOString().
 */
export const getDailyQuote = (): Quote => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const todayDays = Math.floor(Date.UTC(year, month, day) / (24 * 60 * 60 * 1000));
  const referenceDays = Math.floor(Date.UTC(2026, 0, 1) / (24 * 60 * 60 * 1000));
  const diffDays = todayDays - referenceDays;

  const index = Math.abs(diffDays) % quotes.length;
  return quotes[index];
};

