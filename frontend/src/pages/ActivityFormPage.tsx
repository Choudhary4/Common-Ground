import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { TravellerLayout } from '../components/TravellerLayout';
import { apiRequest, ApiError } from '../lib/api';

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
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-5 sm:p-6">
          <h1 className="text-xl font-extrabold text-slate-900 mb-1">
            {mode === 'edit' ? 'Edit Activity' : 'Create an Activity'}
          </h1>
          <p className="text-xs text-slate-500 mb-5">
            Keep it simple and welcoming—anyone at your hostel can see it.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Activity Name
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Chai & UNO Night"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                required
                minLength={5}
                maxLength={600}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the plan? Beginners welcome!"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="SOCIAL">Social</option>
                  <option value="GAMES">Games</option>
                  <option value="EXPLORATION">Exploration</option>
                  <option value="FOOD">Food</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  required
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meeting Point
              </label>
              <input
                type="text"
                required
                value={meetingPoint}
                onChange={(e) => setMeetingPoint(e.target.value)}
                placeholder="e.g., Rooftop Common Room"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Joining Permission
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setJoinMode('PUBLIC')}
                  className={`p-3 rounded-xl border text-left transition ${
                    joinMode === 'PUBLIC'
                      ? 'border-[#E85D3F] bg-[#FFF4F1]'
                      : 'border-slate-200'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">Public (Instant)</p>
                  <p className="text-[11px] text-slate-500">Anyone at the hostel can join</p>
                </button>
                <button
                  type="button"
                  onClick={() => setJoinMode('APPROVAL')}
                  className={`p-3 rounded-xl border text-left transition ${
                    joinMode === 'APPROVAL'
                      ? 'border-[#E85D3F] bg-[#FFF4F1]'
                      : 'border-slate-200'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">Approval Required</p>
                  <p className="text-[11px] text-slate-500">You approve join requests</p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-[#E85D3F] hover:bg-[#D94E32] text-white font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Publish Activity'}
            </button>
          </form>
        </div>
      </div>
    </TravellerLayout>
  );
}
