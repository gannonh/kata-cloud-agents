import type { SpecVersion } from '../types/versioning';

interface VersionHistoryProps {
  versions: SpecVersion[];
  onSelectVersion: (versionNumber: number) => void;
  onCompare: (v1: number, v2: number) => void;
  onRestore: (versionNumber: number) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'unknown time';
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function VersionHistory({ versions, onSelectVersion, onCompare, onRestore }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-400">
        No versions yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <h3 className="mb-2 text-sm font-medium text-slate-300">Version History</h3>
      {versions.map((version, index) => (
        <div
          key={version.id}
          className="rounded-lg border border-slate-700 bg-slate-800 p-3 transition-colors hover:border-slate-500"
        >
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
              onClick={() => onSelectVersion(version.versionNumber)}
            >
              v{version.versionNumber}
            </button>
            <span className={`rounded px-1.5 py-0.5 text-xs ${
              version.actorType === 'agent'
                ? 'bg-purple-900 text-purple-300'
                : 'bg-blue-900 text-blue-300'
            }`}
            >
              {version.actorType}
            </span>
          </div>
          <p className="mb-2 text-xs text-slate-400">
            {version.changeSummary || 'No summary'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{formatRelativeTime(version.createdAt)}</span>
            <div className="flex gap-1">
              {index < versions.length - 1 ? (
                <button
                  type="button"
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => onCompare(versions[index + 1].versionNumber, version.versionNumber)}
                >
                  Compare
                </button>
              ) : null}
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
                onClick={() => onRestore(version.versionNumber)}
                aria-label={`Restore version ${version.versionNumber}`}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
