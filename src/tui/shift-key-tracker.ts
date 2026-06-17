import readline from 'node:readline';

export interface KeypressMeta {
  name?: string;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

let initialized = false;
let shiftHeld = false;
let shiftHeldTimer: NodeJS.Timeout | null = null;
let pendingReturnKeypress: KeypressMeta | null = null;

function markShiftHeld(): void {
  shiftHeld = true;
  if (shiftHeldTimer) {
    clearTimeout(shiftHeldTimer);
  }
  shiftHeldTimer = setTimeout(() => {
    shiftHeld = false;
    shiftHeldTimer = null;
  }, 1500);
}

function isReturnName(name: string | undefined): boolean {
  return name === 'return' || name === 'enter' || name === 'linefeed';
}

export function initShiftKeyTracker(): void {
  if (initialized || !process.stdin.isTTY) {
    return;
  }
  initialized = true;

  readline.emitKeypressEvents(process.stdin);

  process.stdin.on('keypress', (_str, key) => {
    if (!key || typeof key !== 'object') {
      return;
    }

    const meta: KeypressMeta = {
      name: key.name,
      shift: Boolean(key.shift),
      ctrl: Boolean(key.ctrl),
      meta: Boolean(key.meta),
    };

    if (key.shift || key.name === 'leftshift' || key.name === 'rightshift') {
      markShiftHeld();
    }

    if (isReturnName(meta.name)) {
      pendingReturnKeypress = meta;
      return;
    }

    pendingReturnKeypress = null;
  });
}

export function consumeShiftEnterIntent(inkReturn: boolean): boolean {
  initShiftKeyTracker();

  if (!inkReturn) {
    return false;
  }

  const pending = pendingReturnKeypress;
  pendingReturnKeypress = null;

  if (pending?.shift && isReturnName(pending.name)) {
    return true;
  }

  return shiftHeld;
}

export function resetShiftKeyTrackerForTests(): void {
  initialized = false;
  shiftHeld = false;
  pendingReturnKeypress = null;
  if (shiftHeldTimer) {
    clearTimeout(shiftHeldTimer);
    shiftHeldTimer = null;
  }
}