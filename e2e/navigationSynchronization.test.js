import { describe, expect, it, jest } from '@jest/globals';
import { mutateStorageWithNavigation } from './navigationSynchronization';

describe('storage mutation navigation synchronization', () => {
  it('propagates a real mutation error even when navigation also completes', async() => {
    const mutationError = new Error('chrome.runtime.lastError: quota exceeded');
    const page = {
      waitForNavigation: jest.fn().mockResolvedValue(),
      reload: jest.fn()
    };

    await expect(mutateStorageWithNavigation(
      page,
      jest.fn().mockRejectedValue(mutationError)
    )).rejects.toBe(mutationError);

    expect(page.reload).not.toHaveBeenCalled();
  });

  it('tolerates destroyed execution context only with proven navigation', async() => {
    const page = {
      waitForNavigation: jest.fn().mockResolvedValue(),
      reload: jest.fn()
    };

    await expect(mutateStorageWithNavigation(
      page,
      jest.fn().mockRejectedValue(new Error(
        'Execution context was destroyed, most likely because of a navigation.'
      ))
    )).resolves.toEqual({
      appNavigated: true,
      mutationSettled: false
    });

    expect(page.reload).not.toHaveBeenCalled();
  });

  it('propagates destroyed execution context when navigation is not proven', async() => {
    const contextError = new Error('Cannot find context with specified id');
    const page = {
      waitForNavigation: jest.fn().mockRejectedValue(new Error('no navigation')),
      reload: jest.fn()
    };

    await expect(mutateStorageWithNavigation(
      page,
      jest.fn().mockRejectedValue(contextError)
    )).rejects.toBe(contextError);

    expect(page.reload).not.toHaveBeenCalled();
  });

  it('does not treat mutation timeout as navigation context destruction', async() => {
    const page = {
      waitForNavigation: jest.fn().mockResolvedValue(),
      reload: jest.fn()
    };

    await expect(mutateStorageWithNavigation(
      page,
      jest.fn(() => new Promise(resolve => {
        void resolve;
      })),
      { mutationTimeout: 5 }
    )).rejects.toThrow('storage mutation did not settle');

    expect(page.reload).not.toHaveBeenCalled();
  });

  it('serializes fallback reload after a settled mutation without navigation', async() => {
    const order = [];
    const page = {
      waitForNavigation: jest.fn().mockRejectedValue(new Error('no navigation')),
      reload: jest.fn(() => {
        order.push('reload');
        return Promise.resolve();
      })
    };

    await expect(mutateStorageWithNavigation(
      page,
      jest.fn(() => {
        order.push('mutation');
        return Promise.resolve();
      })
    )).resolves.toEqual({
      appNavigated: false,
      mutationSettled: true
    });

    expect(order).toEqual(['mutation', 'reload']);
  });
});
