import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Users, Coffee, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/Footer';
import { QrScannerModal } from '../components/QrScannerModal';

export function LandingPage() {
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <header className="max-w-3xl w-full mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#E85D3F] text-white font-bold flex items-center justify-center text-sm shadow-sm">
            CG
          </span>
          <span className="font-bold text-slate-900 text-lg">Common Ground</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <Link
              to={
                user.role === 'TRAVELLER'
                  ? '/app'
                  : user.role === 'CENTRAL_ADMIN'
                    ? '/admin'
                    : user.role === 'HOSTEL_MANAGER'
                      ? '/manager'
                      : '/staff'
              }
              className="px-4 py-2 rounded-xl bg-[#E85D3F] text-white text-sm font-semibold hover:bg-[#D94E32] transition"
            >
              Open Dashboard
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10 flex flex-col justify-center">
        <div className="bg-white rounded-3xl border border-amber-200/80 p-6 sm:p-10 shadow-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0EC] text-[#D94E32] text-xs font-semibold mb-4">
            For solo travellers at goSTOPS hostels
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Turn common-room hellos into real-world plans.
          </h1>
          <p className="text-slate-600 text-base leading-relaxed mb-8">
            No app download. No profiles. Scan the QR code in your hostel common room, enter the
            hostel access code from reception, and see who's up for chai, games, or exploring right
            now.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-amber-200/60">
              <QrCode className="w-6 h-6 text-[#E85D3F] mb-2" />
              <h3 className="font-bold text-sm text-slate-900">1. Scan Hostel QR</h3>
              <p className="text-xs text-slate-600 mt-1">
                Every hostel has its own private social space.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-amber-200/60">
              <Coffee className="w-6 h-6 text-[#E85D3F] mb-2" />
              <h3 className="font-bold text-sm text-slate-900">2. Share Your Vibe</h3>
              <p className="text-xs text-slate-600 mt-1">
                Let others know if you're open to meeting—auto-expires in 2 hours.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-amber-200/60">
              <Users className="w-6 h-6 text-[#E85D3F] mb-2" />
              <h3 className="font-bold text-sm text-slate-900">3. Meet in Person</h3>
              <p className="text-xs text-slate-600 mt-1">
                Join UNO nights, street food walks, or host your own meetup.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-950">
            <div>
              <strong>Staying at a hostel right now?</strong> Scan the Common Ground QR poster in
              your common room or upload its QR image.
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#E85D3F] hover:bg-[#D94E32] text-white text-sm font-semibold shadow-xs transition"
            >
              <Camera className="w-4 h-4" /> Scan Hostel QR
            </button>
          </div>
        </div>
      </main>

      {scannerOpen && <QrScannerModal onClose={() => setScannerOpen(false)} />}
      <Footer />
    </div>
  );
}
