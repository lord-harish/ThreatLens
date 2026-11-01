import React from 'react';

export function Footer() {
  return (
    <footer className="mt-6 border-t border-slate-700 bg-slate-900 px-4 py-4 text-slate-300 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs sm:gap-x-5">
        <span className="font-semibold tracking-wide text-slate-100">
          Made by IOT Detectors
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
          Members:
        </span>
        <span>Harish Pranav V</span>
        <span>Karniya A</span>
        <span className="text-[10px] font-mono text-slate-500">
          © {new Date().getFullYear()} ThreatLens
        </span>
      </div>
    </footer>
  );
}
