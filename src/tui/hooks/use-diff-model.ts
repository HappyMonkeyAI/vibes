import { useEffect, useState } from 'react';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DiffModel {
  diffContent: string;
  isLoading: boolean;
  error?: string;
}

export function useDiffModel(workspaceRoot: string): DiffModel {
  const [model, setModel] = useState<DiffModel>({ diffContent: '', isLoading: true });

  useEffect(() => {
    let cancelled = false;
    setModel(previous => ({ ...previous, isLoading: true, error: undefined }));
    execFileAsync('git', ['diff', 'HEAD'], { cwd: workspaceRoot, maxBuffer: 4 * 1024 * 1024 })
      .then(({ stdout }) => {
        if (!cancelled) setModel({ diffContent: String(stdout), isLoading: false });
      })
      .catch((error: Error) => {
        if (!cancelled) setModel({ diffContent: '', isLoading: false, error: error.message });
      });
    return () => { cancelled = true; };
  }, [workspaceRoot]);

  return model;
}
