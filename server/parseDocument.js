import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import mammoth from 'mammoth'
import WordExtractor from 'word-extractor'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const TEXT_EXTENSIONS = new Set(['.txt', '.md'])

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function extensionOf(filename) {
  return path.extname(filename || '').toLowerCase()
}

export function assertSupportedFile(file) {
  const extension = extensionOf(file.originalname)
  const allowed = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', ...IMAGE_EXTENSIONS])
  if (!allowed.has(extension)) {
    throw httpError(
      400,
      'Upload a PDF, Word document, text file, or an image (JPEG, PNG, WEBP, GIF).'
    )
  }
  if (IMAGE_EXTENSIONS.has(extension) && file.size > 8 * 1024 * 1024) {
    throw httpError(400, 'Images must be under 8 MB.')
  }
}

export async function readUpload(file) {
  assertSupportedFile(file)
  const extension = extensionOf(file.originalname)
  const filename = path.basename(file.originalname)

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      mode: 'image',
      filename,
      mime: file.mimetype || 'image/jpeg',
      base64: file.buffer.toString('base64')
    }
  }

  const text = await extractText(file, extension)
  const cleaned = text.replace(/\u0000/g, '').trim()
  if (cleaned.length < 20) {
    throw httpError(
      400,
      extension === '.pdf'
        ? 'This PDF has almost no readable text. It may be a scan. Upload a page image (JPEG or PNG) instead.'
        : 'No readable text was found in that file.'
    )
  }

  return {
    mode: 'text',
    filename,
    text: cleaned.slice(0, 80000)
  }
}

async function extractText(file, extension) {
  if (extension === '.pdf') {
    const parsed = await pdfParse(file.buffer)
    return parsed.text || ''
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return file.buffer.toString('utf8')
  }
  if (extension === '.docx') {
    try {
      const parsed = await mammoth.extractRawText({ buffer: file.buffer })
      if (parsed.value && parsed.value.trim()) return parsed.value
    } catch {
      // Fall through to the Word extractor.
    }
  }
  return extractWordFile(file)
}

async function extractWordFile(file) {
  const tempPath = path.join(
    os.tmpdir(),
    `question-desk-${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname)}`
  )
  await fs.promises.writeFile(tempPath, file.buffer)
  try {
    const extractor = new WordExtractor()
    const document = await extractor.extract(tempPath)
    return document.getBody() || ''
  } finally {
    await fs.promises.unlink(tempPath).catch(() => undefined)
  }
}
