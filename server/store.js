import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const legacyFile = path.join(root, 'data', 'store.json')

let client
let db

function stripId(document) {
  if (!document) return document
  const { _id, ...rest } = document
  return rest
}

export async function connectDb() {
  if (db) return db.databaseName
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('Set MONGODB_URI in the .env file.')
  }
  client = new MongoClient(uri)
  await client.connect()
  db = client.db()
  await db.command({ ping: 1 })
  await db.collection('papers').createIndex({ id: 1 }, { unique: true })
  await db.collection('attempts').createIndex({ id: 1 }, { unique: true })
  await db.collection('attempts').createIndex({ paperId: 1, submittedAt: -1 })
  await importLegacyFile()
  return db.databaseName
}

export async function readState() {
  const [papers, attempts] = await Promise.all([
    db.collection('papers').find({}).toArray(),
    db.collection('attempts').find({}).toArray()
  ])
  return {
    papers: papers.map(stripId),
    attempts: attempts.map(stripId)
  }
}

async function writeState(state) {
  const papers = db.collection('papers')
  const attempts = db.collection('attempts')
  await papers.deleteMany({})
  await attempts.deleteMany({})
  if (state.papers.length) await papers.insertMany(state.papers)
  if (state.attempts.length) await attempts.insertMany(state.attempts)
}

let chain = Promise.resolve()

export function update(reducer) {
  const run = chain.then(async () => {
    const current = await readState()
    const { state, result } = reducer(current)
    await writeState(state)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function importLegacyFile() {
  const existing = await db.collection('papers').countDocuments()
  if (existing) return
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(legacyFile, 'utf8'))
  } catch {
    return
  }
  const papers = Array.isArray(parsed.papers) ? parsed.papers : []
  const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : []
  if (!papers.length && !attempts.length) return
  await writeState({ papers, attempts })
}

function roundScore(value) {
  return Math.round(Number(value) * 10) / 10
}

export function decorateAttempt(attempt) {
  const totalAwarded = roundScore(
    attempt.answers.reduce((sum, answer) => sum + Number(answer.awardedMarks || 0), 0)
  )
  const totalMarks = roundScore(
    attempt.answers.reduce((sum, answer) => sum + Number(answer.maxMarks || 0), 0)
  )
  const correctCount = attempt.answers.filter((answer) => answer.isCorrect).length
  return {
    ...attempt,
    totalAwarded,
    totalMarks,
    correctCount,
    questionCount: attempt.answers.length,
    percent: totalMarks ? Math.round((totalAwarded / totalMarks) * 100) : 0
  }
}

export function buildOverview(state) {
  const papers = [...state.papers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const detailed = papers.map((paper) => {
    const paperAttempts = state.attempts
      .filter((attempt) => attempt.paperId === paper.id)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
      .map(decorateAttempt)

    const questions = paper.questions.map((question) => {
      const responses = []
      for (const attempt of paperAttempts) {
        const answer = attempt.answers.find((item) => item.questionId === question.id)
        if (!answer) continue
        responses.push({
          attemptId: attempt.id,
          name: attempt.name,
          email: attempt.email,
          submittedAt: attempt.submittedAt,
          response: answer.response,
          awardedMarks: answer.awardedMarks,
          maxMarks: answer.maxMarks,
          relevancy: answer.relevancy,
          isCorrect: answer.isCorrect,
          feedback: answer.feedback
        })
      }
      const correct = responses.filter((item) => item.isCorrect).length
      return {
        ...question,
        stats: {
          attempts: responses.length,
          correct,
          incorrect: responses.length - correct
        },
        responses
      }
    })

    return {
      ...paper,
      questions,
      attemptCount: paperAttempts.length,
      uniqueStudents: new Set(paperAttempts.map((attempt) => attempt.email)).size,
      attempts: paperAttempts
    }
  })

  const allAttempts = state.attempts.map(decorateAttempt)
  const scored = allAttempts.filter((attempt) => attempt.totalMarks > 0)
  const averageScorePercent = scored.length
    ? Math.round(scored.reduce((sum, attempt) => sum + attempt.percent, 0) / scored.length)
    : 0

  return {
    stats: {
      papers: state.papers.length,
      questions: state.papers.reduce((sum, paper) => sum + paper.questions.length, 0),
      attempts: state.attempts.length,
      uniqueStudents: new Set(state.attempts.map((attempt) => attempt.email)).size,
      averageScorePercent
    },
    papers: detailed
  }
}
