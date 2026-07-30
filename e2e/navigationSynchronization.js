const NAVIGATION_CONTEXT_ERRORS = [
  /execution context was destroyed/i,
  /cannot find context with specified id/i,
  /inspected target navigated or closed/i,
  /protocol error \(runtime\.(?:callfunctionon|evaluate)\): target closed/i
];

export function isNavigationContextError(error) {
  const message = String(error?.message || '');
  return NAVIGATION_CONTEXT_ERRORS.some(pattern => pattern.test(message));
}

export async function mutateStorageWithNavigation(
  page,
  operation,
  {
    navigationTimeout = 2000,
    mutationTimeout = 2500,
    reloadTimeout = 5500
  } = {}
) {
  let mutationTimer;
  const navigationPromise = page.waitForNavigation({
    waitUntil: 'load',
    timeout: navigationTimeout
  }).then(() => true, () => false);
  const mutationPromise = Promise.race([
    operation().then(
      value => ({ ok: true, value }),
      error => ({ ok: false, error })
    ),
    new Promise(resolve => {
      mutationTimer = setTimeout(
        () => resolve({ ok: false, timeout: true }),
        mutationTimeout
      );
    })
  ]);

  const [appNavigated, mutationResult] = await Promise.all([
    navigationPromise,
    mutationPromise
  ]);
  clearTimeout(mutationTimer);

  if (!mutationResult.ok) {
    const navigationDestroyedContext = (
      appNavigated
      && mutationResult.error
      && isNavigationContextError(mutationResult.error)
    );
    if (!navigationDestroyedContext) {
      if (mutationResult.error) throw mutationResult.error;
      throw new Error('storage mutation did not settle');
    }
  }
  if (!appNavigated) {
    await page.reload({ waitUntil: 'load', timeout: reloadTimeout });
  }
  return {
    appNavigated,
    mutationSettled: mutationResult.ok
  };
}
