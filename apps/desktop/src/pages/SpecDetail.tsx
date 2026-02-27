import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DiffView } from '../components/DiffView';
import { VersionHistory } from '../components/VersionHistory';
import { useVersionStore } from '../store/versions';

export function SpecDetail() {
  const { specId } = useParams<{ specId: string }>();
  const {
    versions,
    total,
    loading,
    selectedVersion,
    diffResult,
    fetchVersions,
    fetchVersion,
    fetchDiff,
    restoreVersion,
    reset,
  } = useVersionStore();
  const [diffRange, setDiffRange] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (specId) {
      void fetchVersions(specId);
    }
    return () => reset();
  }, [specId, fetchVersions, reset]);

  if (!specId) return null;

  const handleCompare = (v1: number, v2: number) => {
    setDiffRange({ from: v1, to: v2 });
    void fetchDiff(specId, v1, v2);
  };

  const handleRestore = async (versionNumber: number) => {
    await restoreVersion(specId, versionNumber);
    setDiffRange(null);
  };

  const handleSelectVersion = (versionNumber: number) => {
    void fetchVersion(specId, versionNumber);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold">Spec Detail</h1>
        <p className="mt-2 text-sm text-slate-400">
          {loading ? 'Loading versions…' : `${total} versions`}
        </p>
        {selectedVersion ? (
          <div className="mt-4 rounded border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-300">
            Viewing version v{selectedVersion.versionNumber}
          </div>
        ) : null}
        {diffRange && diffResult ? (
          <div className="mt-4">
            <DiffView entries={diffResult} fromVersion={diffRange.from} toVersion={diffRange.to} />
          </div>
        ) : null}
      </div>
      <div className="w-80 overflow-y-auto border-l border-slate-700">
        <h2 className="px-4 pt-4 text-sm font-medium text-slate-300">Version History</h2>
        <VersionHistory
          versions={versions}
          onSelectVersion={handleSelectVersion}
          onCompare={handleCompare}
          onRestore={handleRestore}
        />
      </div>
    </div>
  );
}
