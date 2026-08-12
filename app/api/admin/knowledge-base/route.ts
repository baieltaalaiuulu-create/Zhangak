// Handles the "drag & drop учебники" upload flow end-to-end:
//   1. store the raw file in the 'knowledge-files' bucket
//   2. record it in ai_knowledge_files (status: processing)
//   3. extract text (txt/pdf/docx) and ask the AI gateway to generate ORT
//      practice questions from it
//   4. save the generated questions into daily_challenge_questions with
//      challenge_id = null (the standalone bank, same convention as
//      lib/practice-data.ts's bank tests) and mark the file 'ready'
//
// Requires SUPABASE_SERVICE_ROLE_KEY — same service-role write pattern as
// the rest of /api/admin/*.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createAIGateway } from '@/lib/ai-gateway'
import { requireAdminApi } from '@/lib/api-auth'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_SOURCE_CHARS = 6000
const GENERATED_PER_FILE = 8

const SUBJECTS = ['math', 'kyr', 'analogy', 'reading'] as const
type Subject = typeof SUBJECTS[number]

async function extractText(filename: string, buffer: Buffer): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'txt') return buffer.toString('utf-8')

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (ext === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text
  }

  throw new Error('Неподдерживаемый формат файла')
}

interface GeneratedQuestion {
  question_text: string
  subject: Subject
  topic?: string
  difficulty: 'easy' | 'medium' | 'hard'
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
}

function sanitizeQuestion(raw: unknown, fallbackSubject: Subject): GeneratedQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const subject = SUBJECTS.includes(r.subject as Subject) ? (r.subject as Subject) : fallbackSubject
  const letter = String(r.correct_answer ?? '').trim().toUpperCase().slice(0, 1)
  const correct = (['A', 'B', 'C', 'D'] as const).includes(letter as 'A' | 'B' | 'C' | 'D') ? (letter as 'A' | 'B' | 'C' | 'D') : null
  const difficulty = ['easy', 'medium', 'hard'].includes(r.difficulty as string) ? (r.difficulty as GeneratedQuestion['difficulty']) : 'medium'
  if (!correct || !r.question_text || !r.option_a || !r.option_b || !r.option_c || !r.option_d) return null
  return {
    question_text: String(r.question_text),
    subject,
    topic: r.topic ? String(r.topic) : undefined,
    difficulty,
    option_a: String(r.option_a),
    option_b: String(r.option_b),
    option_c: String(r.option_c),
    option_d: String(r.option_d),
    correct_answer: correct,
  }
}

