/** Quote clarifying questions: free text or single-choice. */

export const QUOTE_Q_TEXT = 'text';
export const QUOTE_Q_CHOICE = 'choice';

export function emptyQuoteQuestionDraft(type = QUOTE_Q_TEXT) {
  return {
    question: '',
    type: type === QUOTE_Q_CHOICE ? QUOTE_Q_CHOICE : QUOTE_Q_TEXT,
    options: ['', ''],
  };
}

/** Normalize API / storage item or plain string into an editor draft. */
export function toQuoteQuestionDraft(item) {
  if (typeof item === 'string') {
    return { question: item, type: QUOTE_Q_TEXT, options: ['', ''] };
  }
  if (!item || typeof item !== 'object') {
    return emptyQuoteQuestionDraft();
  }
  const type = item.type === QUOTE_Q_CHOICE ? QUOTE_Q_CHOICE : QUOTE_Q_TEXT;
  const options = Array.isArray(item.options)
    ? item.options.map((o) => String(o ?? ''))
    : ['', ''];
  while (options.length < 2) options.push('');
  return {
    question: item.question || item.text || '',
    type,
    options: options.slice(0, 12),
  };
}

/** Payload for ask/save APIs (drops empty rows). */
export function toQuoteQuestionPayload(drafts) {
  const out = [];
  (drafts || []).forEach((raw, i) => {
    const d = toQuoteQuestionDraft(raw);
    const question = d.question.trim();
    if (!question) return;
    if (d.type === QUOTE_Q_CHOICE) {
      const options = d.options.map((o) => o.trim()).filter(Boolean).slice(0, 12);
      if (options.length < 2) return;
      out.push({
        id: raw?.id || `q${out.length + 1}`,
        question,
        type: QUOTE_Q_CHOICE,
        options,
      });
      return;
    }
    out.push({
      id: raw?.id || `q${out.length + 1}`,
      question,
      type: QUOTE_Q_TEXT,
    });
  });
  return out;
}

/** For service templates that still accept plain strings when text-only. */
export function toServiceQuoteQuestionsPayload(drafts) {
  return toQuoteQuestionPayload(drafts).map((q) =>
    q.type === QUOTE_Q_CHOICE
      ? { question: q.question, type: QUOTE_Q_CHOICE, options: q.options }
      : q.question,
  );
}

export function questionLabel(q) {
  if (typeof q === 'string') return q.trim();
  return (q?.question || q?.text || '').trim();
}

export function isChoiceQuestion(q) {
  return Boolean(q && typeof q === 'object' && q.type === QUOTE_Q_CHOICE);
}
