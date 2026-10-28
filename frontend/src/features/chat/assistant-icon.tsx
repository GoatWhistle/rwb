export function AssistantIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="assistant-icon"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <g className="assistant-icon-plate">
        <path d="M2 17L16 24V27L2 20Z" fill="#6A43D8" />
        <path d="M16 24L30 17V20L16 27Z" fill="#5634BF" />
        <path d="M6 22L12 25L5 29Z" fill="#6A43D8" />
        <path d="M16 10L30 17L16 24L2 17Z" fill="#B39CFF" />
      </g>
      <g className="assistant-icon-cube">
        <path d="M9 8L16 11.5V18.5L9 15Z" fill="#2348FF" />
        <path d="M16 11.5L23 8V15L16 18.5Z" fill="#1A36CC" />
        <path d="M16 4.5L23 8L16 11.5L9 8Z" fill="#7D93FF" />
      </g>
    </svg>
  )
}
