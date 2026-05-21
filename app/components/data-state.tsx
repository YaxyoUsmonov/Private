"use client";

export function DataState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="mb-5 h-px overflow-hidden rounded-full bg-white/5">
        <div className="loading-sheen h-full w-1/3 rounded-full bg-gradient-to-r from-violet-400/0 via-violet-300/60 to-fuchsia-300/0" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-5 rounded-lg border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-[0_16px_40px_rgba(127,29,29,.16)]">
        {error}
      </div>
    );
  }

  return null;
}
