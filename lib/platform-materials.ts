import { zhangakApiRequest } from './zhangak-api-client.ts'

export type PlatformLessonMaterialType = 'rich_text' | 'video' | 'document' | 'image'

export interface PlatformLessonMaterial {
  id: number
  lessonId: number
  materialType: PlatformLessonMaterialType
  title: string
  position: number
  bodyMarkdown: string | null
  externalUrl: string | null
  mimeType: string | null
  byteSize: number | null
  viewerPath: string | null
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ материалов')
  return value as Record<string, unknown>
}

function positive(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('Некорректный материал')
  return value as number
}

function nullableString(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('Некорректный материал')
  return value
}

function parseMaterial(value: unknown): PlatformLessonMaterial {
  const source = record(value)
  const materialType = source.materialType
  if (!['rich_text', 'video', 'document', 'image'].includes(String(materialType))) throw new Error('Некорректный материал')
  const title = source.title
  if (typeof title !== 'string' || title.trim() === '') throw new Error('Некорректный материал')
  const viewerPath = nullableString(source.viewerPath)
  if (viewerPath !== null && !/^\/v1\/platform\/materials\/\d+\/content$/.test(viewerPath)) throw new Error('Некорректный путь просмотра')
  return {
    id: positive(source.id), lessonId: positive(source.lessonId), materialType: materialType as PlatformLessonMaterialType,
    title, position: positive(source.position), bodyMarkdown: nullableString(source.bodyMarkdown),
    externalUrl: nullableString(source.externalUrl), mimeType: nullableString(source.mimeType),
    byteSize: source.byteSize === null ? null : positive(source.byteSize), viewerPath,
  }
}

export async function fetchPlatformLessonMaterials(lessonId: string): Promise<PlatformLessonMaterial[]> {
  if (!/^\d+$/.test(lessonId)) throw new Error('Некорректный id урока')
  const source = record(await zhangakApiRequest<unknown>(`/v1/platform/lessons/${lessonId}/materials`))
  if (!Array.isArray(source.items)) throw new Error('Некорректный ответ материалов')
  return source.items.map(parseMaterial)
}
