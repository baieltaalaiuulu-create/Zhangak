import type { PanelData, ErrorReviewItem } from '@/lib/ai-chat-panel-data'
import GoalProgressCard from './panel/GoalProgressCard'
import MiniStatsRow from './panel/MiniStatsRow'
import RecommendationsCard from './panel/RecommendationsCard'
import TopicProgressCard from './panel/TopicProgressCard'
import ErrorReviewCard from './panel/ErrorReviewCard'
import NextMockCard from './panel/NextMockCard'
import MemoryTraitsCard from './panel/MemoryTraitsCard'

interface Props {
  data: PanelData
  onReviewError: (item: ErrorReviewItem) => void
}

export default function AnalyticsPanel({ data, onReviewError }: Props) {
  return (
    <div className="h-full space-y-4 overflow-y-auto bg-[#F4F6FA] p-4">
      <GoalProgressCard goal={data.goal} />
      <MiniStatsRow stats={data.miniStats} />
      <RecommendationsCard recommendations={data.recommendations} />
      <TopicProgressCard title="Слабые темы" topics={data.weakTopics} tone="weak" />
      <TopicProgressCard title="Сильные стороны" topics={data.strongTopics} tone="strong" />
      <ErrorReviewCard items={data.errorReview} onReview={onReviewError} />
      <NextMockCard info={data.nextMock} />
      <MemoryTraitsCard traits={data.memoryTraits} />
    </div>
  )
}
