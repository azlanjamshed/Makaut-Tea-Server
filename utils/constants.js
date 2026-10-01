/**
 * Shared Backend Constants
 */
const ALLOWED_REACTIONS = ['❤️', '👎', '💀'];

const REACTIONS_META = [
  { emoji: '❤️', name: 'love', label: 'Love' },
  { emoji: '👎', name: 'dislike', label: 'Dislike' },
  { emoji: '💀', name: 'dead', label: 'Dead' },
];

module.exports = {
  ALLOWED_REACTIONS,
  REACTIONS_META,
};
