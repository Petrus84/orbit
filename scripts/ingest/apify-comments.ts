// Funções puras do ingest-apify-comments (testáveis sem banco).
import { createHash } from "crypto";

export interface ApifyComment {
  id?: string | number | null;
  text?: string | null;
  ownerUsername?: string | null;
  timestamp?: string | null;
  likesCount?: number | null;
}
export interface ApifyPost {
  shortCode?: string | null;
  ownerUsername?: string | null;
  commentsCount?: number | null;
  latestComments?: ApifyComment[] | null;
}
export interface CommentRow {
  client_id: string;
  post_id: string;
  ig_shortcode: string;
  ig_comment_id: string;
  comment_text: string;
  commented_at: string | null;
  author_username: string;
  /** Legado: só preenchido se COMMENT_HASH_SALT estiver definido. */
  author_hash: string | null;
  is_owner_reply: boolean;
  likes_count: number | null;
}

export const hashAuthor = (salt: string, username: string): string =>
  createHash("sha256")
    .update(`${salt}:${username.toLowerCase()}`)
    .digest("hex");

/** Comentários de um post -> linhas. Texto vazio e id ausente são descartados; dono marcado, não removido. */
export function buildRows(
  post: ApifyPost,
  clientId: string,
  postId: string,
  dbHandle: string,
  salt?: string,
): CommentRow[] {
  const rows: CommentRow[] = [];
  for (const c of post.latestComments ?? []) {
    const text = (c.text ?? "").trim();
    const id = c.id != null ? String(c.id) : "";
    const author = (c.ownerUsername ?? "").trim();
    if (!text || !id || !author || !post.shortCode) continue;
    rows.push({
      client_id: clientId,
      post_id: postId,
      ig_shortcode: post.shortCode,
      ig_comment_id: id,
      comment_text: text,
      commented_at: c.timestamp ?? null,
      author_username: author,
      author_hash: salt ? hashAuthor(salt, author) : null,
      is_owner_reply: author.toLowerCase() === dbHandle.toLowerCase(),
      likes_count: typeof c.likesCount === "number" ? c.likesCount : null,
    });
  }
  return rows;
}

/** Posts com >= min comentários que não são do dono (regra da régua: min 3). */
export function qualifiedPosts(rows: CommentRow[], min = 3): number {
  const per = new Map<string, number>();
  for (const r of rows)
    if (!r.is_owner_reply) per.set(r.post_id, (per.get(r.post_id) ?? 0) + 1);
  return [...per.values()].filter((n) => n >= min).length;
}
