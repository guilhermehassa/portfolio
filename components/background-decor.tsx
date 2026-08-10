export function BackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-700/25" />
      <div className="absolute -right-24 top-64 h-80 w-80 rounded-full bg-slate-300/35 blur-3xl dark:bg-slate-700/30" />
      <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl dark:bg-brand-400/15" />
    </div>
  );
}
