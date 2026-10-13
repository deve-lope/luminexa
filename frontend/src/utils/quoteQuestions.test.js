import {
  QUOTE_Q_CHOICE,
  toQuoteQuestionDraft,
  toQuoteQuestionPayload,
  toServiceQuoteQuestionsPayload,
} from './quoteQuestions';

describe('quoteQuestions', () => {
  it('builds choice + text API payload', () => {
    const payload = toQuoteQuestionPayload([
      { question: 'Rooms?', type: QUOTE_Q_CHOICE, options: ['1', '2', ''] },
      { question: 'Notes?', type: 'text', options: [] },
      { question: '  ', type: 'text' },
    ]);
    expect(payload).toEqual([
      { id: 'q1', question: 'Rooms?', type: 'choice', options: ['1', '2'] },
      { id: 'q2', question: 'Notes?', type: 'text' },
    ]);
  });

  it('keeps text templates as strings for services', () => {
    expect(
      toServiceQuoteQuestionsPayload([
        toQuoteQuestionDraft('What do you need?'),
        { question: 'Size?', type: QUOTE_Q_CHOICE, options: ['S', 'L'] },
      ]),
    ).toEqual([
      'What do you need?',
      { question: 'Size?', type: 'choice', options: ['S', 'L'] },
    ]);
  });
});
