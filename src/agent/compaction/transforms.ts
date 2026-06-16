/**
 * Deterministic log compaction transforms.
 * These transforms operate on raw tool output strings to reduce token usage
 * without losing critical semantic information.
 */

export interface CompactionTransform {
  name: string;
  apply(content: string): string;
}

/**
 * Trims long stack traces by preserving the error message and the top/bottom frames.
 */
export const StackTraceTransform: CompactionTransform = {
  name: 'stack-trace-trimming',
  apply(content: string): string {
    const lines = content.split('\n');
    if (lines.length < 20) return content;

    const stackLineIndex = lines.findIndex(l => l.trim().startsWith('at '));
    if (stackLineIndex === -1) return content;

    const head = lines.slice(0, stackLineIndex + 5);
    const tail = lines.slice(-5);
    
    if (head.length + tail.length >= lines.length) return content;

    return [...head, `\n[... trimmed ${lines.length - head.length - tail.length} lines of stack trace ...]\n`, ...tail].join('\n');
  }
};

/**
 * Collapses repeated identical lines (common in looping errors or progress bars).
 */
export const RepeatLineTransform: CompactionTransform = {
  name: 'repeat-line-collapse',
  apply(content: string): string {
    const lines = content.split('\n');
    if (lines.length < 10) return content;

    const result: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const current = lines[i];
      let j = i + 1;
      while (j < lines.length && lines[j] === current && current.trim() !== '') {
        j++;
      }

      const count = j - i;
      if (count > 3) {
        result.push(current);
        result.push(`[... repeated ${count - 1} more times ...]`);
      } else {
        for (let k = i; k < j; k++) {
          result.push(lines[k]);
        }
      }
      i = j;
    }

    return result.join('\n');
  }
};

/**
 * Reduces noise from common package manager outputs and progress bars.
 */
export const NoiseReductionTransform: CompactionTransform = {
  name: 'noise-reduction',
  apply(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let removedCount = 0;

    for (const line of lines) {
      const low = line.toLowerCase();
      const isNoise = 
        low.includes('npm info') || 
        low.includes('npm warn') || 
        low.includes('npm verb') ||
        low.includes('yarn info') || 
        low.includes('yarn warn') ||
        (low.includes('fund') && low.includes('npm fund')) ||
        (low.includes('added') && low.includes('packages') && low.includes('audited') && line.length > 200); // very long summary lines

      if (isNoise) {
        removedCount++;
      } else {
        result.push(line);
      }
    }

    if (removedCount > 0) {
      result.push(`[... removed ${removedCount} lines of low-signal noise ...]`);
      return result.join('\n');
    }
    return content;
  }
};

/**
 * Pipeline of all default transforms.
 */
export function applyTransforms(content: string): string {
  let transformed = content;
  const transforms = [StackTraceTransform, RepeatLineTransform, NoiseReductionTransform];
  
  for (const transform of transforms) {
    transformed = transform.apply(transformed);
  }
  
  return transformed;
}
