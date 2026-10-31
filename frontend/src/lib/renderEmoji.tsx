import React from 'react';

export interface PixelEmojiDef {
  id: string;
  name: string;
  char: string;
  shortcode: string;
  src: string;
  category: 'highlight' | 'dish' | 'topping' | 'drink';
  isAnimated?: boolean;
}

export const PIXEL_EMOJI_LIST: PixelEmojiDef[] = [
  // --- ไฮไลต์ / แนะนำ (Highlight & Badges) ---
  { id: 'fire', name: 'ไฟลุก', char: '🔥', shortcode: ':fire:', src: '/pixel_emojis/fire.gif', category: 'highlight', isAnimated: true },
  { id: 'star', name: 'ดาวแนะนำ', char: '⭐', shortcode: ':star:', src: '/pixel_emojis/star.gif', category: 'highlight', isAnimated: true },
  { id: 'trophy', name: 'ถ้วยรางวัล', char: '🏆', shortcode: ':trophy:', src: '/pixel_emojis/trophy.gif', category: 'highlight', isAnimated: true },
  { id: 'crown', name: 'มงกุฎ', char: '👑', shortcode: ':crown:', src: '/pixel_emojis/crown.png', category: 'highlight' },
  { id: 'bolt', name: 'สายฟ้า', char: '⚡', shortcode: ':bolt:', src: '/pixel_emojis/bolt.gif', category: 'highlight', isAnimated: true },
  { id: 'cat', name: 'แมวอ้วน', char: '🐱', shortcode: ':cat:', src: '/pixel_emojis/cat.png', category: 'highlight' },
  { id: 'heart', name: 'หัวใจ', char: '💖', shortcode: ':heart:', src: '/pixel_emojis/heart.png', category: 'highlight' },
  { id: 'delivery', name: 'ส่งคอนโด', char: '🛵', shortcode: ':delivery:', src: '/pixel_emojis/delivery.png', category: 'highlight' },
  { id: 'tag', name: 'โปรโมชั่น', char: '🏷️', shortcode: ':tag:', src: '/pixel_emojis/tag.png', category: 'highlight' },

  // --- อาหารจานหลัก (Main Dishes) ---
  { id: 'shrimp', name: 'กุ้งเด้ง', char: '🍤', shortcode: ':shrimp:', src: '/pixel_emojis/shrimp.png', category: 'dish' },
  { id: 'chicken', name: 'ไก่ทอด/ต้ม', char: '🍗', shortcode: ':chicken:', src: '/pixel_emojis/chicken.png', category: 'dish' },
  { id: 'egg_fried', name: 'ไข่ข้น/ไข่ดาว', char: '🍳', shortcode: ':egg_fried:', src: '/pixel_emojis/egg_fried.png', category: 'dish' },
  { id: 'egg', name: 'ไข่ไก่', char: '🥚', shortcode: ':egg:', src: '/pixel_emojis/egg.png', category: 'dish' },
  { id: 'rice', name: 'ข้าวหอมมะลิ', char: '🍚', shortcode: ':rice:', src: '/pixel_emojis/rice.png', category: 'dish' },
  { id: 'noodle', name: 'มาม่าเกาหลี', char: '🍜', shortcode: ':noodle:', src: '/pixel_emojis/noodle.gif', category: 'dish', isAnimated: true },
  { id: 'bento', name: 'ข้าวกล่อง', char: '🍱', shortcode: ':bento:', src: '/pixel_emojis/bento.png', category: 'dish' },
  { id: 'hotpot', name: 'ต้มน้ำปลา', char: '🍲', shortcode: ':hotpot:', src: '/pixel_emojis/hotpot.png', category: 'dish' },
  { id: 'pork_belly', name: 'หมูสามชั้น', char: '🥓', shortcode: ':pork:', src: '/pixel_emojis/pork_belly.png', category: 'dish' },
  { id: 'beef', name: 'เนื้อสเต๊ก', char: '🥩', shortcode: ':beef:', src: '/pixel_emojis/beef.png', category: 'dish' },
  { id: 'sausage', name: 'ไส้กรอก', char: '🌭', shortcode: ':sausage:', src: '/pixel_emojis/sausage.png', category: 'dish' },
  { id: 'squid', name: 'ปลาหมึก', char: '🦑', shortcode: ':squid:', src: '/pixel_emojis/squid.png', category: 'dish' },
  { id: 'salmon', name: 'แซลมอน', char: '🍣', shortcode: ':salmon:', src: '/pixel_emojis/salmon.png', category: 'dish' },
  { id: 'pasta', name: 'เส้น/พาสต้า', char: '🍝', shortcode: ':pasta:', src: '/pixel_emojis/pasta.png', category: 'dish' },
  { id: 'burger', name: 'เบอร์เกอร์', char: '🍔', shortcode: ':burger:', src: '/pixel_emojis/burger.png', category: 'dish' },

  // --- ท็อปปิ้ง & ผัก (Toppings & Extras) ---
  { id: 'chili', name: 'พริกสด', char: '🌶️', shortcode: ':chili:', src: '/pixel_emojis/chili.png', category: 'topping' },
  { id: 'garlic', name: 'กระเทียม', char: '🧄', shortcode: ':garlic:', src: '/pixel_emojis/garlic.png', category: 'topping' },
  { id: 'nori', name: 'สาหร่าย', char: '🍙', shortcode: ':nori:', src: '/pixel_emojis/nori.png', category: 'topping' },
  { id: 'kimchi', name: 'กิมจิ', char: '🥢', shortcode: ':kimchi:', src: '/pixel_emojis/kimchi.png', category: 'topping' },
  { id: 'cheese', name: 'ชีส', char: '🧀', shortcode: ':cheese:', src: '/pixel_emojis/cheese.png', category: 'topping' },
  { id: 'cucumber', name: 'แตงกวา', char: '🥒', shortcode: ':cucumber:', src: '/pixel_emojis/cucumber.png', category: 'topping' },
  { id: 'mushroom', name: 'เห็ด', char: '🍄', shortcode: ':mushroom:', src: '/pixel_emojis/mushroom.png', category: 'topping' },
  { id: 'corn', name: 'ข้าวโพด', char: '🌽', shortcode: ':corn:', src: '/pixel_emojis/corn.png', category: 'topping' },
  { id: 'lemon', name: 'มะนาว', char: '🍋', shortcode: ':lemon:', src: '/pixel_emojis/lemon.png', category: 'topping' },
  { id: 'tofu', name: 'เต้าหู้', char: '🥣', shortcode: ':tofu:', src: '/pixel_emojis/tofu.png', category: 'topping' },

  // --- เครื่องดื่ม & ของหวาน (Drinks & Sweets) ---
  { id: 'beer', name: 'เบียร์เย็น', char: '🍺', shortcode: ':beer:', src: '/pixel_emojis/beer.png', category: 'drink' },
  { id: 'tea', name: 'ชา', char: '🍵', shortcode: ':tea:', src: '/pixel_emojis/tea.png', category: 'drink' },
  { id: 'coffee', name: 'กาแฟ', char: '☕', shortcode: ':coffee:', src: '/pixel_emojis/coffee.png', category: 'drink' },
  { id: 'juice', name: 'น้ำผลไม้', char: '🧃', shortcode: ':juice:', src: '/pixel_emojis/juice.png', category: 'drink' },
  { id: 'cake', name: 'เค้ก', char: '🍰', shortcode: ':cake:', src: '/pixel_emojis/cake.png', category: 'drink' },
  { id: 'chocolate', name: 'ช็อกโกแลต', char: '🍫', shortcode: ':chocolate:', src: '/pixel_emojis/chocolate.png', category: 'drink' },
];

