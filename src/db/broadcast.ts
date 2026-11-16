// src/db/broadcast.ts
// BroadcastChannel multi-tab guard (spec §4.7, M1 skeleton).
//
// Every tab opens a channel and announces project saves with a revision.
// Other tabs receive the notice and can refresh / offer "Take over".
// A tab is read-only until the user takes over after a remote save.

const CHANNEL = 'roux-studio:project';

export interface SaveNotice {
  type: 'project-saved';
  projectId: string;
  revision: number;
  updatedAt: string;
  tabId: string;
}

const revisionByProject = new Map<string, number>();

export function nextRevision(projectId: string): number {
  const next = (revisionByProject.get(projectId) ?? 0) + 1;
  revisionByProject.set(projectId, next);
  return next;
}

export function currentRevision(projectId: string): number {
  return revisionByProject.get(projectId) ?? 0;
}

export class ProjectBroadcast {
  private readonly channel: BroadcastChannel;
  readonly tabId: string;
  private readonly handlers = new Set<(notice: SaveNotice) => void>();

  constructor() {
    this.tabId = crypto.randomUUID();
    this.channel = new BroadcastChannel(CHANNEL);
    this.channel.onmessage = (event: MessageEvent<unknown>) => {
      const notice = event.data as SaveNotice | undefined;
      if (!notice || notice.type !== 'project-saved') return;
      // Ignore our own announcements.
      if (notice.tabId === this.tabId) return;
      revisionByProject.set(
        notice.projectId,
        Math.max(currentRevision(notice.projectId), notice.revision),
      );
      this.handlers.forEach((h) => h(notice));
    };
  }

  announce(projectId: string): SaveNotice {
    const revision = nextRevision(projectId);
    const notice: SaveNotice = {
      type: 'project-saved',
      projectId,
      revision,
      updatedAt: new Date().toISOString(),
      tabId: this.tabId,
    };
    this.channel.postMessage(notice);
    return notice;
  }

  subscribe(handler: (notice: SaveNotice) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close(): void {
    this.handlers.clear();
    this.channel.close();
  }
}

export const projectBroadcast = new ProjectBroadcast();
