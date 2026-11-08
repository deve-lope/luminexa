import React, { useLayoutEffect, useRef } from 'react';
import SiteHeader from './SiteHeader';

const CHROME_VAR = '--lx-marketing-chrome-h';

/** Homepage SiteHeader above the provider shell; offsets fixed sidebar via CSS var. */
export default function MarketingDemoChrome() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const apply = () => {
      document.documentElement.style.setProperty(CHROME_VAR, `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty(CHROME_VAR);
    };
  }, []);

  return (
    <div ref={ref} className="relative z-50 shrink-0">
      <SiteHeader forceSolid demoActive fixed={false} />
    </div>
  );
}
