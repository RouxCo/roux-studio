// src/db/broadcast.test.ts
// BroadcastChannel multi-tab guard tests (spec §4.7, M1 skeleton).
// Node has native BroadcastChannel since v16; announcements deliver asynchronously,
// so each test waits a tick for cross-instance delivery.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectBroadcast, type SaveNotice, nextRevision, currentRevision } from './broadcast';

let b1: ProjectBroadcast;
let b2: ProjectBroadcast;

beforeEach(() => {
  b1 = new ProjectBroadcast();
  b2 = new ProjectBroadcast();
});

afterEach(() => {
  b1.close();
  b2.close();
});

function waitForNotice(instance: ProjectBroadcast, projectId: string): Promise<SaveNotice> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsub?.();
      reject(new Error(`timeout waiting for notice for ${projectId}`));
    }, 1000);
    unsub = instance.subscribe((notice) => {
      if (notice.projectId === projectId) {
        clearTimeout(timer);
        unsub!();
        resolve(notice);
      }
    });
  });
}

describe('broadcast', () => {
  it('nextRevision increments per project; currentRevision tracks it', () => {
    expect(ProjectBroadcast.prototype).toBeDefined();
    // Use the static-ish helpers via a scratch instance
    const scratch = new ProjectBroadcast();
    expect(currentRevision('proj-a')).toBe(0);
    expect(nextRevision('proj-a')).toBe(1);
    expect(currentRevision('proj-a')).toBe(1);
    expect(nextRevision('proj-a')).toBe(2);
    expect(currentRevision('proj-b')).toBe(0); // independent per project
    scratch.close();
  });

  it('announce returns a SaveNotice with correct fields', () => {
    const notice = b1.announce('proj-1');
    expect(notice.type).toBe('project-saved');
    expect(notice.projectId).toBe('proj-1');
    expect(typeof notice.revision).toBe('number');
    expect(notice.revision).toBeGreaterThan(0);
    expect(typeof notice.updatedAt).toBe('string');
    expect(notice.tabId).toBe(b1.tabId);
  });

  it('an announcement on one instance is received by another', async () => {
    const promise = waitForNotice(b2, 'proj-1');
    b1.announce('proj-1');
    const notice = await promise;
    expect(notice.projectId).toBe('proj-1');
    expect(notice.tabId).toBe(b1.tabId);
  });

  it('unsubscribe stops delivery', async () => {
    const unsub = b2.subscribe(() => {
      throw new Error('should not be delivered after unsubscribe');
    });
    unsub();
    b1.announce('proj-1');
    await new Promise((r) => setTimeout(r, 80));
  });

  it('ignores its own announcements', async () => {
    let received = false;
    const unsub = b1.subscribe(() => {
      received = true;
    });
    b1.announce('proj-1');
    await new Promise((r) => setTimeout(r, 80));
    expect(received).toBe(false);
    unsub();
  });

  it('close stops delivery', async () => {
    const b3 = new ProjectBroadcast();
    const promise = waitForNotice(b3, 'proj-1');
    b3.close();
    b1.announce('proj-1');
    // Should time out because b3 is closed.
    await expect(promise).rejects.toThrow(/timeout/);
  });
});
