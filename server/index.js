import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { digitize, gradeAttempt } from './ai.js'
import { readUpload } from './parseDocument.js'
import { buildOverview, connectDb, readState, update } from './store.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env') })

const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  console.error('Node.js 20 or newer is required. Run: nvm use')
  process.exit(1)
}

const app = express()
const port = Number(process.env.PORT) || 4000
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Ensure MongoDB is connected for incoming requests (crucial for serverless environments)
app.use(async (_req, _res, next) => {
  try {
    await connectDb()
    next()
  } catch (error) {
    next(error)
  }
})

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

const adminSessions = new Set()

function getAdminSecret() {
  return process.env.ADMIN_PASSWORD || 'question-desk-session-secret'
}

function createAdminToken() {
  const timestamp = Date.now().toString()
  const signature = crypto.createHmac('sha256', getAdminSecret()).update(timestamp).digest('hex')
  const token = `${timestamp}.${signature}`
  adminSessions.add(token)
  return token
}

function sameSecret(received, expected) {
  const left = Buffer.from(String(received))
  const right = Buffer.from(String(expected))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function isValidAdminToken(token) {
  if (!token) return false
  if (adminSessions.has(token)) return true
  const parts = String(token).split('.')
  if (parts.length !== 2) return false
  const [timestamp, signature] = parts
  const expectedSig = crypto.createHmac('sha256', getAdminSecret()).update(timestamp).digest('hex')
  if (!sameSecret(signature, expectedSig)) return false
  return Date.now() - Number(timestamp) < 7 * 24 * 60 * 60 * 1000
}

function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || ''
  if (!isValidAdminToken(token)) {
    return next(httpError(401, 'Sign in with the admin email and password.'))
  }
  next()
}

app.post('/api/admin/login', (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const expectedEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const expectedPassword = String(process.env.ADMIN_PASSWORD || '')
  if (!expectedEmail || !expectedPassword) {
    return next(httpError(503, 'Set ADMIN_EMAIL and ADMIN_PASSWORD in the .env file.'))
  }
  const emailMatches = sameSecret(email, expectedEmail)
  const passwordMatches = sameSecret(password, expectedPassword)
  if (!emailMatches || !passwordMatches) {
    return next(httpError(401, 'That email or password is not valid.'))
  }
  const token = createAdminToken()
  res.json({ token })
})

function validIdentity(name, email) {
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw httpError(400, 'Enter your name (at least 2 characters).')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw httpError(400, 'Enter a valid email address.')
  }
  return { name: cleanName, email: cleanEmail }
}

function publicPaper(paper) {
  const totalMarks = paper.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0)
  return {
    id: paper.id,
    title: paper.title,
    createdAt: paper.createdAt,
    questionCount: paper.questions.length,
    totalMarks
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: 'questiondesk' })
})

