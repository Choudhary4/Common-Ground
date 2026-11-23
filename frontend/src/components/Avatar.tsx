export const PRESET_AVATARS = [
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Aarav&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Ananya&backgroundColor=ffd5dc',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Kabir&backgroundColor=c0aede',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Maya&backgroundColor=ffdfbf',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Liam&backgroundColor=d1d4f9',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Zoya&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Rohan&backgroundColor=ffdfbf',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Elena&backgroundColor=ffd5dc',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Marco&backgroundColor=c0aede',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Priya&backgroundColor=d1d4f9',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Sam&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Nisha&backgroundColor=ffdfbf',
];

export function Avatar({
  src,
  name,
  className = 'w-10 h-10 rounded-2xl',
  bgClass = 'bg-[#14241E] text-emerald-200',
}: {
  src?: string | null;
  name: string;
  className?: string;
  bgClass?: string;
}) {
  const initials = (name || 'CG')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} object-cover bg-[#f0f3ff]`}
      />
    );
  }

  return (
    <div
      className={`${className} ${bgClass} font-extrabold text-xs flex items-center justify-center shrink-0`}
    >
      {initials}
    </div>
  );
}
