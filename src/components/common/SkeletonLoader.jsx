import React from 'react';

export function SkeletonLoader({ type = 'table', rows = 5 }) {
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-panel p-5 rounded-2xl animate-pulse space-y-3">
            <div className="h-4 bg-pink-200/50 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="h-8 bg-pink-300/40 dark:bg-slate-700 rounded w-1/2"></div>
            <div className="h-3 bg-pink-200/30 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="glass-panel p-6 rounded-2xl animate-pulse space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 bg-pink-200/60 dark:bg-slate-800 rounded w-1/4"></div>
          <div className="h-4 bg-pink-200/40 dark:bg-slate-800 rounded w-1/6"></div>
        </div>
        <div className="h-64 bg-pink-100/40 dark:bg-slate-800/50 rounded-xl flex items-end p-4 gap-4">
          <div className="h-1/3 bg-pink-300/40 rounded flex-1"></div>
          <div className="h-2/3 bg-pink-300/40 rounded flex-1"></div>
          <div className="h-1/2 bg-pink-300/40 rounded flex-1"></div>
          <div className="h-5/6 bg-pink-300/40 rounded flex-1"></div>
          <div className="h-3/4 bg-pink-300/40 rounded flex-1"></div>
        </div>
      </div>
    );
  }

  // Default table skeleton
  return (
    <div className="glass-panel rounded-2xl overflow-hidden p-4 space-y-3 animate-pulse">
      <div className="h-10 bg-pink-200/40 dark:bg-slate-800 rounded-lg w-full mb-4"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-2 border-b border-pink-100/40 dark:border-slate-800/40">
          <div className="h-4 bg-pink-200/50 dark:bg-slate-800 rounded w-1/6"></div>
          <div className="h-4 bg-pink-300/40 dark:bg-slate-700 rounded w-2/5"></div>
          <div className="h-4 bg-pink-200/40 dark:bg-slate-800 rounded w-1/6"></div>
          <div className="h-4 bg-pink-200/50 dark:bg-slate-800 rounded w-1/6"></div>
        </div>
      ))}
    </div>
  );
}
