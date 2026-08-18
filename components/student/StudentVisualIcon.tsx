interface StudentVisualIconProps {
  name: string
  size?: number
  color?: string
  filled?: boolean
  className?: string
}

/** Material Symbols Rounded icon used by the approved student prototype. */
export default function StudentVisualIcon({
  name,
  size = 22,
  color,
  filled = true,
  className = '',
}: StudentVisualIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`student-ms shrink-0 ${className}`}
      style={{
        color,
        fontSize: size,
        fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" 500, "GRAD" 0, "opsz" 24`,
      }}
    >
      {name}
    </span>
  )
}
