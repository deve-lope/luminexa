import React, { useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import { isChoiceQuestion } from '../../utils/quoteQuestions';

/**
 * Customer answers to provider clarifying questions.
 * Shown near the top of booking detail — not under Activity.
 */
export default function BookingQuestionsPanel({ booking, onUpdated }) {
  const questions = booking?.quote_questions || [];
  const awaiting = Boolean(booking?.awaiting_quote_details);
  const answered = questions.filter((q) => (q.answer || '').trim());
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAnswers(
      (booking?.quote_questions || []).map((q) => ({
        id: q.id,
        answer: q.answer || '',
      })),
    );
    setError('');
  }, [booking?.id, booking?.awaiting_quote_details, booking?.quote_questions]);

  if (!booking || !questions.length) return null;
  if (!awaiting && !answered.length) return null;

  const setAnswer = (id, answer) => {
    setAnswers((prev) => {
      const next = [...prev];
      const i = next.findIndex((a) => a.id === id);
      if (i >= 0) next[i] = { ...next[i], answer };
      else next.push({ id, answer });
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await jobsAPI.answerBookingQuoteQuestions(booking.id, { answers });
      onUpdated?.();
    } catch (e) {
      const d = e.response?.data;
      setError(
        d?.answers || d?.detail || d?.status?.[0] || 'Could not send your answers.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (awaiting) {
    return (
      <section
        id="booking-questions"
        className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm ring-1 ring-amber-200"
        aria-label="Questions from the business"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
          Questions from the business
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {booking.organization_name} asked for a few details. Answer here — this does not change
          your booking status.
        </p>
        {booking.quote_message ? (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700">
            {booking.quote_message}
          </p>
        ) : null}
        <div className="mt-3 space-y-3">
          {questions.map((q, idx) => {
            const value = answers.find((a) => a.id === q.id)?.answer || '';
            const choice = isChoiceQuestion(q);
            return (
              <fieldset key={q.id || idx} className="min-w-0">
                <legend className="mb-1.5 block text-sm font-semibold text-slate-800">
                  {q.question}
                </legend>
                {choice ? (
                  <div className="space-y-1.5">
                    {(q.options || []).map((opt) => (
                      <label
                        key={opt}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm ${
                          value === opt
                            ? 'border-luminexa-accent bg-violet-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`detail-quote-q-${q.id}`}
                          checked={value === opt}
                          onChange={() => setAnswer(q.id, opt)}
                          className="h-4 w-4 accent-violet-700"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={value}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Your answer"
                  />
                )}
              </fieldset>
            );
          })}
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-3 min-h-[48px] w-full rounded-xl bg-luminexa-accent text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Submit answers'}
        </button>
      </section>
    );
  }

  return (
    <section
      id="booking-questions"
      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
      aria-label="Your answers"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your answers</p>
      <ul className="mt-2 space-y-2 text-sm text-slate-700">
        {questions.map((q) =>
          (q.answer || '').trim() ? (
            <li key={q.id}>
              <span className="font-medium">{q.question}</span>
              <span className="text-slate-600"> — {q.answer}</span>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}
