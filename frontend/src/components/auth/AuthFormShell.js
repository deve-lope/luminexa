import React from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../navigation/BackButton';

/** Shared light teal shell for auth forms (login, register, reset, verify). */
export default function AuthFormShell({
  title,
  subtitle,
  children,
  backTo = '/',
  footer = null,
}) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#d8f3ef] text-slate-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-200 via-teal-100 to-cyan-200"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 h-[28rem] w-[28rem] rounded-full bg-teal-400/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-[18%] h-[32rem] w-[32rem] rounded-full bg-cyan-400/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-[20%] h-80 w-80 rounded-full bg-emerald-400/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-teal-600/25 to-transparent"
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-teal-900">
            Luminexa
          </Link>
          <BackButton
            fallback={backTo}
            className="text-sm font-medium text-teal-900/75 hover:text-teal-950"
          >
            ← Back
          </BackButton>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-lx-elevated backdrop-blur-md sm:p-8">
          <div className="mb-5 h-1.5 w-14 rounded-full bg-gradient-to-r from-teal-600 to-cyan-400" />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-teal-950/70">{footer}</div>}
      </div>
    </div>
  );
}
