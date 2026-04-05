'use client';

import {
  MiniKit,
  type SendHapticFeedbackInput,
} from '@worldcoin/minikit-js';

function sendWorldHaptic(payload: SendHapticFeedbackInput): void {
  if (typeof window === 'undefined') return;
  try {
    if (!MiniKit.isInstalled()) return;
    MiniKit.commands.sendHapticFeedback(payload);
  } catch {
    /* no-op outside World App or if command unavailable */
  }
}

/** Keypad, tabs, refetch, subtle UI ticks */
export function hapticSelection() {
  sendWorldHaptic({ hapticsType: 'selection-changed' });
}

/** Primary CTAs: continue, pay, confirm, back */
export function hapticPrimary() {
  sendWorldHaptic({ hapticsType: 'impact', style: 'medium' });
}

/** Successful completion */
export function hapticSuccess() {
  sendWorldHaptic({ hapticsType: 'notification', style: 'success' });
}

/** Validation or request failure */
export function hapticError() {
  sendWorldHaptic({ hapticsType: 'notification', style: 'error' });
}
