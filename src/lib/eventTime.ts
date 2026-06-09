export const EVENT_TIME_ZONE = "America/Los_Angeles";

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function eventWallClockParts(instant: Date): WallClockParts {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const lookup: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      lookup[part.type] = Number(part.value);
    }
  }

  // hour12: false can yield "24" for midnight; normalize to 0.
  const hour = lookup.hour === 24 ? 0 : lookup.hour;

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

// Difference (ms) between the event-tz wall-clock reading of an instant and the
// instant itself, i.e. the event-tz UTC offset in effect at that instant.
function offsetMsAt(instant: Date): number {
  const wall = eventWallClockParts(instant);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );

  return asUtc - instant.getTime();
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatEventDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return "TBD";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return DISPLAY_FORMATTER.format(date);
}

export function toEventDateTimeLocalValue(
  value: Date | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const wall = eventWallClockParts(value);

  return (
    `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}` +
    `T${pad2(wall.hour)}:${pad2(wall.minute)}`
  );
}

const WALL_CLOCK_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseEventDateTimeLocal(value: string): Date {
  const match = WALL_CLOCK_PATTERN.exec(value);

  if (!match) {
    throw new RangeError(`Invalid event-local datetime: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

  // Resolve the event-tz offset at the guessed instant, apply it, then refine
  // once: the offset at the corrected instant can differ across a DST boundary,
  // in which case the first candidate landed in the wrong offset window.
  const initialOffset = offsetMsAt(new Date(utcGuess));
  const candidate = new Date(utcGuess - initialOffset);
  const refinedOffset = offsetMsAt(candidate);

  if (refinedOffset === initialOffset) {
    return candidate;
  }

  return new Date(utcGuess - refinedOffset);
}
