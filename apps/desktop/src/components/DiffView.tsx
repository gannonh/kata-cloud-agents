interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

interface DiffViewProps {
  entries: DiffEntry[];
  fromVersion: number;
  toVersion: number;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  return JSON.stringify(value, null, 2);
}

export function DiffView({ entries, fromVersion, toVersion }: DiffViewProps) {
  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">
        Comparing v{fromVersion} to v{toVersion}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No differences found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.path}
              className={`rounded-lg border p-3 text-sm ${
                entry.type === 'added'
                  ? 'border-green-800 bg-green-950'
                  : entry.type === 'removed'
                    ? 'border-red-800 bg-red-950'
                    : 'border-yellow-800 bg-yellow-950'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <code className="font-mono text-xs text-slate-300">{entry.path}</code>
                <span className={`rounded px-1.5 py-0.5 text-xs ${
                  entry.type === 'added'
                    ? 'bg-green-900 text-green-300'
                    : entry.type === 'removed'
                      ? 'bg-red-900 text-red-300'
                      : 'bg-yellow-900 text-yellow-300'
                }`}
                >
                  {entry.type}
                </span>
              </div>
              <div className="font-mono text-xs">
                {entry.oldValue !== undefined ? (
                  <div className="text-red-400">
                    <span className="mr-1 text-red-600">-</span>
                    {formatValue(entry.oldValue)}
                  </div>
                ) : null}
                {entry.newValue !== undefined ? (
                  <div className="text-green-400">
                    <span className="mr-1 text-green-600">+</span>
                    {formatValue(entry.newValue)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
