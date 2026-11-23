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

interface GroupSquadPreset {
  id: string;
  bg: string;
  seeds: [string, string, string];
}

const GROUP_SQUAD_PRESETS: GroupSquadPreset[] = [
  { id: 'squad:1', bg: '#b6e3f4', seeds: ['Aarav', 'Ananya', 'Kabir'] },
  { id: 'squad:2', bg: '#ffdfbf', seeds: ['Maya', 'Rohan', 'Zoya'] },
  { id: 'squad:3', bg: '#c0aede', seeds: ['Liam', 'Elena', 'Marco'] },
  { id: 'squad:4', bg: '#ffd5dc', seeds: ['Priya', 'Sam', 'Nisha'] },
  { id: 'squad:5', bg: '#fde68a', seeds: ['Kabir', 'Maya', 'Sam'] },
  { id: 'squad:6', bg: '#bbf7d0', seeds: ['Zoya', 'Aarav', 'Elena'] },
  { id: 'squad:7', bg: '#d1d4f9', seeds: ['Rohan', 'Priya', 'Liam'] },
  { id: 'squad:8', bg: '#fecaca', seeds: ['Nisha', 'Marco', 'Ananya'] },
];

const GROUP_SQUAD_MAP = new Map(GROUP_SQUAD_PRESETS.map((p) => [p.id, p]));

export const GROUP_PRESET_AVATARS = GROUP_SQUAD_PRESETS.map((p) => p.id);

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

  if (src && GROUP_SQUAD_MAP.has(src)) {
    const squad = GROUP_SQUAD_MAP.get(src)!;
    return (
      <div
        style={{ backgroundColor: squad.bg }}
        className={`${className} relative overflow-hidden shrink-0 select-none`}
        aria-label={name}
      >
        <img
          src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${squad.seeds[0]}`}
          alt=""
          className="absolute bottom-0 -left-[12%] w-[68%] h-[68%] object-contain"
        />
        <img
          src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${squad.seeds[2]}`}
          alt=""
          className="absolute bottom-0 -right-[12%] w-[68%] h-[68%] object-contain"
        />
        <img
          src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${squad.seeds[1]}`}
          alt={name}
          className="absolute -bottom-[2%] left-1/2 -translate-x-1/2 w-[78%] h-[78%] object-contain z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
        />
      </div>
    );
  }

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
