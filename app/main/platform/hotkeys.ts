import { isMac } from './os'

/** The global toggle accelerator string for Electron's globalShortcut. */
export const TOGGLE_OVERLAY_ACCELERATOR = 'CommandOrControl+Shift+Space'

/** Human-readable label for display in UI / logs. */
export const TOGGLE_OVERLAY_LABEL = isMac ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space'