async function generateFromText(text: string, subject: Subject): Promise<GeneratedQuestion[]> {
  const gateway = createAIGateway()
  const prompt = [
    `Изучи следующий учебный материал и составь ${GENERATED_PER_FILE} вопросов с вариантами ответов для подготовки к ОРТ (Кыргызстан), предмет: ${subject}.`,
    `Материал:\n"""\n${text.slice(0, MAX_SOURCE_CHARS)}\n"""`,
    'Ответь СТРОГО в формате JSON без markdown-обёртки:',
    '{"questions":[{"question_text":"...","topic":"...","difficulty":"medium","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A"}]}',
    'Поле correct_answer — одна из букв A, B, C, D. Вопросы на русском языке.',
  ].join('\n')

  const raw = await gateway.complete(
    [
      { role: 'system', content: 'Ты — генератор тестовых вопросов для образовательной платформы. Всегда отвечай валидным JSON.' },
      { role: 'user', content: prompt },
    ],
    { type: 'plan', jsonMode: true }
  )

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI вернул невалидный JSON')
    parsed = JSON.parse(match[0])
  }

  const list = (parsed as { questions?: unknown[] })?.questions
  if (!Array.isArray(list)) throw new Error('AI не вернул список вопросов')
  return list.map(q => sanitizeQuestion(q, subject)).filter((q): q is GeneratedQuestion => q !== null)
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  const supabaseAdmin = getAdminClient()
  let fileRecordId: string | null = null

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const subject = (form.get('subject') as string | null) ?? 'math'
    if (!file) return NextResponse.json({ error: 'Файл обязателен' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Файл слишком большой (макс. 50 МБ)' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error: uploadError } = await supabaseAdmin.storage.from('knowledge-files').upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
    })
    if (uploadError) return NextResponse.json({ error: `Не удалось загрузить файл: ${uploadError.message}` }, { status: 400 })

    const { data: fileUrlData } = supabaseAdmin.storage.from('knowledge-files').getPublicUrl(storagePath)

    const { data: fileRecord, error: insertError } = await supabaseAdmin
      .from('ai_knowledge_files')
      .insert({
        filename: file.name,
        subject,
        file_url: fileUrlData.publicUrl,
        file_size: file.size,
        status: 'processing',
      })
      .select('id')
      .single()
    if (insertError || !fileRecord) return NextResponse.json({ error: insertError?.message ?? 'Не удалось создать запись файла' }, { status: 400 })
    fileRecordId = fileRecord.id

    // Extraction + generation failures shouldn't crash the request — the
    // file is already uploaded and recorded, so mark it 'error' and let the
    // admin retry via "Обновить" instead of losing the upload.
    try {
      const text = await extractText(file.name, buffer)
      if (!text.trim()) throw new Error('Не удалось извлечь текст из файла')

      const questions = await generateFromText(text, subject as Subject)
      if (questions.length === 0) throw new Error('AI не сгенерировал вопросы')

      const rows = questions.map((q, i) => ({ challenge_id: null, ...q, ai_generated: true, order_num: i + 1 }))
      const { error: qError } = await supabaseAdmin.from('daily_challenge_questions').insert(rows)
      if (qError) throw new Error(qError.message)

      await supabaseAdmin
        .from('ai_knowledge_files')
        .update({ status: 'ready', questions_generated: rows.length, processed_at: new Date().toISOString() })
        .eq('id', fileRecordId)

      return NextResponse.json({ id: fileRecordId, questionsGenerated: rows.length })
    } catch (processingError) {
      await supabaseAdmin.from('ai_knowledge_files').update({ status: 'error' }).eq('id', fileRecordId)
      const message = processingError instanceof Error ? processingError.message : 'Ошибка обработки файла'
      return NextResponse.json({ id: fileRecordId, error: message }, { status: 200 })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Re-process an already-uploaded file (the "Обновить" action) — re-reads
// the stored file from the bucket rather than requiring a fresh upload.
export async function PATCH(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  const supabaseAdmin = getAdminClient()
  let fileId: string | undefined
  try {
    const body = await req.json()
    fileId = body.id
    if (!fileId) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
    const id = fileId

    const { data: fileRecord } = await supabaseAdmin.from('ai_knowledge_files').select('*').eq('id', id).single()
    if (!fileRecord) return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })

    await supabaseAdmin.from('ai_knowledge_files').update({ status: 'processing' }).eq('id', id)

    const storagePath = fileRecord.file_url?.split('/knowledge-files/')?.[1]
    if (!storagePath) throw new Error('Не удалось определить путь файла в хранилище')

    const { data: downloaded, error: downloadError } = await supabaseAdmin.storage.from('knowledge-files').download(storagePath)
    if (downloadError || !downloaded) throw new Error(downloadError?.message ?? 'Не удалось скачать файл')

    const buffer = Buffer.from(await downloaded.arrayBuffer())
    const text = await extractText(fileRecord.filename, buffer)
    if (!text.trim()) throw new Error('Не удалось извлечь текст из файла')

    const questions = await generateFromText(text, (fileRecord.subject as Subject) ?? 'math')
    if (questions.length === 0) throw new Error('AI не сгенерировал вопросы')

    const rows = questions.map((q, i) => ({ challenge_id: null, ...q, ai_generated: true, order_num: i + 1 }))
    const { error: qError } = await supabaseAdmin.from('daily_challenge_questions').insert(rows)
    if (qError) throw new Error(qError.message)

    await supabaseAdmin
      .from('ai_knowledge_files')
      .update({ status: 'ready', questions_generated: (fileRecord.questions_generated ?? 0) + rows.length, processed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ success: true, questionsGenerated: rows.length })
  } catch (e) {
    if (fileId) await supabaseAdmin.from('ai_knowledge_files').update({ status: 'error' }).eq('id', fileId)
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
