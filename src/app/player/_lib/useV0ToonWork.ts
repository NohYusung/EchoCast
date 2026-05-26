/**
 * @deprecated This file is deprecated. Use useToonWork with version option instead.
 *
 * Migration example:
 *
 * Before:
 * ```typescript
 * import { useV0ToonWork } from './useV0ToonWork';
 * const player = useV0ToonWork();
 * ```
 *
 * After:
 * ```typescript
 * import { useToonWork } from './useToonWork';
 * const player = useToonWork({ version: 'V0' });
 * ```
 */

import { useToonWork, ContentVersion } from './useToonWork';

/**
 * @deprecated Use useToonWork({ version: 'V0' }) instead
 */
export function useV0ToonWork() {
  return useToonWork({ version: 'V0' as ContentVersion });
}
