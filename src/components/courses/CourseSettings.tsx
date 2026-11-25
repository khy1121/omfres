"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import CourseForm from "./CourseForm";
import { btnSecondary, Card } from "@/components/ui";
import type { CourseInput } from "@/lib/courses/model";

/** 그룹 정보 수정 (펼쳐서 편집) */
export default function CourseSettings({ courseId, initial }: { courseId: string; initial: CourseInput }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Icon icon="lucide:settings" width={18} />
          그룹 정보
        </h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>수정</button>
        )}
      </div>
      {open && (
        <div className="mt-4">
          <CourseForm mode="edit" courseId={courseId} initial={initial} onDone={() => setOpen(false)} />
        </div>
      )}
    </Card>
  );
}
