import { useState } from 'react';
import { Sparkles, Coffee, Users, Compass, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

export type SocialStatusValue =
  | 'OPEN_TO_MEETING'
  | 'UP_FOR_ACTIVITIES'
  | 'LOOKING_FOR_COMPANY'
  | 'JUST_CHILLING';

export const SOCIAL_STATUS_OPTIONS: Array<{
  value: SocialStatusValue;
  label: string;
  hint: string;
  icon: typeof Sparkles;
}> = [
  {
    value: 'OPEN_TO_MEETING',
    label: 'Open to meeting',
    hint: 'Happy to say hi & chat',
    icon: Sparkles,
  },
  {
    value: 'UP_FOR_ACTIVITIES',
    label: 'Up for activities',
    hint: 'Games, walks, or dinner',
    icon: Compass,
  },
  {
    value: 'LOOKING_FOR_COMPANY',
    label: 'Looking for company',
    hint: 'Anyone heading out?',
    icon: Users,
  },
  {
    value: 'JUST_CHILLING',
    label: 'Just chilling',
    hint: 'Relaxing in common area',
    icon: Coffee,
  },
];

export function formatSocialStatus(value: SocialStatusValue): string {
  return SOCIAL_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function SocialStatusWidget({
  currentStatus,
  expiresAt,
  openCount,
  onUpdated,
}: {
  currentStatus: SocialStatusValue | null;
  expiresAt?: string | null;
  openCount: number;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const selectStatus = async (status: SocialStatusValue) => {
    setBusy(true);
    try {
      await apiRequest('/traveller/status', {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await apiRequest('/traveller/status', { method: 'DELETE' });
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  if (dismissed && !currentStatus) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200/80 p-4 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{openCount}</span>{' '}
          {openCount === 1 ? 'traveller is' : 'travellers are'} open to meeting right now
        </p>
        <button
          onClick={() => setDismissed(false)}
          className="text-xs font-semibold text-[#E85D3F] hover:underline"
        >
          Set my vibe
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-amber-200/80 p-4 sm:p-5 shadow-xs">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">What's your vibe right now?</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Voluntary &amp; auto-expires in 2 hours ·{' '}
            <span className="font-medium text-emerald-700">
              {openCount} {openCount === 1 ? 'traveller' : 'travellers'} open to meeting
            </span>
          </p>
        </div>
        {currentStatus ? (
          <button
            onClick={turnOff}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5" /> Turn off
          </button>
        ) : (
          <button
            onClick={() => setDismissed(true)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Skip
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {SOCIAL_STATUS_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = currentStatus === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => selectStatus(opt.value)}
              className={`text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                selected
                  ? 'border-[#E85D3F] bg-[#FFF4F1] text-slate-900 ring-1 ring-[#E85D3F]'
                  : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-slate-700'
              }`}
            >
              <Icon
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  selected ? 'text-[#E85D3F]' : 'text-slate-400'
                }`}
              />
              <div>
                <p className="text-xs font-semibold leading-snug">{opt.label}</p>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{opt.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {currentStatus && expiresAt && (
        <p className="text-[11px] text-slate-400 mt-2.5">
          Visible until {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </section>
  );
}
