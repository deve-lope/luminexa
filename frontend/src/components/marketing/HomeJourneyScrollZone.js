import React, { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import MimeDuoStory, { MIME_ACTS, useZoneScrollProgress } from './MimeDuoStory';

/**
 * Need prompts with a scroll-synced stick-figure mime act alongside.
 */
export default function HomeJourneyScrollZone({ children }) {
  const zoneRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { progress, activeIndex } = useZoneScrollProgress(zoneRef, MIME_ACTS.length, reduceMotion);

  return (
    <div
      ref={zoneRef}
      className="relative bg-luminexa-canvas bg-lx-mesh"
      aria-label="Service categories and booking story"
    >
      <div className="mx-auto max-w-[1400px] px-4 md:px-8 lg:px-10">
        <div className="pt-8 md:hidden">
          <MimeDuoStory compact progress={progress} activeIndex={activeIndex} />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_min(210px,23vw)] lg:gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0 pt-6 md:pt-10">
            {children}
          </div>

          <aside className="relative hidden md:block">
            <div className="sticky top-24 py-8">
              <MimeDuoStory progress={progress} activeIndex={activeIndex} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
