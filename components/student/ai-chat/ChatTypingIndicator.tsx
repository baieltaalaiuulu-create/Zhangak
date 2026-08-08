export default function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
      >
        AI
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="animate-ai-typing-dot h-2 w-2 rounded-full"
            style={{ background: '#6C3DE0', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
