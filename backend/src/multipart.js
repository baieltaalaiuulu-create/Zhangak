import Busboy from 'busboy'

import { HttpError } from './http.js'
import { materialKey, removePrivateObject, safeFilename, storePrivateStream } from './storage.js'

const MAX_PDF_BYTES = 200 * 1024 * 1024
const MAX_IMAGE_BYTES = 30 * 1024 * 1024

function text(value, field) {
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректная форма загрузки', `invalid_${field}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > 300) throw new HttpError(400, 'Некорректная форма загрузки', `invalid_${field}`)
  return normalized
}

export async function receiveMaterialUpload(req, config, lessonId) {
  const fields = {}
  const key = materialKey(lessonId)
  let received = null
  let fileCount = 0
  let fileLimited = false

  try {
    await new Promise((resolve, reject) => {
      let parser
      try {
        parser = Busboy({
          headers: req.headers,
          limits: { files: 1, fields: 4, fieldSize: 50_000, fileSize: MAX_PDF_BYTES, parts: 6 },
        })
      } catch {
        reject(new HttpError(415, 'Требуется multipart/form-data', 'unsupported_media_type'))
        return
      }
      parser.on('field', (name, value) => {
        if (!['materialType', 'title', 'position', 'isPublished'].includes(name) || Object.hasOwn(fields, name)) {
          reject(new HttpError(400, 'Некорректная форма загрузки', 'invalid_material_upload'))
          return
        }
        fields[name] = value
      })
      parser.on('file', (name, file, info) => {
        fileCount += 1
        if (name !== 'file' || fileCount > 1) {
          file.resume()
          reject(new HttpError(400, 'Нужен ровно один файл', 'invalid_material_upload'))
          return
        }
        file.on('limit', () => { fileLimited = true })
        received = storePrivateStream(config, key, file, MAX_PDF_BYTES)
          .then(fileInfo => ({ ...fileInfo, originalFilename: safeFilename(info.filename), declaredMimeType: info.mimeType }))
          .catch(reject)
      })
      parser.once('filesLimit', () => reject(new HttpError(400, 'Нужен ровно один файл', 'invalid_material_upload')))
      parser.once('fieldsLimit', () => reject(new HttpError(400, 'Слишком много полей формы', 'invalid_material_upload')))
      parser.once('partsLimit', () => reject(new HttpError(400, 'Слишком много частей формы', 'invalid_material_upload')))
      parser.once('error', () => reject(new HttpError(400, 'Не удалось разобрать форму', 'invalid_material_upload')))
      parser.once('finish', resolve)
      req.pipe(parser)
    })
    if (fileCount !== 1 || !received || fileLimited) throw new HttpError(413, 'Файл превышает допустимый размер', 'material_too_large')
    const file = await received
    const materialType = text(fields.materialType, 'material_type')
    if (materialType !== file.materialType) throw new HttpError(415, 'Тип файла не совпадает с выбранным материалом', 'material_type_mismatch')
    if (file.materialType === 'image' && file.bytes > MAX_IMAGE_BYTES) throw new HttpError(413, 'Изображение не может быть больше 30 MiB', 'material_too_large')
    if (file.materialType === 'document' && file.bytes > MAX_PDF_BYTES) throw new HttpError(413, 'PDF не может быть больше 200 MiB', 'material_too_large')
    return { key, fields, file }
  } catch (error) {
    await removePrivateObject(config, key).catch(() => {})
    throw error
  }
}
