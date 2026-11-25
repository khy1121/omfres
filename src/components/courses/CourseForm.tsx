"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/components/api";
import { btnPrimary, btnSecondary, ErrorBox, Field, inputCls } from "@/components/ui";
import { COURSE_DESC_MAX, COURSE_TERM_MAX, COURSE_TITLE_MAX, type CourseInput } from "@/lib/courses/model";

type Props =
  | { mode: "create"; initial: CourseInput }
  | { mode: "edit"; courseId: string; initial: CourseInput; onDone: () => void };

export default function CourseForm(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof CourseInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (props.mode === "create") {
      const r = await callApi<{ id: string }>("/api/courses", "POST", form);
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        return;
      }
      router.push(`/courses/${r.data.id}`);
      return;
    }
    const r = await callApi(`/api/courses/${props.courseId}`, "PATCH", form);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    props.onDone();
    router.refresh();
  };

  return (
    <form onSubmit={submit}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <Field label="수업 이름" icon="lucide:book-open">
        <input className={inputCls} value={form.title} onChange={set("title")} maxLength={COURSE_TITLE_MAX} placeholder="예: 자료구조 (01분반)" required />
      </Field>
      <Field label="학기" icon="lucide:calendar-range">
        <input className={inputCls} value={form.term} onChange={set("term")} maxLength={COURSE_TERM_MAX} required />
      </Field>
      <Field label="설명 (선택)" icon="lucide:align-left">
        <textarea
          className={`${inputCls} min-h-24`}
          value={form.description}
          onChange={set("description")}
          maxLength={COURSE_DESC_MAX}
          placeholder="학생에게 보여줄 안내 (상담 목적, 준비물 등)"
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button type="submit" disabled={busy} className={`${btnPrimary} sm:flex-1`}>
          {props.mode === "create" ? "그룹 만들기" : "저장"}
        </button>
        {props.mode === "edit" && (
          <button type="button" onClick={props.onDone} disabled={busy} className={btnSecondary}>취소</button>
        )}
      </div>
    </form>
  );
}
