import { isFastMode } from './performanceMode';

// Register before reading storage so a mode change cannot race a new request.
export function createOptionalWorkGate(readSettings) {
  const active = new Set();
  return {
    cancel() {
      active.forEach(controller => controller.abort());
    },
    async run(operation, denied) {
      const controller = new AbortController();
      active.add(controller);
      try {
        if (isFastMode(await readSettings()) || controller.signal.aborted) return denied;
        const result = await operation(controller.signal);
        return controller.signal.aborted ? denied : result;
      } catch (error) {
        if (controller.signal.aborted) return denied;
        throw error;
      } finally {
        active.delete(controller);
      }
    }
  };
}
