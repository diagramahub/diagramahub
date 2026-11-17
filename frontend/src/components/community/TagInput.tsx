import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_TAGS, addTags } from '../../utils/community';

interface TagInputProps {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}

/**
 * Tags as chips inside the field. Typing is lowercase; Enter or a comma adds
 * the tag, Backspace on an empty field removes the last one, and leaving the
 * field keeps what was typed. Pasting "a, b, c" adds them all.
 */
export function TagInput({ id, tags, onChange, max = MAX_TAGS }: TagInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const full = tags.length >= max;
  const hintId = `${id}-hint`;

  const commit = (text: string) => {
    if (text.trim()) onChange(addTags(tags, text, max));
  };

  const handleChange = (value: string) => {
    const lower = value.toLowerCase();
    const cut = lower.lastIndexOf(',');
    if (cut < 0) {
      setDraft(lower);
      return;
    }
    commit(lower.slice(0, cut));
    setDraft(lower.slice(cut + 1).trimStart());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && tags.length > 0) {
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (tag: string) => {
    onChange(tags.filter((x) => x !== tag));
    inputRef.current?.focus();
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 w-full min-h-[2.25rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 shadow-sm cursor-text focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 dark:bg-gray-950 dark:border-gray-700"
      >
        {tags.map((tag) => (
          <span key={tag} className="badge text-xs">
            #{tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(tag);
              }}
              aria-label={t('community.publish.removeTag', { tag })}
              className="-mr-0.5 rounded text-purple-500 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            commit(draft);
            setDraft('');
          }}
          readOnly={full}
          placeholder={full ? '' : tags.length ? t('community.publish.tagsMore') : t('community.publish.tagsPlaceholder')}
          aria-describedby={hintId}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="enter"
          maxLength={60}
          className="flex-1 min-w-[6rem] h-6 border-0 bg-transparent p-0 text-sm lowercase text-gray-900 placeholder:normal-case placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>
      <p id={hintId} className={`mt-1 text-xs ${full ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {full ? t('community.publish.tagsFull', { max }) : t('community.publish.tagsHint', { count: tags.length, max })}
      </p>
    </div>
  );
}