app.get('/api/papers', async (_req, res, next) => {
  try {
    const state = await readState()
    res.json({
      papers: [...state.papers]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(publicPaper)
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/papers/:id', async (req, res, next) => {
  const paper = (await readState()).papers.find((item) => item.id === req.params.id)
  if (!paper) return next(httpError(404, 'That question paper is no longer available.'))
  res.json({
    ...publicPaper(paper),
    questions: paper.questions.map((question) => ({
      id: question.id,
      number: question.number,
      prompt: question.prompt,
      marks: question.marks,
      kind: question.kind
    }))
  })
})

app.post('/api/attempts', async (req, res, next) => {
  try {
    const { name, email } = validIdentity(req.body?.name, req.body?.email)
    const paper = (await readState()).papers.find((item) => item.id === req.body?.paperId)
    if (!paper) throw httpError(404, 'That question paper is no longer available.')

    const incoming = Array.isArray(req.body?.answers) ? req.body.answers : []
    const responses = {}
    for (const item of incoming) {
      if (!item || typeof item.questionId !== 'string') continue
      responses[item.questionId] = String(item.response || '').slice(0, 8000)
    }

    const answered = paper.questions.some((question) => String(responses[question.id] || '').trim())
    if (!answered) throw httpError(400, 'Write an answer for at least one question.')

    const graded = await gradeAttempt(paper.questions, responses)
    const attempt = {
      id: crypto.randomUUID(),
      paperId: paper.id,
      name,
      email,
      submittedAt: new Date().toISOString(),
      gradedBy: 'gemini',
      answers: graded
    }

    const saved = await update((state) => ({
      state: { ...state, attempts: [...state.attempts, attempt] },
      result: attempt
    }))

    const totalAwarded = saved.answers.reduce((sum, answer) => sum + answer.awardedMarks, 0)
    const totalMarks = saved.answers.reduce((sum, answer) => sum + answer.maxMarks, 0)
    res.status(201).json({
      id: saved.id,
      submittedAt: saved.submittedAt,
      totalAwarded: Math.round(totalAwarded * 10) / 10,
      totalMarks,
      percent: totalMarks ? Math.round((totalAwarded / totalMarks) * 100) : 0,
      correctCount: saved.answers.filter((answer) => answer.isCorrect).length,
      questionCount: saved.answers.length,
      answers: saved.answers.map((answer) => ({
        questionId: answer.questionId,
        awardedMarks: answer.awardedMarks,
        maxMarks: answer.maxMarks,
        relevancy: answer.relevancy,
        isCorrect: answer.isCorrect,
        feedback: answer.feedback
      }))
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/overview', requireAdmin, async (_req, res, next) => {
  try {
    res.json(buildOverview(await readState()))
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/upload', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw httpError(400, 'Choose a file to upload.')
    const source = await readUpload(req.file)
    const paper = await digitize(source)
    const saved = await update((state) => ({
      state: { ...state, papers: [paper, ...state.papers] },
      result: paper
    }))
    res.status(201).json({
      id: saved.id,
      title: saved.title,
      questionCount: saved.questions.length
    })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/admin/questions/:id', requireAdmin, async (req, res, next) => {
  try {
    const questionId = req.params.id
    const prompt = req.body?.prompt !== undefined ? String(req.body.prompt).trim() : undefined
    const answerKey = req.body?.answerKey !== undefined ? String(req.body.answerKey).trim() : undefined
    const marks = req.body?.marks !== undefined ? Number(req.body.marks) : undefined
    if (prompt !== undefined && !prompt) throw httpError(400, 'Question text cannot be empty.')
    if (marks !== undefined && (!Number.isFinite(marks) || marks <= 0 || marks > 100)) {
      throw httpError(400, 'Marks must be a number from 1 to 100.')
    }

    const updated = await update((state) => {
      let found = false
      const papers = state.papers.map((paper) => ({
        ...paper,
        questions: paper.questions.map((question) => {
          if (question.id !== questionId) return question
          found = true
          return {
            ...question,
            prompt: prompt !== undefined ? prompt : question.prompt,
            answerKey: answerKey !== undefined ? answerKey : question.answerKey,
            marks: marks !== undefined ? marks : question.marks
          }
        })
      }))
      if (!found) {
        throw httpError(404, 'Question not found.')
      }
      const question = papers.flatMap((paper) => paper.questions).find((item) => item.id === questionId)
      return { state: { ...state, papers }, result: question }
    })
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/papers/:id', requireAdmin, async (req, res, next) => {
  try {
    const paperId = req.params.id
    await update((state) => {
      const exists = state.papers.some((paper) => paper.id === paperId)
      if (!exists) throw httpError(404, 'Question paper not found.')
      return {
        state: {
          papers: state.papers.filter((paper) => paper.id !== paperId),
          attempts: state.attempts.filter((attempt) => attempt.paperId !== paperId)
        },
        result: true
      }
    })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

const clientDist = path.join(root, 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is larger than 12 MB.' })
  }
  const status = error.status || 500
  if (status >= 500) console.error(error)
  res.status(status).json({ error: error.message || 'Something went wrong.' })
})

if (!process.env.VERCEL) {
  connectDb()
    .then(() => {
      app.listen(port, () => {
        console.log(`Question Desk API on http://127.0.0.1:${port}`)
        console.log('MongoDB database: questiondesk')
      })
    })
    .catch((error) => {
      const message = String(error?.message || error).replace(/\/\/[^@\s]+@/, '//***@')
      console.error(`MongoDB connection failed. ${message}`)
      process.exit(1)
    })
}

export default app
