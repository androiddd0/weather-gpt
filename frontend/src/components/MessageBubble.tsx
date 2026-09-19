import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
  role: 'user' | 'assistant'
  tools?: string[]
  offline?: boolean
}

export function MessageBubble({ content, role, tools, offline }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 fade-in`}>
      <div className={`${isUser ? 'max-w-[75%]' : 'w-full max-w-[85%]'}`}>
        {isUser ? (
          <div className="glass-strong rounded-2xl rounded-br-md px-4 py-2.5 shadow-lg">
            <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium text-white dark:text-white/90">{content}</p>
          </div>
        ) : (
          <div className="glass rounded-2xl rounded-bl-md px-4 py-3 shadow-lg">
            <div className="text-sm leading-relaxed text-white dark:text-white/90 prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0 prose-headings:my-2 prose-strong:text-white dark:prose-strong:text-white/95">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
            {(offline || (tools && tools.length > 0)) && (
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/15">
                {offline && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/60 font-medium">
                    offline
                  </span>
                )}
                {tools?.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-medium">
                    {t.replace('get_', '')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
