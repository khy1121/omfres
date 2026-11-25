import "server-only";
import { BOOKING_ERROR, BookingFailure } from "../data/bookings";
import { jsonError } from "../http";

/** 예약 처리 실패를 API 응답으로 바꾼다. 예상하지 못한 오류는 다시 던진다 */
export function bookingErrorResponse(e: unknown): Response {
  if (e instanceof BookingFailure) {
    const { status, message } = BOOKING_ERROR[e.code];
    return jsonError(message, status, e.code);
  }
  // Firestore 트랜잭션 경합이 재시도 한도를 넘으면 ABORTED(10)로 끝난다
  if ((e as { code?: unknown })?.code === 10) return jsonError("요청이 몰려 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", 503, "BUSY");
  throw e;
}
