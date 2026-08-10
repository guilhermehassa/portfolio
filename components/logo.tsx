export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Logo H"
    >
      <rect x="6" y="6" width="116" height="116" fill="url(#logo-h-gradient)" />
      <path d="M36 28V100" stroke="white" strokeWidth="12" strokeLinecap="square" />
      <path d="M92 28V100" stroke="white" strokeWidth="12" strokeLinecap="square" />
      <path d="M36 64H92" stroke="white" strokeWidth="12" strokeLinecap="square" />
      <defs>
        <linearGradient id="logo-h-gradient" x1="6" y1="6" x2="122" y2="122" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1d3b8f" />
          <stop offset="1" stopColor="#0f1b36" />
        </linearGradient>
      </defs>
    </svg>
  );
}
