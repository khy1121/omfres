"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; status: number };

/** JSON API 호출. 네트워크 오류·비 JSON 응답도 사용자에게 보여줄 문구로 바꿔서 돌려준다 */
export async function callApi<T = unknown>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error ?? "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", code: data?.code };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "네트워크 연결을 확인한 뒤 다시 시도해주세요." };
  }
}
