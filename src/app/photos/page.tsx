import styles from "@/app/forms.module.css";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { db } from "@/lib/db";
import photoStyles from "./photos.module.css";

export const dynamic = "force-dynamic";

async function getApprovedPhotos() {
  try {
    return await db.photoSubmission.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function PhotosPage() {
  const photos = await getApprovedPhotos();

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
              <div className={photoStyles.gallery}>
                {photos.map((photo) => (
                  <figure className={photoStyles.photo} key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={photo.caption ?? "Blarney tournament photo"}
                      src={`/api/photos/${photo.id}/view`}
                    />
                    {photo.caption ? (
                      <figcaption>{photo.caption}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className={photoStyles.emptyGallery}>
                Approved tournament photos will appear here.
              </div>
            )}
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
