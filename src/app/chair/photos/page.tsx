import {
  approvePhoto,
  rejectPhoto,
  returnApprovedPhotoToPending,
} from "@/app/actions/chairPhotos";
import styles from "@/app/chair/chair.module.css";
import { displayValue, joinSearchText } from "@/app/chair/display";
import { FilterableCardGrid } from "@/app/chair/FilterableCardGrid";
import {
  parseChairListFilterParam,
  pickSearchParams,
} from "@/app/chair/listFiltering";
import { type ChairPhotosPageProps } from "@/app/chair/photos/type";
import { PreviewDetailCard } from "@/app/chair/PreviewDetailCard";
import { PaginationNav } from "@/components/PaginationNav";
import { requireChairPageAuth } from "@/lib/chairAuth.server";
import {
  listPendingChairGalleryPhotosPage,
  listReviewedChairGalleryPhotosPage,
} from "@/lib/chairPhotos";
import { formatDateTime } from "@/lib/format";
import {
  parsePaginationParams,
  type SearchParamsRecord,
} from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const pendingFilterParamKey = "pendingFilter";
const reviewedFilterParamKey = "reviewedFilter";

function parsePendingPhotoFilter(searchParams: SearchParamsRecord | undefined) {
  const filterValue = parseChairListFilterParam(
    searchParams,
    pendingFilterParamKey,
  );

  return ["caption:yes", "caption:no", "feedback:yes", "feedback:no"].includes(
    filterValue,
  )
    ? filterValue
    : "";
}

function parseReviewedPhotoFilter(
  searchParams: SearchParamsRecord | undefined,
) {
  const filterValue = parseChairListFilterParam(
    searchParams,
    reviewedFilterParamKey,
  );

  return ["notes:yes", "notes:no", "caption:yes", "caption:no"].includes(
    filterValue,
  )
    ? filterValue
    : "";
}

function buildPendingPhotoWhere(
  filterValue: string,
): Prisma.PhotoSubmissionWhereInput | undefined {
  switch (filterValue) {
    case "caption:yes":
      return {
        AND: [{ caption: { not: null } }, { NOT: { caption: "" } }],
      };
    case "caption:no":
      return {
        OR: [{ caption: null }, { caption: "" }],
      };
    case "feedback:yes":
      return {
        feedback: {
          isNot: null,
        },
      };
    case "feedback:no":
      return {
        feedback: {
          is: null,
        },
      };
    default:
      return undefined;
  }
}

function buildReviewedPhotoWhere(
  filterValue: string,
): Prisma.PhotoSubmissionWhereInput | undefined {
  switch (filterValue) {
    case "notes:yes":
      return {
        AND: [{ reviewNotes: { not: null } }, { NOT: { reviewNotes: "" } }],
      };
    case "notes:no":
      return {
        OR: [{ reviewNotes: null }, { reviewNotes: "" }],
      };
    case "caption:yes":
      return {
        AND: [{ caption: { not: null } }, { NOT: { caption: "" } }],
      };
    case "caption:no":
      return {
        OR: [{ caption: null }, { caption: "" }],
      };
    default:
      return undefined;
  }
}

