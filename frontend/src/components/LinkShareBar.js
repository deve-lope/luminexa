import React, { useState } from 'react';
import ShareSheet from './ShareSheet';
import { copyText } from '../utils/shareLink';

export default function LinkShareBar({
  url,
  title,
  text,
  showInput = true,
  copyLabel = 'Copy',
  shareLabel = 'Share',
  compact = false,
}) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const markCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const onCopy = async () => {
    if (!url) return;
    await copyText(url);
    markCopied();
  };

  const btn = compact
    ? 'min-h-[40px] rounded-lg px-3 text-sm font-medium'
    : 'min-h-[48px] rounded-xl px-4 font-medium';

  return (
    <div>
      {showInput && (
        <input
          type="text"
          readOnly
          value={url || ''}
          className="min-h-[48px] w-full truncate rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
        />
      )}
      <div className={`flex gap-2 ${showInput ? 'mt-3' : ''}`}>
        <button
          type="button"
          onClick={onCopy}
          disabled={!url}
          className={`${btn} flex-1 bg-luminexa-accent text-white disabled:opacity-60`}
        >
          {copied ? 'Copied' : copyLabel}
        </button>
        <button
          type="button"
          onClick={() => url && setShareOpen(true)}
          disabled={!url}
          className={`${btn} flex-1 border border-teal-200 bg-teal-50 text-teal-900 disabled:opacity-60`}
        >
          {shareLabel}
        </button>
      </div>
      <ShareSheet
        open={shareOpen}
        url={url}
        title={title}
        text={text}
        onClose={() => setShareOpen(false)}
        onCopied={markCopied}
      />
    </div>
  );
}
