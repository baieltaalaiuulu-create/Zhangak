import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { HttpError } from './http.js'

const KEY = /^[a-z0-9][a-z0-9/_-]{0,511}$/

function root(config) {
  if (!config.storageRoot) throw new HttpError(503, 'Хранилище материалов ещё не настроено', 'storage_unavailable')
  return config.storageRoot
}

export function materialKey(lessonId) {
  return `lesson/${lessonId}/${randomUUID()}`
}

export function safeFilename(value) {
  const name = path.basename(String(value ?? '')).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim()
  if (!name || name.length > 255) throw new HttpError(400, 'Некорректное имя файла', 'invalid_material_filename')
  return name
}

export function inspectMaterial(buffer) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { materialType: 'document', mimeType: 'application/pdf' }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { materialType: 'image', mimeType: 'image/png' }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return { materialType: 'image', mimeType: 'image/jpeg' }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { materialType: 'image', mimeType: 'image/webp' }
  throw new HttpError(415, 'Поддерживаются только PDF, PNG, JPEG и WebP', 'unsupported_material_file')
}

export async function storePrivateStream(config, key, source, maxBytes) {
  if (!KEY.test(key)) throw new HttpError(500, 'Некорректный ключ хранилища', 'invalid_storage_key')
  const storageRoot = root(config)
  const destination = path.resolve(storageRoot, key)
  const relative = path.relative(storageRoot, destination)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new HttpError(500, 'Некорректный путь хранилища', 'invalid_storage_path')
  const tempDir = path.join(storageRoot, '.tmp')
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 })
  await mkdir(tempDir, { recursive: true, mode: 0o700 })
  const temporary = path.join(tempDir, randomUUID())
  let bytes = 0
  const hash = createHash('sha256')
  const sample = []
  let sampleSize = 0
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length
      if (bytes > maxBytes) return callback(new HttpError(413, 'Файл превышает допустимый размер', 'material_too_large'))
      hash.update(chunk)
      if (sampleSize < 32) {
        const part = chunk.subarray(0, 32 - sampleSize)
        sample.push(part)
        sampleSize += part.length
      }
      callback(null, chunk)
    },
  })
  try {
    await pipeline(source, meter, createWriteStream(temporary, { mode: 0o600, flags: 'wx' }))
    const detected = inspectMaterial(Buffer.concat(sample))
    await rename(temporary, destination)
    return { bytes, sha256: hash.digest('hex'), ...detected }
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'Не удалось принять файл', 'material_upload_failed')
  }
}

export async function privateFile(config, key) {
  if (!KEY.test(key)) throw new HttpError(404, 'Материал не найден', 'material_not_found')
  const storageRoot = root(config)
  const file = path.resolve(storageRoot, key)
  const relative = path.relative(storageRoot, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new HttpError(404, 'Материал не найден', 'material_not_found')
  try {
    const handle = await open(file, 'r')
    const stat = await handle.stat()
    await handle.close()
    return { size: stat.size, stream: createReadStream(file) }
  } catch {
    throw new HttpError(404, 'Файл материала не найден', 'material_file_missing')
  }
}

export async function removePrivateObject(config, key) {
  if (!KEY.test(key)) return
  const storageRoot = root(config)
  const file = path.resolve(storageRoot, key)
  const relative = path.relative(storageRoot, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return
  await rm(file, { force: true })
}
