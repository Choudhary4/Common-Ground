import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CircleNotch,
  Sparkle,
  GlobeHemisphereWest,
  LockSimple,
  CalendarBlank,
  Clock,
  MapPin,
  UsersThree,
  Coffee,
  GameController,
  Compass,
  ForkKnife,
} from '@phosphor-icons/react';
import { TravellerLayout } from '../components/TravellerLayout';
import { apiRequest, ApiError } from '../lib/api';

const QUICK_TEMPLATES = [
  {
    label: 'Chai & Chat',
    icon: Coffee,
    title: 'Chai & Conversations',
    description: 'Grabbing masala chai in the common room—come say hi!',
    category: 'SOCIAL',
    meetingPoint: 'Common Room',
    maxParticipants: 8,
  },
  {
    label: 'UNO / Cards',
    icon: GameController,
    title: 'UNO & Card Games',
    description: 'Casual card games, beginners totally welcome!',
    category: 'GAMES',
    meetingPoint: 'Common Room',
    maxParticipants: 6,
  },
  {
    label: 'Evening Walk',
    icon: Compass,
    title: 'Sunset / City Walk',
    description: 'Exploring nearby streets and grabbing street snacks together.',
    category: 'EXPLORATION',
    meetingPoint: 'Reception Lobby',
    maxParticipants: 6,
  },
  {
    label: 'Group Dinner',
    icon: ForkKnife,
    title: 'Group Dinner Out',
    description: 'Heading out to a local spot for dinner—anyone want to join?',
    category: 'FOOD',
    meetingPoint: 'Reception Lobby',
    maxParticipants: 6,
  },
];

function toLocalDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ActivityFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('SOCIAL');
  const [date, setDate] = useState(toLocalDateInput(defaultStart));
  const [startTime, setStartTime] = useState(toLocalTimeInput(defaultStart));
  const [endTime, setEndTime] = useState(toLocalTimeInput(defaultEnd));
  const [meetingPoint, setMeetingPoint] = useState('Common Room');
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [joinMode, setJoinMode] = useState<'PUBLIC' | 'APPROVAL'>('PUBLIC');
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      apiRequest<{
        activity: {
          title: string;
          description: string;
          category: string;
          scheduledAt: string;
          endsAt: string;
          meetingPoint: string;
          maxParticipants: number;
          joinMode: 'PUBLIC' | 'APPROVAL';
        };
      }>(`/activities/${id}`).then((res) => {
        const a = res.activity;
        const s = new Date(a.scheduledAt);
        const e = new Date(a.endsAt);
        setTitle(a.title);
        setDescription(a.description);
        setCategory(a.category);
        setDate(toLocalDateInput(s));
        setStartTime(toLocalTimeInput(s));
        setEndTime(toLocalTimeInput(e));
        setMeetingPoint(a.meetingPoint);
        setMaxParticipants(a.maxParticipants);
        setJoinMode(a.joinMode);
      });
    }
  }, [mode, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const scheduledAt = new Date(`${date}T${startTime}:00`);
      let endsAt = new Date(`${date}T${endTime}:00`);
      if (endsAt <= scheduledAt) {
        endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
      }

      const payload = {
        title,
        description,
        category,
        scheduledAt: scheduledAt.toISOString(),
        endsAt: endsAt.toISOString(),
        meetingPoint,
        maxParticipants: Number(maxParticipants),
        joinMode,
      };

      if (mode === 'edit' && id) {
        await apiRequest(`/activities/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        navigate(`/app/activities/${id}`);
      } else {
        const res = await apiRequest<{ activity: { _id: string } }>('/activities', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        navigate(`/app/activities/${res.activity._id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TravellerLayout>
      <div className="space-y-3.5">
        <button
          onClick={() => {
            const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
            if (idx > 0) navigate(-1);
            else navigate('/app', { replace: true });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e0bfb8]/40 text-xs font-bold text-[#59413c] hover:text-[#111c2d] shadow-2xs transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="bg-white rounded-2xl border border-[#e0bfb8]/35 shadow-sm overflow-hidden relative">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-[#a93017]" />

          <div className="p-5">
            <h1 className="text-[22px] font-extrabold text-[#111c2d] leading-tight">
              {mode === 'edit' ? 'Edit Activity' : 'Host a Hostel Plan'}
            </h1>
            <p className="text-xs text-[#59413c] mt-1 mb-4">
              Keep it casual—anyone staying at your hostel can see and join.
            </p>

            {mode === 'create' && (
              <div className="mb-5">
                <p className="text-[11px] font-bold text-[#59413c] flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                  <Sparkle weight="duotone" className="w-3.5 h-3.5 text-[#a93017]" /> 1-Tap Quick Ideas
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TEMPLATES.map((tpl) => {
                    const active = selectedTpl === tpl.label;
                    const TplIcon = tpl.icon;
                    return (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => {
                          setSelectedTpl(tpl.label);
                          setTitle(tpl.title);
                          setDescription(tpl.description);
                          setCategory(tpl.category);
                          setMeetingPoint(tpl.meetingPoint);
                          setMaxParticipants(tpl.maxParticipants);
                        }}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left inline-flex items-center gap-2 transition active:scale-[0.98] border ${
                          active
                            ? 'bg-[#14241E] text-white border-[#14241E] shadow-xs'
                            : 'bg-[#f0f3ff] hover:bg-[#e7eeff] text-[#111c2d] border-[#e0bfb8]/25'
                        }`}
                      >
                        <TplIcon
                          weight="duotone"
                          className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-300' : 'text-[#a93017]'}`}
                        />
                        <span>{tpl.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                  Activity Name
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Rooftop Chai & UNO Night"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Description</label>
                <textarea
                  required
                  minLength={5}
                  maxLength={600}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's the plan? Beginners totally welcome!"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#111c2d] mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                  >
                    <option value="SOCIAL">Social</option>
                    <option value="GAMES">Games</option>
                    <option value="EXPLORATION">Exploration</option>
                    <option value="FOOD">Food</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#111c2d] mb-1.5 flex items-center gap-1">
                    <UsersThree weight="duotone" className="w-4 h-4 text-[#a93017]" /> Max Spots
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    required
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                  />
                </div>
              </div>

              {/* Date on full row + Start/End in 2-col row so nothing clips on mobile */}
              <div className="p-3.5 rounded-2xl bg-[#f0f3ff] border border-[#e0bfb8]/25 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#111c2d] mb-1.5 flex items-center gap-1">
                    <CalendarBlank weight="duotone" className="w-4 h-4 text-emerald-700" /> Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0bfb8]/40 text-sm text-[#111c2d] focus:outline-none focus:border-[#a93017]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#111c2d] mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" /> Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0bfb8]/40 text-sm text-[#111c2d] focus:outline-none focus:border-[#a93017]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#111c2d] mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-700" /> End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0bfb8]/40 text-sm text-[#111c2d] focus:outline-none focus:border-[#a93017]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#a93017]" /> Meeting Point
                </label>
                <input
                  type="text"
                  required
                  value={meetingPoint}
                  onChange={(e) => setMeetingPoint(e.target.value)}
                  placeholder="e.g., Rooftop Common Room"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f9f9ff] border border-[#e0bfb8]/50 text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#a93017]/20 focus:border-[#a93017]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111c2d] mb-1.5">
                  Joining Permission
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setJoinMode('PUBLIC')}
                    className={`p-3 rounded-xl border text-left transition ${
                      joinMode === 'PUBLIC'
                        ? 'border-[#14241E] bg-[#14241E] text-white shadow-xs'
                        : 'border-[#e0bfb8]/40 bg-[#f9f9ff] text-[#111c2d]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <GlobeHemisphereWest
                        weight="duotone"
                        className={`w-4 h-4 ${
                          joinMode === 'PUBLIC' ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      />
                      <p className="text-xs font-bold">Public</p>
                    </div>
                    <p
                      className={`text-[10px] leading-tight ${
                        joinMode === 'PUBLIC' ? 'text-emerald-100/80' : 'text-[#59413c]'
                      }`}
                    >
                      Instant join for hostel guests
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinMode('APPROVAL')}
                    className={`p-3 rounded-xl border text-left transition ${
                      joinMode === 'APPROVAL'
                        ? 'border-[#14241E] bg-[#14241E] text-white shadow-xs'
                        : 'border-[#e0bfb8]/40 bg-[#f9f9ff] text-[#111c2d]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <LockSimple
                        weight="duotone"
                        className={`w-4 h-4 ${
                          joinMode === 'APPROVAL' ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      />
                      <p className="text-xs font-bold">Approval</p>
                    </div>
                    <p
                      className={`text-[10px] leading-tight ${
                        joinMode === 'APPROVAL' ? 'text-emerald-100/80' : 'text-[#59413c]'
                      }`}
                    >
                      You approve each request
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 rounded-full bg-[#a93017] hover:bg-[#cb482c] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60"
              >
                {saving && <CircleNotch className="w-4 h-4 animate-spin" />}
                {saving ? 'Publishing...' : mode === 'edit' ? 'Save Changes' : 'Publish Activity'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </TravellerLayout>
  );
}
