import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveHomeFindPath } from './LuminexaHomePage';
import MimeDuoStory from '../components/marketing/MimeDuoStory';

jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy(
    {},
    {
      get: (_, tag) =>
        function MotionStub({ children, ...props }) {
          const { initial, animate, whileInView, viewport, transition, variants, style, ...rest } =
            props;
          return React.createElement(tag, rest, children);
        },
    },
  );
  return {
    __esModule: true,
    motion,
    useReducedMotion: () => false,
  };
});

describe('resolveHomeFindPath', () => {
  test('embedded customer about uses customer find', () => {
    expect(resolveHomeFindPath({ embedded: true, pathname: '/customer/about' })).toBe(
      '/customer/find',
    );
  });

  test('embedded provider about keeps services browse', () => {
    expect(resolveHomeFindPath({ embedded: true, pathname: '/provider/about' })).toBe('/services');
  });

  test('public home uses services browse', () => {
    expect(resolveHomeFindPath({ embedded: false, pathname: '/' })).toBe('/services');
  });
});

describe('MimeDuoStory', () => {
  test('opens with the provider search act', () => {
    const html = renderToStaticMarkup(<MimeDuoStory progress={0.02} activeIndex={0} />);

    expect(html).toContain("Who&#x27;s nearby?");
    expect(html).not.toContain('bg-white');
  });

  test('shows the one-hour reminder as the second act', () => {
    const html = renderToStaticMarkup(<MimeDuoStory progress={0.2} activeIndex={1} />);
    expect(html).toContain('Starts in 1 hour');
    expect(html).toContain('Reminder hits your phone');
  });

  test('renders the act matching scroll position without act counters', () => {
    const html = renderToStaticMarkup(<MimeDuoStory progress={0.62} activeIndex={4} />);

    expect(html).toContain('Elbow grease');
    expect(html).not.toMatch(/Act \d of \d/);
  });
});
