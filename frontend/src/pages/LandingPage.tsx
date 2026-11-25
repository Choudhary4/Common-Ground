import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  Sparkle,
  ChatCircleDots,
  Camera,
  ArrowRight,
  ShieldCheck,
  ClockCountdown,
  BellRinging,
  Broadcast,
  Buildings,
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/Footer';
import { QrScannerModal } from '../components/QrScannerModal';
import { PRESET_AVATARS } from '../components/Avatar';

export function LandingPage() {
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);

  const dashboardPath =
    user?.role === 'TRAVELLER'
      ? '/app'
      : user?.role === 'CENTRAL_ADMIN'
        ? '/admin'
        : user?.role === 'HOSTEL_MANAGER'
          ? '/manager'
          : '/staff';

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2d]">
      {/* Top Navbar */}
      <header className="max-w-4xl w-full mx-auto px-4 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#14241E] text-white text-[11px] font-extrabold tracking-wider uppercase shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>GOSTOPS</span>
          <span className="text-emerald-400">×</span>
          <span>COMMON GROUND</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/staff/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#f0f3ff] border border-[#e0bfb8]/50 text-[#14241E] text-xs font-bold shadow-2xs transition active:scale-95"
          >
            <Buildings weight="duotone" className="w-3.5 h-3.5 text-[#a93017]" />
            <span>Manager Login</span>
          </Link>
          {user && (
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <span>Open Dashboard</span>
              <ArrowRight weight="bold" className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-10 space-y-6 flex flex-col justify-center">
        {/* Hero Bento Card */}
        <section className="relative overflow-hidden rounded-[2rem] bg-[#14241E] text-white p-6 sm:p-10 shadow-lg border border-emerald-500/20">
          {/* Subtle ambient glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#a93017]/25 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-emerald-300 text-[11px] font-bold mb-5">
              <Broadcast weight="duotone" className="w-3.5 h-3.5 text-emerald-400" />
              For solo travellers at goSTOPS hostels
            </span>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-4">
              Turn common-room hellos into{' '}
              <span className="text-emerald-300">real-world plans.</span>
            </h1>

            <p className="text-emerald-100/80 text-sm sm:text-base leading-relaxed mb-7 max-w-xl">
              No app download. No heavy profiles. Scan the QR code in your hostel common room and
              see who&apos;s up for masala chai, UNO nights, or sunset walks right now.
            </p>

            {/* Primary Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#a93017] hover:bg-[#cb482c] text-white text-sm font-bold shadow-md transition active:scale-95"
              >
                <Camera weight="duotone" className="w-4 h-4" />
                <span>Scan Hostel QR</span>
              </button>

              {user && (
                <Link
                  to={dashboardPath}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-emerald-200 text-sm font-bold transition active:scale-95"
                >
                  <span>Go to Radar</span>
                  <ArrowRight weight="bold" className="w-4 h-4" />
                </Link>
              )}
            </div>

            {/* Social Proof / Live Radar Strip */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-4">
              <div className="flex -space-x-2.5">
                {PRESET_AVATARS.slice(0, 4).map((url, idx) => (
                  <img
                    key={url}
                    src={url}
                    alt={`Traveller ${idx + 1}`}
                    className="w-8 h-8 rounded-full border-2 border-[#14241E] bg-[#f0f3ff] object-cover"
                  />
                ))}
              </div>
              <p className="text-xs text-emerald-100/75 font-medium">
                <strong className="text-white font-bold">Live Hostel Radar</strong> — private to
                checked-in travellers at your property.
              </p>
            </div>
          </div>
        </section>

        {/* Hostel Manager Self-Serve Banner (above the fold) */}
        <section className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#f0f3ff] text-[#14241E] flex items-center justify-center shrink-0">
              <Buildings weight="duotone" className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#111c2d]">
                Hostel Manager or Community Host?
              </h2>
              <p className="text-xs text-[#59413c] mt-0.5 leading-relaxed">
                Sign in or create your own property space to generate a live QR poster &amp; access
                code in 10 seconds.
              </p>
            </div>
          </div>
          <Link
            to="/staff/login"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[#14241E] hover:bg-emerald-950 text-emerald-300 text-xs font-bold shadow-xs transition active:scale-95"
          >
            <span>Manager Login / Create Space</span>
            <ArrowRight weight="bold" className="w-3.5 h-3.5" />
          </Link>
        </section>

        {/* 3-Step Bento Grid */}
        <section className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 shadow-xs hover:shadow-sm transition">
            <div className="w-11 h-11 rounded-2xl bg-[#ffdad3]/60 text-[#a93017] flex items-center justify-center mb-3.5">
              <QrCode weight="duotone" className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#a93017]">
              Step 01
            </p>
            <h3 className="font-extrabold text-sm text-[#111c2d] mt-0.5">Scan Hostel QR</h3>
            <p className="text-xs text-[#59413c] leading-relaxed mt-1.5">
              Scan the poster in your common room or upload its photo to unlock your hostel&apos;s
              private space.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 shadow-xs hover:shadow-sm transition">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#14241E] flex items-center justify-center mb-3.5">
              <Sparkle weight="duotone" className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              Step 02
            </p>
            <h3 className="font-extrabold text-sm text-[#111c2d] mt-0.5">Share Your Vibe</h3>
            <p className="text-xs text-[#59413c] leading-relaxed mt-1.5">
              Let fellow travellers know you&apos;re up for chai, games, or exploring — auto-expires
              in 2 hours.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#e0bfb8]/35 p-5 shadow-xs hover:shadow-sm transition">
            <div className="w-11 h-11 rounded-2xl bg-[#f0f3ff] text-[#14241E] flex items-center justify-center mb-3.5">
              <ChatCircleDots weight="duotone" className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#14241E]">
              Step 03
            </p>
            <h3 className="font-extrabold text-sm text-[#111c2d] mt-0.5">Chat &amp; Meet Up</h3>
            <p className="text-xs text-[#59413c] leading-relaxed mt-1.5">
              Join UNO nights, street food walks, start a group chat, or host your own quick hostel
              plan.
            </p>
          </div>
        </section>

        {/* Privacy & Trust Highlights */}
        <section className="bg-white rounded-2xl border border-[#e0bfb8]/35 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#59413c]">
          <div className="inline-flex items-center gap-2">
            <ShieldCheck weight="duotone" className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Hostel-isolated private space</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <ClockCountdown weight="duotone" className="w-4 h-4 text-[#a93017] shrink-0" />
            <span>72h auto-expiring sessions</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <BellRinging weight="duotone" className="w-4 h-4 text-[#14241E] shrink-0" />
            <span>Instant mobile alerts</span>
          </div>
        </section>
      </main>

      {scannerOpen && <QrScannerModal onClose={() => setScannerOpen(false)} />}
      <Footer />
    </div>
  );
}
