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
    <div className="min-h-[100dvh] bg-luminexa-canvas bg-lx-mesh text-slate-900">
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-teal-800">
            Luminexa
          </Link>
          <BackButton
            fallback={backTo}
            className="text-sm font-medium text-slate-500 hover:text-teal-700"
          >
            ← Back
          </BackButton>
        </div>

        <div className="rounded-3xl border border-luminexa-line bg-white p-6 shadow-lx-card sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}