// O(1) Fast Lookup Mapping for both Unicode Chars and :shortcodes:
const EMOJI_MAP: Record<string, PixelEmojiDef> = {};
PIXEL_EMOJI_LIST.forEach((item) => {
  EMOJI_MAP[item.char] = item;
  EMOJI_MAP[item.shortcode] = item;
});

// Additional Aliases & Fallbacks
EMOJI_MAP['✨'] = EMOJI_MAP['⭐'];
EMOJI_MAP['⚡️'] = EMOJI_MAP['⚡'];
EMOJI_MAP['🥘'] = EMOJI_MAP['🍲'];
EMOJI_MAP['🌶'] = EMOJI_MAP['🌶️'];
EMOJI_MAP[':spicy:'] = EMOJI_MAP[':chili:'];
EMOJI_MAP[':bestseller:'] = EMOJI_MAP[':fire:'];
EMOJI_MAP[':recommended:'] = EMOJI_MAP[':star:'];
EMOJI_MAP[':first:'] = EMOJI_MAP[':trophy:'];

interface PixelEmojiProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedFlame: React.FC<PixelEmojiProps> = ({ className = '', size = 'md' }) => {
  const sizeClass = size === 'lg' ? 'h-[22px] w-auto' : size === 'sm' ? 'h-[14px] w-auto' : 'h-[17px] w-auto';
  return (
    <img
      src="/pixel_emojis/fire.gif"
      alt="🔥"
      className={`${sizeClass} inline-block select-none align-middle object-contain filter drop-shadow-[0_0_4px_rgba(249,115,22,0.85)] -translate-y-[1px] ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export const AnimatedTrophy: React.FC<PixelEmojiProps> = ({ className = '', size = 'md' }) => {
  const sizeClass = size === 'lg' ? 'h-[20px] w-auto' : size === 'sm' ? 'h-[14px] w-auto' : 'h-[16px] w-auto';
  return (
    <img
      src="/pixel_emojis/trophy.gif"
      alt="🏆"
      className={`${sizeClass} inline-block select-none align-middle object-contain filter drop-shadow-[0_0_4px_rgba(250,204,21,0.85)] -translate-y-[1px] ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export const AnimatedStar: React.FC<PixelEmojiProps> = ({ className = '', size = 'md' }) => {
  const sizeClass = size === 'lg' ? 'h-[19px] w-auto' : size === 'sm' ? 'h-[13px] w-auto' : 'h-[15px] w-auto';
  return (
    <img
      src="/pixel_emojis/star.gif"
      alt="⭐"
      className={`${sizeClass} inline-block select-none align-middle object-contain filter drop-shadow-[0_0_4px_rgba(250,204,21,0.85)] -translate-y-[1px] ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export const AnimatedSparkle = AnimatedStar;

/**
 * Builds a dynamic regex that matches all supported emojis and shortcodes.
 */
const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
const ALL_KEYS = Object.keys(EMOJI_MAP).sort((a, b) => b.length - a.length);
const EMOJI_REGEX = new RegExp(`(${ALL_KEYS.map(escapeRegex).join('|')})`, 'g');

/**
 * Parses any text containing emojis or shortcodes and renders authentic 2D pixel icons.
 */
export const renderWithAnimatedEmojis = (text: string | null | undefined): React.ReactNode => {
  if (!text) return text;

  const parts = text.split(EMOJI_REGEX);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    const item = EMOJI_MAP[part];
    if (item) {
      return (
        <img
          key={index}
          src={item.src}
          alt={item.name}
          title={item.name}
          className={`w-[19px] h-[19px] inline-block select-none align-middle object-contain mx-0.5 -translate-y-[1px] ${
            item.isAnimated ? 'filter drop-shadow-[0_0_4px_rgba(250,204,21,0.7)]' : ''
          }`}
          style={{ imageRendering: 'pixelated' }}
          loading="lazy"
        />
      );
    }
    return part;
  });
};
