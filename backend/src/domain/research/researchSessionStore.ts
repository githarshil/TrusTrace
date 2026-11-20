import type { ResearchSession } from "./types.js";

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes transient memory retention
const MAX_ACTIVE_SESSIONS = 100;

/**
 * Ephemeral in-memory research session store.
 * Preserves Tip Autopsy's strict privacy posture: user-imported Telegram messages,
 * transcripts, and chat conversations are never persisted to PostgreSQL or disk,
 * and expire automatically after the TTL window.
 */
export class ResearchSessionStore {
  private readonly sessions = new Map<string, ResearchSession>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_SESSION_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (Date.parse(session.expires_at) <= now) {
        this.sessions.delete(id);
      }
    }
  }

  save(session: ResearchSession): ResearchSession {
    this.pruneExpired();
    if (this.sessions.size >= MAX_ACTIVE_SESSIONS && !this.sessions.has(session.session_id)) {
      // Evict oldest session first
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey) this.sessions.delete(oldestKey);
    }
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString();
    const updated: ResearchSession = {
      ...session,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    };
    this.sessions.set(updated.session_id, updated);
    return updated;
  }

  get(sessionId: string): ResearchSession | null {
    this.pruneExpired();
    const found = this.sessions.get(sessionId);
    if (!found) return null;
    if (Date.parse(found.expires_at) <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return found;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const defaultResearchSessionStore = new ResearchSessionStore();
