export function Footer() {
  return (
    <footer className="no-print border-t border-[#e0bfb8]/30 bg-[#f9f9ff] py-6 px-4 text-center">
      <div className="max-w-xl mx-auto flex flex-col items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#14241E]/5 border border-[#14241E]/10 text-[10px] font-extrabold tracking-wider uppercase text-[#14241E]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Common Ground
        </span>
        <p className="text-[11px] font-medium text-[#59413c]/85 leading-relaxed">
          Built by Saurabh Kumar for the goSTOPS Build Sprint. Not an official goSTOPS product.
        </p>
      </div>
    </footer>
  );
}
