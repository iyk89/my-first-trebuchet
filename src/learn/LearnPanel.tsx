import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { LESSONS, PAGES, lessonById, type Lesson } from './lessons';

function open(l: Lesson) {
  useStore.getState().openLesson(l.id, { step: l.step, focus: l.focus ?? null });
}

function LessonList() {
  const learned = useStore((s) => s.learned);
  const groups = [...new Set(LESSONS.map((l) => l.group))];
  const firstNew = LESSONS.find((l) => !learned.includes(l.id)) ?? LESSONS[0];
  return (
    <div className="panel-body learn">
      <h2>📖 Learn the parts</h2>
      <p className="intro">
        Short lessons about each part of a trebuchet: what it is, why it matters, how it works, and what it changes. Every picture and chart uses <b>your</b> machine.
      </p>
      <div className="btn-row">
        <button className="primary" onClick={() => open(firstNew)}>
          {learned.length === 0 ? '▶ Start the first lesson' : learned.length >= LESSONS.length ? '▶ Start again' : `▶ Continue: ${firstNew.title}`}
        </button>
        <span className="muted small">
          {learned.length} of {LESSONS.length} done
        </span>
      </div>
      {groups.map((g) => (
        <section key={g} className="lesson-group">
          <h4>{g}</h4>
          {LESSONS.filter((l) => l.group === g).map((l) => (
            <button key={l.id} className={`lesson-item ${learned.includes(l.id) ? 'done' : ''}`} onClick={() => open(l)}>
              <span className="lesson-icon">{l.icon}</span>
              <span className="lesson-text">
                <b>{l.title}</b>
                <span>{l.summary}</span>
              </span>
              <span className="lesson-check" aria-label={learned.includes(l.id) ? 'done' : 'not done yet'}>
                {learned.includes(l.id) ? '✓' : '›'}
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const d = useStore((s) => s.draft);
  const page = useStore((s) => s.learnPage);
  const setPage = useStore((s) => s.setLearnPage);
  const openLesson = useStore((s) => s.openLesson);
  const playDemo = useStore((s) => s.playDemo);
  const demoLabel = useStore((s) => s.demoLabel);
  const mode = useStore((s) => s.mode);
  const setStep = useStore((s) => s.setStep);
  const setFocus = useStore((s) => s.setFocus);
  const idx = LESSONS.indexOf(lesson);
  const next = LESSONS[idx + 1];
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    top.current?.closest('.panel-scroll')?.scrollTo({ top: 0 });
  }, [lesson.id, page]);

  const P = [lesson.What, lesson.Why, lesson.How, lesson.Impact][page];
  return (
    <div className="panel-body learn" ref={top}>
      <div className="lesson-top">
        <button className="link" onClick={() => openLesson(null)}>
          ← All lessons
        </button>
        <span className="muted small">
          Lesson {idx + 1} of {LESSONS.length}
        </span>
      </div>
      <h2>
        <span className="h-icon">{lesson.icon}</span> {lesson.title}
      </h2>
      <nav className="pages" aria-label="Lesson pages">
        {PAGES.map((p, i) => (
          <button key={p.id} className={i === page ? 'on' : i < page ? 'seen' : ''} onClick={() => setPage(i)}>
            <span className="page-num">{i + 1}</span> {p.label}
          </button>
        ))}
      </nav>

      <h3 className="page-title">{PAGES[page].label}</h3>
      <div className="lesson-body">
        <P d={d} />
      </div>

      {page === 2 && (
        <div className="watch">
          <h4>▶ Watch it on the 3D model</h4>
          <p className="muted small">Plays in slow motion. These test throws are not saved as versions.</p>
          <div className="btn-row">
            <button className={mode === 'throw' && demoLabel === 'Your build' ? 'on' : ''} onClick={() => playDemo({}, 'Your build')}>
              Your build
            </button>
            {lesson.watch.map((w) => (
              <button key={w.label} className={mode === 'throw' && demoLabel === w.label ? 'on' : ''} onClick={() => playDemo(w.patch(d), w.label)}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {page === 3 && (
        <div className="takeaway">
          <b>Remember:</b> {lesson.takeaway}
        </div>
      )}

      <div className="lesson-nav">
        {page > 0 ? <button onClick={() => setPage(page - 1)}>← Back</button> : <span />}
        {page < 3 ? (
          <button className="primary" onClick={() => setPage(page + 1)}>
            Next: {PAGES[page + 1].label} →
          </button>
        ) : (
          <div className="btn-row end">
            <button
              onClick={() => {
                setStep(lesson.step);
                if (lesson.focus) setFocus(lesson.focus);
              }}
            >
              🔧 Try it yourself
            </button>
            {next && (
              <button className="primary" onClick={() => open(next)}>
                Next lesson: {next.title} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LearnPanel() {
  const id = useStore((s) => s.learnId);
  const lesson = lessonById(id);
  return lesson ? <LessonView lesson={lesson} /> : <LessonList />;
}
