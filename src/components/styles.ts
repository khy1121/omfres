// 공통 스타일 클래스. 서버·클라이언트 컴포넌트 모두에서 쓰므로 "use client" 모듈에 두지 않는다.
// ("use client" 모듈의 값은 서버에서 문자열이 아니라 클라이언트 참조로 들어온다)

export const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-40";

export const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40";

export const successCls = "mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900";
