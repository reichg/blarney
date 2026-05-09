import type { SearchParamsRecord } from "@/lib/type";

export type PhotoGalleryPhoto = {
  id: string;
  caption: string | null;
};

export type PhotoGalleryProps = {
  photos: PhotoGalleryPhoto[];
};

export type PhotosPageProps = {
  searchParams: Promise<SearchParamsRecord>;
};
