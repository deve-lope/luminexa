import React from 'react';
import LuminexaHomePage from './LuminexaHomePage';

/** About Luminexa — full marketing home (public) or same page inside the app shell. */
export default function AboutPage({ embedded = false }) {
  return <LuminexaHomePage inAppShell={embedded} />;
}
