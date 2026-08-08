'use client'

interface Props {
  role: 'user' | 'assistant'
  content: string
  actions?: string[]
  onActionClick?: (action: string) => void
}

export default function ChatBubble({ role, content, actions, onActionClick }: Props) {
  if (role === 'user') {
    return (
      <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white sm:max-w-[65%]" style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}>
        {content}
      </div>
    )
  }

  return (
    <div className="flex max-w-[85%] items-start gap-2.5 sm:max-w-[75%]">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
      >
        AI
      </span>
      <div className="min-w-0 rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{content}</p>
        {actions && actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onActionClick?.(a)}
                className="rounded-full border border-[#6C3DE0]/25 bg-[#F5F3FF] px-3 py-1 text-xs font-semibold text-[#4338CA] transition-colors hover:bg-[#EDE9FE]"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
