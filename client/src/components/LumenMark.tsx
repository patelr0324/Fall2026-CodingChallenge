export function LumenMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden
      role="presentation"
    >
      <rect x="1.5" y="1.5" width="33" height="33" rx="10" fill="#ffe0d6" stroke="#e86a4a" strokeWidth="1.5" />
      <path
        d="M18 9.5v17M9.5 18h17"
        stroke="#e86a4a"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <circle cx="18" cy="18" r="3.25" fill="#4f8f8a" />
    </svg>
  )
}
