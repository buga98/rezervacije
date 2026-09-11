import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addMinutes, startOfDay } from "date-fns";

export const minutesToDate = (dateISO: string, minuteOfDay: number, timezone: string) => {
  const localBase = startOfDay(new Date(`${dateISO}T12:00:00`));
  const local = addMinutes(localBase, minuteOfDay);
  return fromZonedTime(local, timezone);
};

export const utcToMinuteOfDay = (date: Date, timezone: string) => {
  const local = toZonedTime(date, timezone);
  return local.getHours() * 60 + local.getMinutes();
};

export const weekdayInZone = (dateISO: string, timezone: string) => {
  const localNoon = fromZonedTime(new Date(`${dateISO}T12:00:00`), timezone);
  return toZonedTime(localNoon, timezone).getDay();
};

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;
