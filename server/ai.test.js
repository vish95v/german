import test from 'node:test'
import assert from 'node:assert/strict'
import { applyGrade, normalizePaper } from './ai.js'
import { buildOverview } from './store.js'

test('normalizePaper keeps marks, prompts, and drops blanks', () => {
  const paper = normalizePaper(
    {
      title: 'Science',
      questions: [
        { number: '2', prompt: '  What is a cell? ', marks: '4', answerKey: 'Basic unit of life', kind: 'short' },
        { prompt: '   ', marks: 5 },
        { question: 'Name one gas in air.', marks: 0, answer: 'Nitrogen' }
      ]
    },
    'paper.pdf'
  )

  assert.equal(paper.title, 'Science')
  assert.equal(paper.questions.length, 2)
  assert.equal(paper.questions[0].marks, 4)
  assert.equal(paper.questions[0].number, 2)
  assert.equal(paper.questions[1].marks, 1)
  assert.equal(paper.questions[1].answerKey, 'Nitrogen')
})

test('applyGrade marks a blank wrong and clamps a weak match', () => {
  const questions = [
    { id: 'q1', marks: 5 },
    { id: 'q2', marks: 2 }
  ]
  const graded = applyGrade(
    questions,
    { q1: 'plants make food with sunlight', q2: '   ' },
    [
      {
        questionId: 'q1',
        relevancy: 40,
        awardedMarks: 9,
        isCorrect: true,
        feedback: 'Only the sunlight idea is present.'
      }
    ]
  )

  assert.equal(graded[0].awardedMarks, 5)
  assert.equal(graded[0].isCorrect, false)
  assert.equal(graded[1].awardedMarks, 0)
  assert.equal(graded[1].isCorrect, false)
  assert.match(graded[1].feedback, /No answer/)
})

test('buildOverview counts correct answers per question and unique students', () => {
  const overview = buildOverview({
    papers: [
      {
        id: 'p1',
        title: 'Science',
        filename: 's.txt',
        createdAt: '2026-01-01T00:00:00.000Z',
        questions: [{ id: 'q1', number: 1, prompt: 'Gas?', marks: 2, answerKey: 'Oxygen', kind: 'short' }]
      }
    ],
    attempts: [
      {
        id: 'a1',
        paperId: 'p1',
        name: 'Ada',
        email: 'ada@school.edu',
        submittedAt: '2026-01-02T00:00:00.000Z',
        answers: [
          {
            questionId: 'q1',
            response: 'Oxygen',
            awardedMarks: 2,
            maxMarks: 2,
            relevancy: 100,
            isCorrect: true,
            feedback: 'Correct.'
          }
        ]
      },
      {
        id: 'a2',
        paperId: 'p1',
        name: 'Bea',
        email: 'bea@school.edu',
        submittedAt: '2026-01-03T00:00:00.000Z',
        answers: [
          {
            questionId: 'q1',
            response: 'Nitrogen',
            awardedMarks: 0,
            maxMarks: 2,
            relevancy: 10,
            isCorrect: false,
            feedback: 'That is a different gas.'
          }
        ]
      }
    ]
  })

  assert.equal(overview.stats.uniqueStudents, 2)
  assert.equal(overview.papers[0].questions[0].stats.correct, 1)
  assert.equal(overview.papers[0].questions[0].stats.incorrect, 1)
  assert.equal(overview.papers[0].attempts[0].percent, 0)
})
