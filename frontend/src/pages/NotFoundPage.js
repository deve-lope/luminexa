import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';

export default function NotFoundPage() {
  return (
    <div className="min-h-[100dvh] bg-luminexa-canvas text-slate-900">
      <SeoHead
        title="Page not found | Luminexa"
        description="This Luminexa page does not exist. Open the homepage or browse services in Ottawa and Toronto."
        canonical="/"
        noindex
      />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">404</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          That URL is not a Luminexa page. Try the homepage or a city hub.
        </p>
        <p className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-medium">
          <Link to="/" className="text-teal-700 hover:underline">
            Home
          </Link>
          <a href="/ottawa/" className="text-teal-700 hover:underline">
            Ottawa
          </a>
          <a href="/toronto/" className="text-teal-700 hover:underline">
            Toronto
          </a>
          <a href="/pricing/" className="text-teal-700 hover:underline">
            Pricing
          </a>
        </p>
      </main>
    </div>
  );
}
