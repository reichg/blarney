import type { PaginationState, SearchParamsRecord } from "@/lib/pagination";

export type ChairRemembrancePageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export type RemembrancePhoto = {
  id: string;
  title: string;
  caption: string | null;
  submitterEmail: string;
  submitterName: string;
  notePreview: string | null;
  note: string | null;
  receivedAtLabel: string;
};

export type ChairRemembranceGalleryProps = {
  photos: RemembrancePhoto[];
  pagination?: PaginationState;
};

export type RemembrancePhotoCardProps = {
  photo: RemembrancePhoto;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
};
