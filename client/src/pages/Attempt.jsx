import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

const SESSION_KEY = 'question-desk-student'

function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (saved?.name && saved?.email) return saved
  } catch {
    // Ignore a damaged saved session.
  }
  return null
}

export default function Attempt() {
  const [session, setSession] = useState(readSession)
  const [name, setName] = useState(session?.name || '')
  const [email, setEmail] = useState(session?.email || '')
  const [papers, setPapers] = useState([])
  const [paper, setPaper] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    setLoading(true)
    setError('')
    api('/api/papers')
      .then((data) => {
        if (!cancelled) setPapers(data.papers)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  useEffect(() => {
    if (!session || papers.length !== 1 || paper) return
    openPaper(papers[0].id)
  }, [session, papers, paper])

  const answeredCount = useMemo(() => {
    if (!paper) return 0
    return paper.questions.filter((question) => String(answers[question.id] || '').trim()).length
  }, [paper, answers])

  function signIn(event) {
    event.preventDefault()
    const next = { name: name.trim(), email: email.trim().toLowerCase() }
    if (next.name.length < 2) {
      setError('Enter your name (at least 2 characters).')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) {
      setError('Enter a valid email address.')
      return
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setSession(next)
    setError('')
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setPaper(null)
    setPapers([])
    setAnswers({})
    setResult(null)
  }

  async function openPaper(id) {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const next = await api(`/api/papers/${id}`)
      setPaper(next)
      setAnswers({})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!paper || !session) return
    setSubmitting(true)
    setError('')
    try {
      const data = await api('/api/attempts', {
        method: 'POST',
        body: {
          name: session.name,
          email: session.email,
          paperId: paper.id,
          answers: paper.questions.map((question) => ({
            questionId: question.id,
            response: answers[question.id] || ''
          }))
        }
      })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">Q</span>
          <span>Question Desk</span>
        </Link>
        {session ? (
          <div className="identity">
            <span>
              {session.name}
              <small>{session.email}</small>
            </span>
            <button type="button" className="text-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link className="text-button" to="/admin">
            Examiner desk
          </Link>
        )}
      </header>

      <main className="sheet">
        {!session && (
          <section className="gate">
            <p className="eyebrow">Student entry</p>
            <h1>Enter your name and email before the paper opens.</h1>
            <p className="lede">
              Each attempt is saved against that name. You do not need a password.
            </p>
            <form className="stack" onSubmit={signIn}>
              <label>
                Full name
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              {error && <p className="banner error">{error}</p>}
              <button className="primary" type="submit">
                Continue to the paper
              </button>
            </form>
          </section>
        )}

        {session && !paper && (
          <section>
            <p className="eyebrow">Published papers</p>
            <h1>Choose a question paper.</h1>
            {loading && <p className="muted">Loading papers…</p>}
            {error && <p className="banner error">{error}</p>}
            {!loading && papers.length === 0 && (
              <p className="empty">No papers are published yet. Ask the examiner to upload one.</p>
            )}
            <div className="paper-list">
              {papers.map((item) => (
                <button key={item.id} type="button" className="paper-choice" onClick={() => openPaper(item.id)}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.questionCount} questions · {item.totalMarks} marks
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {session && paper && !result && (
          <form onSubmit={submit}>
            <p className="eyebrow">Question paper</p>
            <div className="paper-heading">
              <h1>{paper.title}</h1>
              {papers.length > 1 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setPaper(null)
                    setAnswers({})
                  }}
                >
                  All papers
                </button>
              )}
            </div>
            <p className="lede">
              {paper.questionCount} questions · {paper.totalMarks} marks. Write your own answers. They are checked
              for meaning against the answer key.
            </p>
            <ol className="questions">
              {paper.questions.map((question) => (
                <li key={question.id}>
                  <div className="q-meta">
                    <span>Question {question.number}</span>
                    <span>{question.marks} marks</span>
                  </div>
                  <p className="prompt">{question.prompt}</p>
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    rows={question.kind === 'long' ? 6 : 3}
                    placeholder="Write your answer"
                  />
                </li>
              ))}
            </ol>
            {error && <p className="banner error">{error}</p>}
            <div className="submit-bar">
              <span>
                {answeredCount} of {paper.questions.length} answered
              </span>
              <button className="primary" type="submit" disabled={submitting}>
                {submitting ? 'Checking answers…' : 'Submit answers'}
              </button>
            </div>
          </form>
        )}

        {session && paper && result && (
          <section>
            <p className="eyebrow">Result</p>
            <h1>
              {result.totalAwarded} / {result.totalMarks}
            </h1>
            <p className="lede">
              {result.correctCount} of {result.questionCount} answers were marked correct · {result.percent}% of the
              marks. Saved for {session.name}.
            </p>
            <ol className="questions">
              {paper.questions.map((question) => {
                const marked = result.answers.find((answer) => answer.questionId === question.id)
                return (
                  <li key={question.id}>
                    <div className="q-meta">
                      <span>Question {question.number}</span>
                      <span className={marked?.isCorrect ? 'pill good' : 'pill bad'}>
                        {marked?.isCorrect ? 'Correct' : 'Not correct'} · {marked?.awardedMarks ?? 0}/
                        {marked?.maxMarks ?? question.marks}
                      </span>
                    </div>
                    <p className="prompt">{question.prompt}</p>
                    <p className="answer-copy">{answers[question.id] || 'No answer'}</p>
                    <p className="feedback">
                      Relevance {marked?.relevancy ?? 0}%. {marked?.feedback}
                    </p>
                  </li>
                )
              })}
            </ol>
            <button
              className="primary"
              type="button"
              onClick={() => {
                setResult(null)
                setAnswers({})
              }}
            >
              Attempt again
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
