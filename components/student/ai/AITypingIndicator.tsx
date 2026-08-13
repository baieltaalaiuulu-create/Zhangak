export default function AITypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-3">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="animate-ai-typing-dot h-2 w-2 rounded-full bg-[#1B3F92]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}
