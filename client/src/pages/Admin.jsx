import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getAdminToken, setAdminToken } from '../api'

function formatWhen(value) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function Logo() {
  return (
    <span className="exam-logo-mark" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5 9.2 17 19 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function LockIcon() {
  return (
    <svg className="exam-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="exam-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5 7 7 6 7-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(Boolean(getAdminToken()))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [overview, setOverview] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [openQuestion, setOpenQuestion] = useState('')
  const [openAttempt, setOpenAttempt] = useState('')
  const [drafts, setDrafts] = useState({})

  async function load() {
    const data = await api('/api/admin/overview', { admin: true })
    setOverview(data)
    setSelectedId((current) => current || data.papers[0]?.id || '')
  }

  useEffect(() => {
    if (!authed) return
    let cancelled = false
    setError('')
    load().catch((err) => {
      if (cancelled) return
      if (/sign in/i.test(err.message)) {
        setAdminToken('')
        setAuthed(false)
      }
      setError(err.message)
    })
    return () => {
      cancelled = true
    }
  }, [authed])

  const paper = overview?.papers.find((item) => item.id === selectedId) || null

  async function unlock(event) {
    event.preventDefault()
    setError('')
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: { email: email.trim(), password }
      })
      setAdminToken(data.token)
      setPassword('')
      setAuthed(true)
    } catch (err) {
      setAdminToken('')
      setError(err.message)
    }
  }

  async function upload(file) {
    if (!file) return
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.append('file', file)
      const created = await api('/api/admin/upload', { admin: true, method: 'POST', body })
      setNotice(`“${created.title}” is ready with ${created.questionCount} questions.`)
      await load()
      setSelectedId(created.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function removePaper() {
    if (!paper) return
    if (!window.confirm(`Remove “${paper.title}” and every saved attempt?`)) return
    setError('')
    try {
      await api(`/api/admin/papers/${paper.id}`, { admin: true, method: 'DELETE' })
      setSelectedId('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveQuestion(question) {
    const draft = drafts[question.id] || {}
    setError('')
    try {
      await api(`/api/admin/questions/${question.id}`, {
        admin: true,
        method: 'PATCH',
        body: {
          prompt: draft.prompt ?? question.prompt,
          answerKey: draft.answerKey ?? question.answerKey,
          marks: Number(draft.marks ?? question.marks)
        }
      })
      setNotice('Question saved.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!authed) {
    return (
      <div className="exam">
        <header className="exam-nav">
          <Link className="exam-logo" to="/admin">
            <Logo />
            Question Desk
          </Link>
          <Link className="exam-nav-link" to="/">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5.5 19.2c1.4-3 3.6-4.4 6.5-4.4s5.1 1.4 6.5 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Student entry
          </Link>
        </header>

        <main className="exam-hero">
          <section className="exam-copy">
            <p className="exam-kicker">Examiner access</p>
            <h1>
              Manage papers,
              <br />
              marks, and
              <br />
              <span>every answer.</span>
            </h1>
            <p className="exam-lead">
              Upload a question paper, keep the answer key, and see which students answered each question
              correctly.
            </p>
            <div className="exam-metrics">
              <article>
                <span className="exam-metric-icon violet">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M14 3.8V9h5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </span>
                <strong>Upload</strong>
                <span>PDF, Word, image</span>
              </article>
              <article>
                <span className="exam-metric-icon lilac">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 19V6.5A1.5 1.5 0 0 1 6.5 5H14l5 5v9a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19Z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8.5 13h7M8.5 16.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <strong>Answer key</strong>
                <span>Saved per question</span>
              </article>
              <article>
                <span className="exam-metric-icon gold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 8v4.2l2.6 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <strong>Scoring</strong>
                <span>Meaning, not wording</span>
              </article>
            </div>
          </section>

          <section className="exam-card">
            <h2>Ready to begin?</h2>
            <p>Sign in with the admin email and password.</p>
            <form onSubmit={unlock}>
              <label className="exam-label">
                Email address
                <span className="exam-field">
                  <MailIcon />
                  <input
                    type="email"
                    value={email}
                    placeholder="admin@questiondesk.com"
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                  />
                </span>
              </label>
              <label className="exam-label">
                Password
                <span className="exam-field">
                  <LockIcon />
                  <input
                    type="password"
                    value={password}
                    placeholder="Enter your password"
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </span>
              </label>
              {error && <p className="exam-error">{error}</p>}
              <button className="exam-start" type="submit">
                Open dashboard <span aria-hidden="true">→</span>
              </button>
            </form>
            <div className="exam-note">
              <span className="exam-note-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="8" r="0.9" fill="currentColor" />
                </svg>
              </span>
              <p>
                <strong>Before you open the desk</strong>
                Students never use this page. The Gemini key stays in the server .env file.
              </p>
            </div>
          </section>
        </main>
        <footer className="exam-foot">© {new Date().getFullYear()} Question Desk · Secure assessment platform</footer>
      </div>
    )
  }

  const stats = overview?.stats

  return (
    <div className="exam">
      <header className="exam-nav">
        <Link className="exam-logo" to="/admin">
          <Logo />
          Question Desk
        </Link>
        <div className="exam-nav-actions">
          <Link className="exam-nav-link" to="/">
            Student entry
          </Link>
          <button
            type="button"
            className="exam-nav-link"
            onClick={() => {
              setAdminToken('')
              setAuthed(false)
              setOverview(null)
            }}
          >
            Lock desk
          </button>
        </div>
      </header>

      <main className="exam-dash">
        <header className="exam-dash-head">
          <p className="exam-kicker">Examiner dashboard</p>
          <h1>
            Answers, marks, and <span>who sat each paper.</span>
          </h1>
        </header>

        {error && <p className="banner error">{error}</p>}
        {notice && <p className="banner good">{notice}</p>}

        <section className="stats">
          <article>
            <span>Papers</span>
            <strong>{stats?.papers ?? '—'}</strong>
          </article>
          <article>
            <span>Questions</span>
            <strong>{stats?.questions ?? '—'}</strong>
          </article>
          <article>
            <span>Students</span>
            <strong>{stats?.uniqueStudents ?? '—'}</strong>
          </article>
          <article>
            <span>Attempts</span>
            <strong>{stats?.attempts ?? '—'}</strong>
          </article>
          <article>
            <span>Average score</span>
            <strong>{stats ? `${stats.averageScorePercent}%` : '—'}</strong>
          </article>
        </section>

        <section
          className={uploading ? 'drop uploading' : 'drop'}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            upload(event.dataTransfer.files?.[0])
          }}
        >
          <div>
            <h2>Upload a question paper</h2>
            <p>
              PDF, Word (.doc, .docx), text, or a photo (JPEG, PNG). Questions, marks, and the answer key are
              read on the server. A sample file is samples/sample-paper.txt.
            </p>
          </div>
          <label className="file-button">
            {uploading ? 'Reading paper…' : 'Choose file'}
            <input
              type="file"
              hidden
              disabled={uploading}
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
              onChange={(event) => {
                upload(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
        </section>

        <section className="exam-papers">
          {overview?.papers.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === selectedId ? 'exam-paper active' : 'exam-paper'}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>{item.title}</strong>
              <span>
                {item.attemptCount} attempts · {item.uniqueStudents} students
              </span>
            </button>
          ))}
          {overview && overview.papers.length === 0 && <p className="empty">No papers yet.</p>}
        </section>

        {!paper && overview && <p className="empty">Upload a paper to see questions and student answers here.</p>}

        {paper && (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{paper.title}</h2>
                  <p>
                    {paper.filename} · {paper.uniqueStudents} students · {paper.attemptCount} attempts
                  </p>
                </div>
                <button type="button" className="danger" onClick={removePaper}>
                  Remove paper
                </button>
              </div>

              <div className="question-admin">
                {paper.questions.map((question) => {
                  const draft = drafts[question.id] || {}
                  const open = openQuestion === question.id
                  const rate = question.stats.attempts
                    ? Math.round((question.stats.correct / question.stats.attempts) * 100)
                    : 0
                  return (
                    <article key={question.id} className="q-card">
                      <button
                        type="button"
                        className="q-toggle"
                        onClick={() => setOpenQuestion(open ? '' : question.id)}
                      >
                        <span>
                          Q{question.number}. {question.prompt}
                        </span>
                        <span className="q-stats">
                          {question.marks} marks · {question.stats.attempts} answers · {question.stats.correct} correct ·{' '}
                          {question.stats.incorrect} wrong
                        </span>
                      </button>
                      <div className="bar" aria-hidden="true">
                        <span style={{ width: `${rate}%` }} />
                      </div>
                      {open && (
                        <div className="q-body">
                          <label>
                            Question
                            <textarea
                              rows={3}
                              value={draft.prompt ?? question.prompt}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [question.id]: {
                                    ...(current[question.id] || {}),
                                    prompt: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <div className="split">
                            <label>
                              Marks
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={draft.marks ?? question.marks}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [question.id]: {
                                      ...(current[question.id] || {}),
                                      marks: event.target.value
                                    }
                                  }))
                                }
                              />
                            </label>
                            <label className="grow">
                              Answer key
                              <textarea
                                rows={3}
                                value={draft.answerKey ?? question.answerKey}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [question.id]: {
                                      ...(current[question.id] || {}),
                                      answerKey: event.target.value
                                    }
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <button type="button" className="primary" onClick={() => saveQuestion(question)}>
                            Save question
                          </button>

                          <h3>Student answers</h3>
                          {question.responses.length === 0 && <p className="muted">No answers yet.</p>}
                          <ul className="responses">
                            {question.responses.map((response) => (
                              <li key={response.attemptId}>
                                <div className="q-meta">
                                  <span>
                                    {response.name}
                                    <small> {response.email}</small>
                                  </span>
                                  <span className={response.isCorrect ? 'pill good' : 'pill bad'}>
                                    {response.isCorrect ? 'Correct' : 'Not correct'} · {response.awardedMarks}/
                                    {response.maxMarks} · {response.relevancy}% match
                                  </span>
                                </div>
                                <p className="answer-copy">{response.response || 'No answer'}</p>
                                <p className="feedback">{response.feedback}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Who submitted</h2>
                  <p>{paper.uniqueStudents} different emails have sent answers.</p>
                </div>
              </div>
              {paper.attempts.length === 0 && <p className="muted">Waiting for the first student.</p>}
              <div className="attempt-table">
                {paper.attempts.map((attempt) => (
                  <article key={attempt.id}>
                    <button
                      type="button"
                      className="attempt-row"
                      onClick={() => setOpenAttempt(openAttempt === attempt.id ? '' : attempt.id)}
                    >
                      <span>
                        <strong>{attempt.name}</strong>
                        <small>{attempt.email}</small>
                      </span>
                      <span>
                        {attempt.totalAwarded}/{attempt.totalMarks} · {attempt.percent}%
                      </span>
                      <span>
                        {attempt.correctCount}/{attempt.questionCount} correct
                      </span>
                      <span>{formatWhen(attempt.submittedAt)}</span>
                    </button>
                    {openAttempt === attempt.id && (
                      <ul className="responses inset">
                        {attempt.answers.map((answer) => {
                          const question = paper.questions.find((item) => item.id === answer.questionId)
                          return (
                            <li key={answer.questionId}>
                              <div className="q-meta">
                                <span>Q{question?.number}. {question?.prompt}</span>
                                <span className={answer.isCorrect ? 'pill good' : 'pill bad'}>
                                  {answer.isCorrect ? 'Correct' : 'Not correct'} · {answer.awardedMarks}/
                                  {answer.maxMarks}
                                </span>
                              </div>
                              <p className="answer-copy">{answer.response || 'No answer'}</p>
                              <p className="feedback">
                                Relevance {answer.relevancy}%. {answer.feedback}
                              </p>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="exam-foot">© {new Date().getFullYear()} Question Desk · Secure assessment platform</footer>
    </div>
  )
}
