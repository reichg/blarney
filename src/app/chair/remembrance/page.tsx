import styles from "@/app/chair/chair.module.css";
import { ChairRemembranceGallery } from "@/app/chair/remembrance/ChairRemembranceGallery";
import { PaginationNav } from "@/components/PaginationNav";
import { listChairRemembrancePhotosPage } from "@/lib/chairPhotos";
import { formatDateTime } from "@/lib/format";
import {
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";

export const dynamic = "force-dynamic";

type ChairRemembrancePageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

function summarizeMessage(message: string) {
  if (message.length <= 220) {
    return message;
  }

  return `${message.slice(0, 217)}...`;
}

export default async function ChairRemembrancePage({
  searchParams,
}: ChairRemembrancePageProps) {
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const { photos, pagination } =
    await listChairRemembrancePhotosPage(paginationParams);
  const remembrancePhotos = photos.map((photo) => ({
    id: photo.id,
    title: photo.caption ?? "N/A",
    caption: photo.caption,
    submitterEmail: photo.submitterEmail,
    submitterName: photo.submitterName,
    notePreview: photo.feedback
      ? summarizeMessage(photo.feedback.message)
      : null,
    note: photo.feedback?.message ?? null,
    receivedAtLabel: formatDateTime(photo.createdAt),
  }));

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>In Remembrance</h1>
          <p className={styles.pageIntro}>
            These uploads stay private to the chair. Preview them here, download
            individual photos as needed, or bundle a selected set into one
            remembrance ZIP.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {pagination.totalCount} remembrance photo
              {pagination.totalCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionIntro}>
              Select a page-sized set for a ZIP download or pull individual
              files when you only need one memory at a time.
            </p>
          </div>
        </div>
        {remembrancePhotos.length ? (
          <ChairRemembranceGallery photos={remembrancePhotos} />
        ) : (
          <section className={styles.panel}>
            <p className={styles.emptyState}>
              {pagination.isEmpty
                ? "Remembrance photos will appear here after someone includes one with a remembrance note."
                : "No remembrance photos on this page."}
            </p>
          </section>
        )}
        <PaginationNav
          label="Remembrance photos"
          pagination={pagination}
          searchParams={params}
        />
      </section>
    </>
  );
}
