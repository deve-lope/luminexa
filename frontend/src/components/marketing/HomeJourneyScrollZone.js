import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import MimeDuoStory, { MIME_ACTS, MimeDuoStoryAutoplay, useZoneScrollProgress } from './MimeDuoStory';

function useDesktopStory() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return desktop;
}

/**
 * Need prompts with scroll-synced mime act on desktop; auto-play story on phones.
 */
export default function HomeJourneyScrollZone({ children }) {
  const zoneRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const desktopStory = useDesktopStory();
  const { progress, activeIndex } = useZoneScrollProgress(
    zoneRef,
    MIME_ACTS.length,
    reduceMotion,
    desktopStory,
  );

  return (
    <div
      ref={zoneRef}
      className="relative bg-luminexa-canvas bg-lx-mesh"
      aria-label="Service categories and booking story"
    >
      <div className="mx-auto max-w-[1400px] px-4 md:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_min(210px,23vw)] lg:gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0 pt-6 md:pt-10">
            {children}

            <div className="mt-10 border-t border-teal-900/10 pt-10 md:hidden">
              <MimeDuoStoryAutoplay />
            </div>
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
