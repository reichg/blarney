import {
  approvePhoto,
  deletePendingPhoto,
  rejectPhoto,
  returnApprovedPhotoToPending,
} from "@/app/actions/chairPhotos";
import styles from "@/app/chair/chair.module.css";
import { PaginationNav } from "@/components/PaginationNav";
import {
  listPendingChairGalleryPhotosPage,
  listReviewedChairGalleryPhotosPage,
} from "@/lib/chairPhotos";
import {
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";

export const dynamic = "force-dynamic";

type ChairPhotosPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

function summarizeMessage(message: string) {
  if (message.length <= 140) {
    return message;
  }

  return `${message.slice(0, 137)}...`;
}

export default async function ChairPhotosPage({
  searchParams,
}: ChairPhotosPageProps) {
  const params = await searchParams;
  const pendingPaginationParams = parsePaginationParams(params, {
    pageKey: "pendingPage",
    pageSizeKey: "pendingPageSize",
  });
  const reviewedPaginationParams = parsePaginationParams(params, {
    pageKey: "reviewedPage",
    pageSizeKey: "reviewedPageSize",
  });
  const [pendingResult, reviewedResult] = await Promise.all([
    listPendingChairGalleryPhotosPage(pendingPaginationParams),
    listReviewedChairGalleryPhotosPage(reviewedPaginationParams),
  ]);
  const pendingPhotos = pendingResult.photos;
  const reviewedPhotos = reviewedResult.photos;

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Photo Review</h1>
          <p className={styles.pageIntro}>
            Moderate public gallery uploads here. Pending and reviewed lists
            keep separate pagination so you can work both queues without losing
            your place.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {pendingResult.pagination.totalCount} pending
            </span>
            <span className={styles.pageMeta}>
              {reviewedResult.pagination.totalCount} reviewed
            </span>
          </div>
        </div>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Pending review</h2>
            <p className={styles.sectionIntro}>
              These uploads remain private until approved. Add review notes when
              you approve, reject, or delete a pending submission.
            </p>
          </div>
        </div>
        <section className={styles.photoGrid}>
          {pendingPhotos.length ? (
            pendingPhotos.map((photo) => (
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
                {photo.feedback ? (
                  <p className={styles.muted}>
                    {summarizeMessage(photo.feedback.message)}
                  </p>
                ) : null}
                <div className={styles.moderationActions}>
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
                  <form
                    action={deletePendingPhoto}
                    className={styles.actionOnlyForm}
                  >
                    <input name="id" type="hidden" value={photo.id} />
                    <button className={styles.dangerButton} type="submit">
                      Delete permanently
                    </button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <article className={styles.panel}>
              <p className={styles.emptyState}>
                {pendingResult.pagination.isEmpty
                  ? "Pending uploads will appear here."
                  : "No pending uploads on this page."}
              </p>
            </article>
          )}
        </section>
        <PaginationNav
          label="Pending uploads"
          pagination={pendingResult.pagination}
          searchParams={params}
        />
      </section>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Reviewed photos</h2>
            <p className={styles.sectionIntro}>
              Approved photos can move back to pending. Rejected photos stay
              private and do not return to the public gallery.
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Submitter</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewedPhotos.length ? (
                reviewedPhotos.map((photo) => (
                  <tr key={photo.id}>
                    <td>
                      <div className={styles.tablePhotoCell}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={photo.caption ?? "Reviewed Blarney photo"}
                          className={styles.tablePhotoThumb}
                          src={`/api/chair/photos/${photo.id}/view`}
                        />
                      </div>
                    </td>
                    <td>{photo.submitterEmail}</td>
                    <td>
                      <span className={styles.statusPill}>{photo.status}</span>
                    </td>
                    <td className={styles.notesCell}>{photo.reviewNotes}</td>
                    <td className={styles.reviewActions}>
                      {photo.status === "APPROVED" ? (
                        <form
                          action={returnApprovedPhotoToPending}
                          className={styles.tableActionForm}
                        >
                          <input name="id" type="hidden" value={photo.id} />
                          <textarea
                            name="reviewNotes"
                            placeholder="Optional return notes"
                            rows={2}
                          />
                          <button
                            className={styles.secondaryActionButton}
                            type="submit"
                          >
                            Return to pending
                          </button>
                        </form>
                      ) : (
                        <span className={styles.muted}>
                          Rejected photos stay private.
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={styles.emptyState} colSpan={5}>
                    {reviewedResult.pagination.isEmpty
                      ? "Reviewed photos will appear here after chair action."
                      : "No reviewed photos on this page."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationNav
          label="Reviewed photos"
          pagination={reviewedResult.pagination}
          searchParams={params}
        />
      </section>
    </>
  );
}
