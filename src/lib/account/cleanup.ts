// Finishing an account deletion: remove the stored photo files that the SQL
// deletion job queued (QA report 5, F2). Files are removed through the storage
// API, never by deleting storage rows from SQL, which would orphan the objects.
// Takes a service-role client; run it after pdpa_process_deletion_requests().

interface QueueRow {
  id: string;
  path: string;
}

/** The small slice of the Supabase client this needs, so it can be tested with a fake. */
export interface CleanupClient {
  from(table: "avatar_cleanup_queue"): {
    select(cols: string): PromiseLike<{ data: QueueRow[] | null; error: { message: string } | null }>;
    delete(): { in(col: "id", ids: string[]): PromiseLike<{ error: { message: string } | null }> };
  };
  storage: {
    from(bucket: "avatars"): {
      remove(paths: string[]): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/** Returns how many files were removed. A queue row is deleted only after its file is gone. */
export async function drainAvatarCleanup(admin: CleanupClient): Promise<number> {
  const { data, error } = await admin.from("avatar_cleanup_queue").select("id, path");
  if (error || !data || data.length === 0) return 0;
  const { error: removeError } = await admin.storage.from("avatars").remove(data.map((r) => r.path));
  if (removeError) return 0; // keep the queue; try again next time
  await admin.from("avatar_cleanup_queue").delete().in("id", data.map((r) => r.id));
  return data.length;
}
