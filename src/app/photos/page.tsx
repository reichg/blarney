import styles from "@/app/forms.module.css";
import { PaginationNav } from "@/components/PaginationNav";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { db } from "@/lib/db";
import {
  buildPaginationState,
  parsePaginationParams,
  type PaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
import { PhotoGallery } from "./PhotoGallery";
import photoStyles from "./photos.module.css";

export const dynamic = "force-dynamic";

type PhotosPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

async function getApprovedPhotos(pagination: PaginationParams) {
  const where = {
    approvedS3Key: { not: null },
    purpose: "GALLERY" as const,
    status: "APPROVED" as const,
  };

  try {
    const [photos, totalCount] = await Promise.all([
      db.photoSubmission.findMany({
        where,
        orderBy: [{ approvedAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      db.photoSubmission.count({ where }),
    ]);

    return {
      photos,
      pagination: buildPaginationState(pagination, totalCount),
    };
  } catch {
    return {
      photos: [],
      pagination: buildPaginationState(pagination, 0),
    };
  }
}

export default async function PhotosPage({ searchParams }: PhotosPageProps) {
  const params = await searchParams;
  const paginationParams = parsePaginationParams(params);
  const { photos, pagination } = await getApprovedPhotos(paginationParams);

  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className="eyebrow">Past Photos</p>
          <h1 className="section-title">
            Tournament memories, carefully kept.
          </h1>
          <p>Approved photos appear here after chair review.</p>
        </div>
      </header>
      <section className={styles.formSection}>
        <div className={photoStyles.layout}>
          <div>
            {photos.length ? (
              <PhotoGallery
                photos={photos.map((photo) => ({
                  id: photo.id,
                  caption: photo.caption,
                }))}
              />
            ) : (
              <div className={photoStyles.emptyGallery}>
                {pagination.isEmpty
                  ? "Approved photos will appear here."
                  : "No approved photos on this page."}
              </div>
            )}
            <PaginationNav
              label="Approved photos"
              pagination={pagination}
              searchParams={params}
            />
          </div>
          <aside className={styles.panel}>
            <h2>Submit a Photo</h2>
            <p>Photos upload to S3 for chair review before public display.</p>
            <PhotoUploadForm />
          </aside>
        </div>
      </section>
    </>
  );
}
