import "server-only";

import { db } from "@/lib/db";
import { sumChairRsvpPartyCounts } from "@/lib/chairRsvps";
import { getChairMarketplaceCatalog } from "@/lib/marketplaceCatalogAdmin";
import { getChairMarketplaceOverview } from "@/lib/marketplaceChair";
import { completeRegistrationPaymentStatuses } from "@/lib/payment";
import { REMEMBRANCE_FEEDBACK_CATEGORY } from "@/lib/remembrance";

// A golfer counts as an adult attendee at age 15 or older, matching the
// threshold used in chairRsvps.ts so attendance and registration breakdowns
// stay consistent.
const golferAdultAgeThreshold = 15;

export interface ChairDashboardInsights {
  registrations: {
    complete: number;
    pendingPayment: number;
    golfers: { adults: number; kids: number; total: number };
    guests: { adults: number; kids: number; total: number };
  };
  rsvps: {
    total: number;
    adultAttendees: number;
    kidAttendees: number;
    totalAttendees: number;
  };
  marketplace: {
    needsReview: number;
    unfulfilled: number;
    ready: number;
    fulfilled: number;
    activeListings: number;
    draftListings: number;
  };
  feedback: { total: number; averageRating: number | null };
  photos: { pending: number; approved: number };
  remembrance: { total: number };
  pairings: {
    paidGolfers: number;
    unassigned: number;
    draft: number;
    published: number;
  };
}

function getEmptyChairDashboardInsights(): ChairDashboardInsights {
  return {
    registrations: {
      complete: 0,
      pendingPayment: 0,
      golfers: { adults: 0, kids: 0, total: 0 },
      guests: { adults: 0, kids: 0, total: 0 },
    },
    rsvps: {
      total: 0,
      adultAttendees: 0,
      kidAttendees: 0,
      totalAttendees: 0,
    },
    marketplace: {
      needsReview: 0,
      unfulfilled: 0,
      ready: 0,
      fulfilled: 0,
      activeListings: 0,
      draftListings: 0,
    },
    feedback: { total: 0, averageRating: null },
    photos: { pending: 0, approved: 0 },
    remembrance: { total: 0 },
    pairings: {
      paidGolfers: 0,
      unassigned: 0,
      draft: 0,
      published: 0,
    },
  };
}

export async function getChairDashboardInsights(
  client = db,
): Promise<ChairDashboardInsights> {
  try {
    const [
      completeRegistrationCount,
      pendingPaymentRegistrationCount,
      registrationBreakdownRows,
      rsvpTotal,
      rsvpPartyRows,
      marketplaceOverview,
      marketplaceCatalog,
      feedbackTotal,
      feedbackRatingAggregate,
      pendingPhotoCount,
      approvedPhotoCount,
      remembranceTotal,
      draftPairingCount,
      publishedPairingCount,
      assignedPaidGolferCount,
    ] = await Promise.all([
      client.registration.count({
        where: {
          paymentStatus: { in: [...completeRegistrationPaymentStatuses] },
        },
      }),
      client.registration.count({
        where: { paymentStatus: "EXTERNAL_PENDING" },
      }),
      client.registration.findMany({
        select: {
          adultGuestCount: true,
          childGuestCount: true,
          participant: { select: { age: true } },
        },
      }),
      client.rsvp.count(),
      client.rsvp.findMany({
        select: {
          source: true,
          adultAttendeeCount: true,
          childAttendeeCount: true,
          attendeeCount: true,
          participant: {
            select: {
              age: true,
              registrations: {
                select: { adultGuestCount: true, childGuestCount: true },
              },
            },
          },
        },
      }),
      getChairMarketplaceOverview(client),
      getChairMarketplaceCatalog(client),
      client.feedback.count({
        where: { category: { not: REMEMBRANCE_FEEDBACK_CATEGORY } },
      }),
      client.feedback.aggregate({
        _avg: { rating: true },
        where: {
          category: { not: REMEMBRANCE_FEEDBACK_CATEGORY },
          rating: { not: null },
        },
      }),
      client.photoSubmission.count({ where: { status: "PENDING" } }),
      client.photoSubmission.count({ where: { status: "APPROVED" } }),
      client.feedback.count({
        where: { category: REMEMBRANCE_FEEDBACK_CATEGORY },
      }),
      client.pairingGroup.count({ where: { status: "DRAFT" } }),
      client.pairingGroup.count({ where: { status: "PUBLISHED" } }),
      // Paid golfers already placed in a DRAFT or PUBLISHED pairing group.
      client.registration.count({
        where: {
          paymentStatus: { in: [...completeRegistrationPaymentStatuses] },
          participant: {
            pairingSlots: {
              some: { group: { status: { in: ["DRAFT", "PUBLISHED"] } } },
            },
          },
        },
      }),
    ]);

    const registrationBreakdown = registrationBreakdownRows.reduce(
      (totals, registration) => {
        const golferIsAdult =
          registration.participant.age >= golferAdultAgeThreshold;

        return {
          golferAdults: totals.golferAdults + (golferIsAdult ? 1 : 0),
          golferKids: totals.golferKids + (golferIsAdult ? 0 : 1),
          guestAdults: totals.guestAdults + registration.adultGuestCount,
          guestKids: totals.guestKids + registration.childGuestCount,
        };
      },
      { golferAdults: 0, golferKids: 0, guestAdults: 0, guestKids: 0 },
    );

    const rsvpPartyTotals = sumChairRsvpPartyCounts(rsvpPartyRows);

    const activeListings = marketplaceCatalog.filter(
      (listing) => listing.status === "ACTIVE",
    ).length;
    const draftListings = marketplaceCatalog.filter(
      (listing) => listing.status === "DRAFT",
    ).length;

    const paidGolfers = completeRegistrationCount;

    return {
      registrations: {
        complete: completeRegistrationCount,
        pendingPayment: pendingPaymentRegistrationCount,
        golfers: {
          adults: registrationBreakdown.golferAdults,
          kids: registrationBreakdown.golferKids,
          total:
            registrationBreakdown.golferAdults +
            registrationBreakdown.golferKids,
        },
        guests: {
          adults: registrationBreakdown.guestAdults,
          kids: registrationBreakdown.guestKids,
          total:
            registrationBreakdown.guestAdults +
            registrationBreakdown.guestKids,
        },
      },
      rsvps: {
        total: rsvpTotal,
        adultAttendees: rsvpPartyTotals.adultAttendeeCount,
        kidAttendees: rsvpPartyTotals.childAttendeeCount,
        totalAttendees: rsvpPartyTotals.attendeeCount,
      },
      marketplace: {
        needsReview: marketplaceOverview.counts.review,
        unfulfilled: marketplaceOverview.counts.unfulfilled,
        ready: marketplaceOverview.counts.ready,
        fulfilled: marketplaceOverview.counts.fulfilled,
        activeListings,
        draftListings,
      },
      feedback: {
        total: feedbackTotal,
        averageRating: feedbackRatingAggregate._avg.rating ?? null,
      },
      photos: {
        pending: pendingPhotoCount,
        approved: approvedPhotoCount,
      },
      remembrance: {
        total: remembranceTotal,
      },
      pairings: {
        paidGolfers,
        // Unassigned paid golfers are those not yet placed in any active group.
        unassigned: Math.max(0, paidGolfers - assignedPaidGolferCount),
        draft: draftPairingCount,
        published: publishedPairingCount,
      },
    };
  } catch {
    return getEmptyChairDashboardInsights();
  }
}
