import React, { useState } from 'react';

const INPUT_VARIANTS = {
  dark:
    'w-full rounded-lg border border-slate-200 bg-white py-3 pl-4 pr-12 text-slate-900 outline-none focus:border-luminexa-accent focus:ring-2 focus:ring-luminexa-accent/25 [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#ffffff]',
  'dark-slate':
    'w-full min-h-[48px] rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-12 text-slate-900 outline-none focus:border-luminexa-accent focus:ring-2 focus:ring-luminexa-accent/25 [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#ffffff]',
  light:
    'w-full min-h-[48px] rounded-xl border border-slate-200/80 bg-white py-3 pl-3 pr-12 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luminexa-accent focus:ring-2 focus:ring-luminexa-accent/20',
};

const TOGGLE_VARIANTS = {
  dark: 'bg-slate-600 text-white hover:bg-slate-700',
  'dark-slate': 'bg-slate-600 text-white hover:bg-slate-700',
  light: 'bg-slate-600 text-white hover:bg-slate-700',
};

function IconEye({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function IconEyeOff({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

export default function PasswordInput({
  variant = 'light',
  className = '',
  inputClassName = '',
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const inputBase = INPUT_VARIANTS[variant] || INPUT_VARIANTS.light;
  const toggleBase = TOGGLE_VARIANTS[variant] || TOGGLE_VARIANTS.light;

  return (
    <div className={`relative ${className}`}>
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={`${inputBase} ${inputClassName}`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={`absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md transition ${toggleBase}`}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
      </button>
    </div>
  );
}
