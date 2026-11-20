import { lessonById, lessonForKey } from '../learn/lessons';
import type { Design } from '../physics/types';
import { useStore } from '../state/store';

/** Small 📖 button next to a control that opens its lesson. */
export function LearnButton({ k }: { k: keyof Design }) {
  const id = lessonForKey(k);
  const lesson = lessonById(id);
  if (!lesson) return null;
  return (
    <button
      className="learn-btn"
      onClick={(e) => {
        e.stopPropagation();
        useStore.getState().openLesson(lesson.id, { step: lesson.step, focus: lesson.focus ?? null });
      }}
      aria-label={`Learn about ${lesson.title}`}
      title={`Learn about ${lesson.title}`}
    >
      📖 Learn
    </button>
  );
}
