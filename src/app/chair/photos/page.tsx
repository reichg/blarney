import { approvePhoto, rejectPhoto } from "@/app/actions/chairPhotos";
import styles from "@/app/chair/chair.module.css";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getPhotos() {
  try {
    return await db.photoSubmission.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function ChairPhotosPage() {
  const photos = await getPhotos();
  const pendingPhotos = photos.filter((photo) => photo.status === "PENDING");
  const reviewedPhotos = photos.filter((photo) => photo.status !== "PENDING");

  return (
    <>
      <div className={styles.topline}>
        <div>
          <p className="eyebrow">Private</p>
          <h1>Photo Review</h1>
        </div>
      </div>
      <section className={styles.photoGrid}>
        {pendingPhotos.map((photo) => (
          <article className={styles.panel} key={photo.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={photo.caption ?? "Pending Blarney photo"}
              className={styles.photoPreview}
              src={`/api/chair/photos/${photo.id}/view`}
            />
            <h2>{photo.caption ?? "Untitled photo"}</h2>
            <p className={styles.muted}>
              {photo.submitterName} · {photo.submitterEmail}
            </p>
            <div className={styles.actions}>
              <form action={approvePhoto} className={styles.compactForm}>
                <input name="id" type="hidden" value={photo.id} />
                <textarea
                  name="reviewNotes"
                  placeholder="Review notes"
                  rows={2}
                />
                <button className={styles.actionButton} type="submit">
                  Approve
                </button>
              </form>
              <form action={rejectPhoto} className={styles.compactForm}>
                <input name="id" type="hidden" value={photo.id} />
                <textarea
                  name="reviewNotes"
                  placeholder="Review notes"
                  rows={2}
                />
                <button className={styles.dangerButton} type="submit">
                  Reject
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
      <section className={styles.panel}>
        <h2>Reviewed</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Submitter</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {reviewedPhotos.map((photo) => (
                <tr key={photo.id}>
                  <td>{photo.caption ?? photo.s3Key}</td>
                  <td>{photo.submitterEmail}</td>
                  <td>
                    <span className={styles.statusPill}>{photo.status}</span>
                  </td>
                  <td>{photo.reviewNotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
