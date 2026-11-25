"use client";

import { Icon } from "@iconify/react";
import { bookingToIcs, icsFilename, type IcsBooking } from "@/lib/ics";
import { downloadFile } from "@/lib/download";

/** 예약을 .ics 파일로 내려받아 내 캘린더에 추가 */
export default function AddToCalendarButton({ booking, className, label = "내 캘린더에 추가" }: { booking: IcsBooking; className: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => downloadFile(icsFilename(booking), bookingToIcs(booking), "text/calendar;charset=utf-8")}
      className={className}
    >
      <Icon icon="lucide:calendar-plus" width={16} />
      {label}
    </button>
  );
}
