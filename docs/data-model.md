# Wishboard data model

## Scope and relationships

An account owns many lists. A list has a title and at least one entry. An entry has a name and may have a hyperlink. Each list may have one active, read-only share link. MySQL is the authoritative store; a signed-in client also keeps local list data and pending edits so it can work offline.

```text
users 1 ── * lists 1 ── * list_entries
                  └── 0..1 active share token
```

The previous Wishboard app used `lists` and `list_items` tables with a hash in the list URL. Brain-crack uses an email/password-protected collection and separate records. This design keeps the useful parent/child structure while making the account, list, entry, and share permissions distinct. It does not inherit the old app's public list index or brain-crack's practice of putting a password in a URL.

## Server records

| Record            | Fields                                                                                                | Rules                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`           | `id` UUID, `email`, `password_hash`, `created_at`                                                     | `email` is the login name, normalized to lowercase after trimming and unique. Store a password hash produced by a password hashing function, never the password. No password recovery or reset in the MVP.                                |
| `lists`           | `id` UUID, `user_id` FK, `title`, `revision`, `share_token`, `created_at`, `updated_at`, `deleted_at` | One owner. `revision` starts at 1 and increments on every committed content change or deletion. `share_token` is nullable and unique. A null token means the list has no active share link. `deleted_at` is a tombstone for offline sync. |
| `list_entries`    | `id` UUID, `list_id` FK, `name`, `url`, `position`, `created_at`, `updated_at`                        | Each entry belongs to exactly one list. `url` is null when absent. Sort by `position`, then `id` for a stable order. Names and titles must be nonblank after trimming.                                                                    |
| `sync_operations` | `id` UUID, `user_id` FK, `list_id`, `request_hash`, `result_revision`, `committed_at`                 | One row per accepted client mutation. A repeated ID with the same request returns its recorded result; a repeated ID with different content is rejected.                                                                                  |

UUIDs are created by the client so lists and entries made offline keep the same IDs after sync. IDs identify records; they grant no access. The server checks ownership for every private read or write.

The share token is a separate, cryptographically random bearer secret: generate at least 32 random bytes and encode them for a URL. Only the server creates or rotates it. A share URL such as `/share/<token>` resolves to exactly one list and returns its current title and entries without requiring login. It grants no write access or access to the owner's other lists or account. Rotating or clearing the token revokes the old link; deleting the list also revokes it. Shared pages should send `Referrer-Policy: no-referrer` so following an entry hyperlink does not disclose the token to that site.

## MySQL schema sketch

This is a proposed MySQL 8 schema, not a migration. Set each database session to UTC so stored timestamps are UTC. UUID and token columns use an ASCII binary collation so comparisons are exact. Application validation enforces nonblank text, valid `http:`/`https:` entry URLs when provided, and at least one entry per list.

```sql
CREATE TABLE users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lists (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(255) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
  share_token CHAR(43) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  UNIQUE KEY uq_lists_share_token (share_token),
  KEY ix_lists_user (user_id),
  CONSTRAINT fk_lists_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE list_entries (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  list_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NULL,
  position INT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_list_entries_order (list_id, position, id),
  CONSTRAINT fk_list_entries_list FOREIGN KEY (list_id)
    REFERENCES lists (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sync_operations (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  list_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash BINARY(32) NOT NULL,
  result_revision BIGINT UNSIGNED NOT NULL,
  committed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_sync_operations_user_list (user_id, list_id),
  CONSTRAINT fk_sync_operations_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sync_operations_list FOREIGN KEY (list_id)
    REFERENCES lists (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Creating a list inserts its initial entry and sync operation in the same transaction. Deleting the last entry is rejected; deleting the whole list is a separate operation. List deletion sets `deleted_at`, clears `share_token`, and increments `revision` while retaining the row so an offline client can detect the deletion. Normal owner queries exclude tombstones. Every list or entry mutation, including reorder and deletion, is one transaction that checks the expected list revision, updates the data, increments the revision, and records its operation ID. A foreign key cannot enforce the minimum of one child row, so the server must enforce that invariant at its write boundary.

## Offline copy and synchronization

The client persists each signed-in user's last known lists, their server revisions, and a durable outbox of local mutations. A local edit updates the visible copy and outbox in one durable local transaction before reporting success; IndexedDB is a suitable store for this. A new offline list includes its first entry in the same local mutation. The outbox survives reloads; logout must not silently discard unsynced edits.

When connectivity returns, the client sends pending changes for one list in order. Each write carries a stable operation ID and the revision on which the local changes were based. The server checks for an operation previously committed by this owner with the same request, then applies a new operation only when the owner and revision match. It returns the new revision and canonical list. A successful acknowledgment removes only the acknowledged operation from the outbox. New list creation uses the client UUID and an operation ID so retries cannot create duplicates.

If the server revision has changed, the server returns a conflict with the current list. The client keeps both the unsynced local version and the server version and asks the owner to resolve them; it must not silently overwrite either. The same rule applies to an offline deletion. Generating, rotating, or revoking a share link requires a server round trip, so the UI should not claim the link changed while offline. Shared visitors see only server-committed data, which may lag the owner's offline edits.

## Access and account behavior

- Only an authenticated owner can enumerate, read, edit, delete, or share their lists. A share token authorizes read access to its one list only.
- Password verification happens on the server. Use a contemporary password hashing API (for example PHP `password_hash` and `password_verify` with Argon2id where available) and authenticated sessions. Passwords and password hashes never appear in URLs, share responses, or local list data.
- Account creation requires a connection. An existing signed-in client may edit cached lists offline, but it cannot use an expired session to sync until it authenticates again.
- The server validates every incoming field and rejects malformed or unauthorized mutations. The browser escapes list text when rendering it, and entry hyperlinks use safe URL schemes.

## MVP decisions to confirm

- Whether owners can explicitly merge conflicts or must choose one complete version of a list. The revision protocol supports either without losing data.
- Whether shared lists should be indexable by search engines. Until decided, serve them with `noindex` and avoid putting share URLs in a public index.
