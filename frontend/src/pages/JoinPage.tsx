import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, ArrowRight, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/Footer';

interface HostelInfo {
  id: string;
  name: string;
  city: string;
  address: string;
}

export function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const codeFromQr = searchParams.get('code')?.trim().toUpperCase() ?? '';
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const [hostel, setHostel] = useState<HostelInfo | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(true);

  const [nickname, setNickname] = useState('');
  const [accessCode, setAccessCode] = useState(codeFromQr);
  const [showCodeInput, setShowCodeInput] = useState(!codeFromQr);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function resolveQr() {
      if (!token) {
        setQrError('Missing QR token.');
        setLoadingQr(false);
        return;
      }
      try {
        const res = await apiRequest<{ hostel: HostelInfo }>(`/qr/resolve/${token}`);
        if (active) setHostel(res.hostel);
      } catch (err) {
        if (active) {
          setQrError(err instanceof ApiError ? err.message : 'Invalid or revoked QR code.');
        }
      } finally {
        if (active) setLoadingQr(false);
      }
    }
    void resolveQr();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await apiRequest('/auth/traveller/onboard', {
        method: 'POST',
        body: JSON.stringify({
          qrToken: token,
          nickname: nickname.trim(),
          accessCode: accessCode.trim(),
        }),
      });
      await refreshAuth();
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setShowCodeInput(true);
      }
      setFormError(err instanceof ApiError ? err.message : 'Could not join hostel space.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-3xl border border-amber-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <span className="w-9 h-9 rounded-xl bg-[#E85D3F] text-white font-bold flex items-center justify-center text-sm">
              CG
            </span>
            <span className="font-bold text-slate-900">Common Ground</span>
          </div>

          {loadingQr ? (
            <div className="py-12 flex flex-col items-center text-slate-500 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#E85D3F]" />
              <p className="text-sm">Identifying your hostel...</p>
            </div>
          ) : qrError ? (
            <div className="py-6 text-center">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-slate-900 mb-1">QR Code Unavailable</h1>
              <p className="text-sm text-slate-600">{qrError}</p>
              <p className="text-xs text-slate-400 mt-4">
                Please ask hostel reception for the latest Common Ground QR code.
              </p>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-4">
                <MapPin className="w-3.5 h-3.5" />
                {hostel?.name} · {hostel?.city}
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
                Welcome to Common Ground
              </h1>
              <p className="text-sm text-slate-600 mb-6">Let's get you connected.</p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Your Nickname
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={40}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g., Kabir, Maya, SoloSam"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D3F]/30 focus:border-[#E85D3F]"
                  />
                </div>

                {showCodeInput ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Hostel Access Code
                    </label>
                    <input
                      type="text"
                      required
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      placeholder="Ask hostel reception (e.g., JPR101)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm uppercase tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-[#E85D3F]/30 focus:border-[#E85D3F]"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Access verified via hostel QR
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCodeInput(true)}
                      className="text-emerald-700 underline font-medium"
                    >
                      Change
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#E85D3F] hover:bg-[#D94E32] text-white font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Connecting...' : 'Enter Hostel Space'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <p className="text-[11px] text-slate-400 text-center mt-5">
                No email or room number needed. Your session stays active for 72 hours.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
