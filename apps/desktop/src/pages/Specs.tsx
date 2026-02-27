import { Link } from 'react-router-dom';

export function Specs() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Specs</h1>
      <p className="mt-2 text-slate-400">Manage agent specifications.</p>
      <div className="mt-6">
        <Link
          to="/specs/spec-1"
          className="inline-flex rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800"
        >
          Open Spec Detail (demo)
        </Link>
      </div>
    </div>
  );
}
