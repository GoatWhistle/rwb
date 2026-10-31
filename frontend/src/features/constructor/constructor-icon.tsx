export function ConstructorIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="ctor-icon"
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="ctor-icon-a" x="2" y="2" width="7" height="7" rx="2" fill="#2348ff" />
      <rect className="ctor-icon-b" x="11" y="2" width="7" height="7" rx="2" fill="#8fb9fa" />
      <rect className="ctor-icon-c" x="2" y="11" width="7" height="7" rx="2" fill="#aa8cf5" />
      <g className="ctor-icon-d">
        <rect
          x="11.5"
          y="11.5"
          width="6"
          height="6"
          rx="1.75"
          fill="none"
          stroke="#2348ff"
          strokeWidth="1.2"
          strokeDasharray="2 1.6"
        />
        <path d="M14.5 13v3M13 14.5h3" stroke="#2348ff" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  )
}