export default async function ChairPhotosPage({
  searchParams,
}: ChairPhotosPageProps) {
  await requireChairPageAuth("/chair/photos");

  const params = await searchParams;
  const pendingPaginationParams = parsePaginationParams(params, {
    pageKey: "pendingPage",
    pageSizeKey: "pendingPageSize",
  });
  const reviewedPaginationParams = parsePaginationParams(params, {
    pageKey: "reviewedPage",
    pageSizeKey: "reviewedPageSize",
  });
  const pendingFilter = parsePendingPhotoFilter(params);
  const reviewedFilter = parseReviewedPhotoFilter(params);
  const photoSearchParams = pickSearchParams(params, [
    pendingPaginationParams.pageKey,
    pendingPaginationParams.pageSizeKey,
    reviewedPaginationParams.pageKey,
    reviewedPaginationParams.pageSizeKey,
  ]);

  if (pendingFilter) {
    photoSearchParams[pendingFilterParamKey] = pendingFilter;
  }

  if (reviewedFilter) {
    photoSearchParams[reviewedFilterParamKey] = reviewedFilter;
  }

  const [pendingResult, reviewedResult] = await Promise.all([
    listPendingChairGalleryPhotosPage(
      pendingPaginationParams,
      buildPendingPhotoWhere(pendingFilter),
    ),
    listReviewedChairGalleryPhotosPage(
      reviewedPaginationParams,
      buildReviewedPhotoWhere(reviewedFilter),
    ),
  ]);
  const pendingPhotos = pendingResult.photos;
  const reviewedPhotos = reviewedResult.photos;
  const pendingSearchItems = pendingPhotos.map((photo) => ({
    id: photo.id,
    searchText: joinSearchText([
      photo.caption,
      photo.submitterName,
      photo.submitterEmail,
      photo.feedback?.message,
    ]),
    filters: [
      photo.caption ? "caption:yes" : "caption:no",
      photo.feedback ? "feedback:yes" : "feedback:no",
    ],
  }));
  const reviewedSearchItems = reviewedPhotos.map((photo) => ({
    id: photo.id,
    searchText: joinSearchText([
      photo.caption,
      photo.submitterName,
      photo.submitterEmail,
      photo.reviewNotes,
      photo.feedback?.message,
    ]),
    filters: [
      photo.reviewNotes ? "notes:yes" : "notes:no",
      photo.caption ? "caption:yes" : "caption:no",
    ],
  }));
  const pendingFilters = [
    { value: "caption:yes", label: "Has caption" },
  ];
  const reviewedFilters = [
    { value: "notes:yes", label: "Has review notes" },
    { value: "notes:no", label: "No review notes" },
    { value: "caption:yes", label: "Has caption" },
  ];

  return (
    <>
      <div className={styles.topline}>
        <div className={styles.pageHeaderCopy}>
          <p className="eyebrow">Private</p>
          <h1>Photo Review</h1>
          <p className={styles.pageIntro}>
            Moderate public gallery uploads here. Pending and approved lists
            keep separate pagination so you can work both queues without losing
            your place.
          </p>
          <div className={styles.pageMetaBar}>
            <span className={styles.pageMeta}>
              {pendingResult.pagination.totalCount} pending
            </span>
            <span className={styles.pageMeta}>
              {reviewedResult.pagination.totalCount} approved
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
              approving a pending submission. Rejecting deletes the upload
              permanently.
            </p>
          </div>
        </div>
        {pendingPhotos.length ? (
          <FilterableCardGrid
            className={styles.photoReviewGrid}
            emptyMessage="No pending uploads match this search on the current page."
            filterAllLabel="All pending uploads"
            filters={pendingFilters}
            items={pendingSearchItems}
            pagination={pendingResult.pagination}
            resultLabel="pending uploads"
            searchLabel="Search pending uploads"
            searchPlaceholder="Search captions, submitters, feedback"
            urlBackedFilter={{
              value: pendingFilter,
              searchParams: photoSearchParams,
              filterParamKey: pendingFilterParamKey,
              pageParamKey: pendingPaginationParams.pageKey,
            }}
          >
            {pendingPhotos.map((photo) => {
              const caption = displayValue(photo.caption);
              const submitter = displayValue(photo.submitterName);
              const feedbackMessage = photo.feedback?.message ?? null;

              return (
                <PreviewDetailCard
                  className={styles.photoReviewCard}
                  actions={
                    <div className={styles.moderationActions}>
                      <form
                        action={approvePhoto}
                        className={styles.compactForm}
                      >
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
                        <button className={styles.dangerButton} type="submit">
                          Reject and delete
                        </button>
                      </form>
                    </div>
                  }
                  eyebrow="Pending photo"
                  key={photo.id}
                  openLabel={`Open pending photo details for ${caption}`}
                  preview={
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="Pending Blarney photo preview"
                        className={styles.photoPreview}
                        loading="lazy"
                        src={`/api/chair/photos/${photo.id}/view`}
                      />
                      <p className={styles.cardKicker}>Pending review</p>
                      <h3 className={styles.cardTitle}>{caption}</h3>
                      <p className={styles.cardMeta}>{submitter}</p>
                      <p className={styles.cardMeta}>
                        {displayValue(photo.submitterEmail)}
                      </p>
                    </>
                  }
                  title={caption}
                >
                  <div className={styles.detailStack}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="Pending Blarney photo"
                      className={styles.detailImage}
                      src={`/api/chair/photos/${photo.id}/view`}
                    />
                    <div className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <span>Caption</span>
                        <p>{caption}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Submitter</span>
                        <p>{submitter}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Email</span>
                        <p>{displayValue(photo.submitterEmail)}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Received</span>
                        <p>{formatDateTime(photo.createdAt)}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Feedback</span>
                        <p>{displayValue(feedbackMessage)}</p>
                      </div>
                    </div>
                  </div>
                </PreviewDetailCard>
              );
            })}
          </FilterableCardGrid>
        ) : (
          <article className={styles.panel}>
            <p className={styles.emptyState}>
              {pendingResult.pagination.isEmpty
                ? "Pending uploads will appear here."
                : "No pending uploads on this page."}
            </p>
          </article>
        )}
        <PaginationNav
          label="Pending uploads"
          pagination={pendingResult.pagination}
          searchParams={photoSearchParams}
        />
      </section>
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeading}>
            <h2 className={styles.sectionTitle}>Approved photos</h2>
            <p className={styles.sectionIntro}>
              Approved photos can move back to pending. Rejected uploads are
              deleted and do not appear here.
            </p>
          </div>
        </div>
        {reviewedPhotos.length ? (
          <FilterableCardGrid
            className={styles.photoReviewGrid}
            emptyMessage="No approved photos match this search on the current page."
            filterAllLabel="All approved photos"
            filters={reviewedFilters}
            items={reviewedSearchItems}
            pagination={reviewedResult.pagination}
            resultLabel="approved photos"
            searchLabel="Search approved photos"
            searchPlaceholder="Search captions, submitters, notes"
            urlBackedFilter={{
              value: reviewedFilter,
              searchParams: photoSearchParams,
              filterParamKey: reviewedFilterParamKey,
              pageParamKey: reviewedPaginationParams.pageKey,
            }}
          >
            {reviewedPhotos.map((photo) => {
              const caption = displayValue(photo.caption);
              const submitter = displayValue(photo.submitterName);
              const reviewNotes = displayValue(photo.reviewNotes);

              return (
                <PreviewDetailCard
                  actions={
                    <form
                      action={returnApprovedPhotoToPending}
                      className={styles.compactForm}
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
                  }
                  className={styles.photoReviewCard}
                  eyebrow="Approved photo"
                  key={photo.id}
                  openLabel={`Open approved photo details for ${caption}`}
                  preview={
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="Approved Blarney photo preview"
                        className={styles.photoPreview}
                        loading="lazy"
                        src={`/api/chair/photos/${photo.id}/view`}
                      />
                      <p className={styles.cardKicker}>Approved</p>
                      <h3 className={styles.cardTitle}>{caption}</h3>
                      <p className={styles.cardMeta}>
                        {submitter} · {displayValue(photo.submitterEmail)}
                      </p>
                      <p className={styles.cardText}>{reviewNotes}</p>
                    </>
                  }
                  title={caption}
                >
                  <div className={styles.detailStack}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="Approved Blarney photo"
                      className={styles.detailImage}
                      src={`/api/chair/photos/${photo.id}/view`}
                    />
                    <div className={styles.detailGrid}>
                      <div className={styles.detailItem}>
                        <span>Caption</span>
                        <p>{caption}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Submitter</span>
                        <p>{submitter}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Email</span>
                        <p>{displayValue(photo.submitterEmail)}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Status</span>
                        <p>Approved</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Review notes</span>
                        <p>{reviewNotes}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Received</span>
                        <p>{formatDateTime(photo.createdAt)}</p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Approved</span>
                        <p>
                          {photo.approvedAt
                            ? formatDateTime(photo.approvedAt)
                            : "N/A"}
                        </p>
                      </div>
                      <div className={styles.detailItem}>
                        <span>Feedback</span>
                        <p>{displayValue(photo.feedback?.message)}</p>
                      </div>
                    </div>
                  </div>
                </PreviewDetailCard>
              );
            })}
          </FilterableCardGrid>
        ) : (
          <article className={styles.panel}>
            <p className={styles.emptyState}>
              {reviewedResult.pagination.isEmpty
                ? "Approved photos will appear here after chair approval."
                : "No approved photos on this page."}
            </p>
          </article>
        )}
        <PaginationNav
          label="Approved photos"
          pagination={reviewedResult.pagination}
          searchParams={photoSearchParams}
        />
      </section>
    </>
  );
}
