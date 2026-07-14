import React from 'react';
import LuminexaHomePage from './LuminexaHomePage';

/** About Luminexa — full marketing page (public) or embedded in app shell. */
export default function AboutPage({ embedded = false }) {
  return <LuminexaHomePage embedded={embedded} />;
}
