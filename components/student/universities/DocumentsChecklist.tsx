import { CalendarClock, ExternalLink, FileCheck } from 'lucide-react'

interface Props {
  documents: string[]
  deadline: string
  officialWebsite: string
}

export default function DocumentsChecklist({ documents, deadline, officialWebsite }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Необходимые документы</h3>
        <ul className="mt-3 space-y-2.5">
          {documents.map((doc, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
              <FileCheck size={16} className="mt-0.5 shrink-0 text-green-600" />
              {doc}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900">Сроки подачи</h3>
        <div className="mt-3 flex items-start gap-3 rounded-xl bg-[#EEF2FF] p-4">
          <CalendarClock size={20} className="mt-0.5 shrink-0 text-[#4338CA]" />
          <p className="text-sm font-medium text-[#4338CA]">{deadline}</p>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Сроки могут отличаться по отдельным программам — уточняй актуальные даты в приёмной комиссии перед подачей.
        </p>
        {officialWebsite && (
          <a
            href={officialWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#4338CA] hover:underline"
          >
            Официальный сайт <ExternalLink size={15} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}
