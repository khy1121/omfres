# 상담 예약 UI·UX 레퍼런스 조사

> **결론: 예약 흐름의 뼈대(달력 → 시간 → 확정, 동시 예약 방지)는 주요 서비스와 같은 수준이다. 차이는 "예약 이후"와 "교수의 시간 관리"에 있다.**
> 주요 서비스가 공통으로 갖춘 것: 확정·리마인더 알림과 캘린더 추가, 다음 가능한 시간 바로가기, 날짜별 예외 시간, 상담 사이 여유 시간·하루 최대 횟수, 조교 공동 운영, 교수 캘린더 일정 자동 반영. 우리 앱에는 모두 없다.

조사일: 2026-11-25. 공식 도움말·대학 IT 안내·디자인 시스템 위주로 보고, 벤더 블로그 수치는 참고만 했다.

---

## 1. 무엇을 봤나

| 분류 | 대상 | 본 이유 |
|---|---|---|
| 범용 예약 | Calendly, Cal.com, Microsoft Bookings, YouCanBook.me | 호스트 가능 시간 설정·예약자 화면의 표준 |
| 대학에서 쓰는 도구 | Google Calendar 예약 일정, Canvas Scheduler, Microsoft Bookings(대학 안내), Yale Law 자체 도구 | 교수–학생 오피스아워에 실제로 쓰이는 방식 |
| 대기열 방식 | U-M Remote Office Hours Queue, Illinois Queue | 시간 예약이 아닌 "줄 서기" 방식의 오피스아워 |
| 공공 디자인 기준 | W3C ARIA APG 날짜 선택, UK MoJ·NHS·GovStack 예약 패턴 | 접근성·단계 설계 기준 |
| 국내 | 네이버 예약, 카카오 예약 파트너 문서 | 국내 사용자에게 익숙한 표시 방식 |

---

## 2. 교수(호스트) 쪽: 가능 시간 설정

### 레퍼런스가 공통으로 가진 것

| 기능 | 레퍼런스 | 우리 앱 |
|---|---|---|
| 요일별 반복 시간 | 모두 | ✅ 요일 반복 |
| **날짜별 예외 시간**(특정 날만 시간을 바꾸거나 추가) | Calendly "Date-specific hours" ([도움말](https://help.calendly.com/hc/en-us/articles/1500004754122)) | ⚠️ 제외일만 가능, 특정 날짜만 시간을 바꿀 수 없음 |
| **최소 예약 마감**(시작 N시간 전까지) | Calendly, Cal.com, Bookings | ✅ 예약 마감 |
| **상담 사이 여유 시간**(앞뒤 버퍼) | Calendly·Cal.com ([Cal.com](https://cal.com/blog/mastering-event-level-time-limits-what-lies-beyond-buffer-times)) | ❌ |
| **하루·주 최대 횟수** | Calendly 일·주·월 한도 ([도움말](https://calendly.com/help/how-to-set-meeting-limits.html)) | ❌ (1인당 횟수만) |
| 슬롯당 인원 / 1인당 횟수 | Canvas Scheduler ([Wharton](https://support.wharton.upenn.edu/help/all-about-appointments), [UW](https://kb.wisc.edu/101518)) | ⚠️ 1인당 횟수만, 슬롯당 1명 고정 |
| **공동 운영자(조교)** | Google 예약 일정 공동 호스트 최대 20명 ([Google](https://support.google.com/calendar/answer/11608416)), Bookings 조교 포함 ([CGU](https://my.cgu.edu/it/?p=659)) | ❌ |
| **교수 캘린더 일정 자동 반영**(바쁜 시간 자동 차단) | Google·Bookings·Calendly 모두 | ❌ (다른 수업 상담끼리만 막음) |
| **"왜 이 시간이 안 보이나" 진단** | Calendly Troubleshoot ([도움말](https://calendly.com/help/how-to-fine-tune-your-availability-settings)) | ❌ |
| 입력 중 미리보기 | Cal.com 설정 화면 실시간 미리보기 ([v6.6](https://cal.com/pl/blog/calcom-v6-6)) | ✅ 생성될 상담 수·날짜 미리보기 |

### 관찰
- **예외 시간은 일정 단위로 걸린다.** Calendly에서도 날짜별 예외 시간이 그 이벤트에만 적용돼서, "설정했는데 안 보인다"는 문의가 많다([커뮤니티](https://community.calendly.com/asked-answered-79/why-aren-t-my-date-specific-hours-showing-on-my-booking-page-after-i-set-them-4720)). 우리도 일정이 여러 개라 같은 혼란이 생길 수 있다. **어느 일정에 적용되는지 화면에 분명히 보여줘야 한다.**
- **설정이 늘수록 검증이 어렵다.** 하루 최대·버퍼가 적용되지 않는 것 같다는 문의도 있다. 그래서 Calendly는 예약 페이지에 진단 도구를 따로 둔다. 우리도 기능을 늘린다면 교수용 "이 날짜에 상담이 없는 이유" 표시가 함께 필요하다.
- **Canvas는 슬롯 수가 많으면 나누라고 권한다**(그룹당 50개 이하, [Yale](https://help.canvas.yale.edu/a/914686-how-do-i-use-the-sign-up-tool)). 우리는 일정당 최대 3,000개까지 허용하지만, 학생 화면은 날짜별로 나뉘어 있어 문제는 작다.

---

## 3. 학생(예약자) 쪽: 예약 화면

### 레이아웃
- **Calendly**는 7일 원형 보기에서 **월 달력 보기**로 바꿨다([블로그](https://calendly.com/blog/new-scheduling-page-ui)). 우리와 같은 방향이다.
- **Cal.com**은 월·주·열(column) 보기 중 호스트가 고르거나, 여러 개를 켜서 예약자가 바꾸게 한다([블로그](https://cal.com/blog/enhanced-flexibility-take-advantage-of-cal-com-s-multiple-booking-layouts)).
- **YouCanBook.me**는 달력·하루·**목록(agenda)** 보기를 두고, 목록 보기는 "가능한 시간을 한눈에 훑기"에 맞다고 설명한다. **다음 가능한 시간으로 바로 이동**도 있다([블로그](https://youcanbook.me/blog/bookers-deserve-better)).

### 시간 선택
- 모바일에서는 OS 기본 시간 선택기(돌리는 휠)가 불편하다는 지적이 일관된다([UX Movement](https://uxmovement.substack.com/p/the-best-mobile-ui-for-picking-date)). 우리는 이미 **시간 버튼 격자**라 해당 없다.
- 마감된 시간은 **숨기는 쪽**(OpenTable)과 **흐리게 남기는 쪽**으로 나뉜다([Eleken](https://www.eleken.co/blog-posts/time-picker-ux)). 우리는 이유(마감·내 예약·겹침)를 함께 보여주며 남긴다. 상담은 "왜 안 되는지"가 중요해서(내 다른 예약과 겹침 등) 지금 방식이 맞다고 본다. 다만 **가능한 시간이 먼저 눈에 들어오도록** 시각적 비중을 조정할 여지가 있다.
- Baymard의 모바일 연구에서는 날짜와 시간 선택지를 **분명한 시각 위계로 보여준 방식**이 가장 잘 동작했다([Baymard](https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/time-booking-interface)).
- 카카오 예약 파트너 문서는 **시간대별 남은 수량을 달력에 표시**한다([카카오비즈니스](https://kakaobusiness.gitbook.io/main/tool/booking/pc/undefined-3)). 우리 달력은 날짜에 "상담 없는 날" 같은 사유만 있고, 남은 시간 수는 없다.

### 단계 설계 (공공 서비스 기준)
- NHS 앱 GP 예약은 **한 화면에 질문 하나**로 나눴을 때 완료율이 좋았다([NHS 디자인 히스토리](https://nhsdigital.github.io/design-history-nhsapp/gp-services/2025/10/appointment-booking-updates)).
- UK 법무부 예약 패턴은 **맞는 시간이 없을 때의 경로**(대체 연락 방법 안내 등)를 별도 단계로 둔다([MoJ](https://design-patterns.service.justice.gov.uk/service-patterns/appointment)). 우리는 "앞으로 남은 상담 시간이 없습니다"에서 끝나서 다음 행동이 없다.
- GovStack은 선택지와 함께 **제약을 설명**하라고 한다([GovStack](https://specs.govstack.global/service-patterns/2.-functional-patterns/schedule-an-appointment)). 우리는 1인당 횟수·마감 규칙을 일정 정보에 보여주고 있다.

---

## 4. 예약 이후: 알림·변경

| 기능 | 레퍼런스 | 우리 앱 |
|---|---|---|
| **예약 확정 메일 + 내 캘린더에 추가** | Bookings는 예약 직후 확정 메일과 캘린더 추가를 보낸다([Microsoft](https://learn.microsoft.com/en-us/microsoft-365/bookings/customers-manage-booking?view=o365-worldwide)) | ❌ 화면 안내만 |
| **리마인더** | Google 12·24시간 전([Google](https://support.google.com/calendar/answer/11608416)), Bookings 설정 가능 | ❌ |
| **메일·캘린더 항목에서 바로 변경·취소** | Bookings "예약 관리" 버튼 | ⚠️ 앱에 들어와야 가능 |
| 교수에게 취소 알림 | Bookings | ❌ |
| 교수의 예약 현황 | 모두 캘린더 연동 | ⚠️ 목록만 (날짜별·필터·CSV) |

### 관찰
- Bookings 사용자들은 **리마인더 메일에도 변경·취소 버튼**을 넣어 달라고 요청한다([포럼](https://techcommunity.microsoft.com/discussions/microsoftbookings/reschedule-button-in-reminder-email/3813487)). 알림을 만든다면 처음부터 "변경·취소" 링크를 넣는 것이 좋다.
- 리마인더 시점·채널 효과는 대부분 벤더 자료라 근거가 약하다. 학술 연구 하나는 **2주 이내에 한 번** 보내는 리마인더를 가장 선호한다고 보고했다([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5279837)). 우리 맥락(학교 메일)에서는 **전날 메일 1회 + 캘린더 파일**이면 충분하다.

---

## 5. 다른 방식: 대기열(줄 서기) 오피스아워

- U-M Remote Office Hours Queue는 시간을 예약하지 않는다. 학생이 **대기 인원을 보고 줄에 서면** 순서대로 개별 상담(대면·Zoom)을 연다([U-M ITS](https://its.umich.edu/communication/videoconferencing/remote-office-hours-queue)). Illinois도 비슷한 Queue를 운영한다([queue.illinois.edu](https://queue.illinois.edu/)).
- 시험 직전 질문처럼 **짧고 수요가 몰리는 상담**에는 시간 예약보다 대기열이 낫다. 우리 서비스의 두 번째 모드로 고려할 만하지만 범위가 크다.

---

## 6. 접근성 기준

- 우리 달력은 W3C ARIA APG 날짜 선택 예제([APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog.html))와 주요 동작이 같다.
  - 같은 점: 방향키·Home·End 이동, 한 칸만 탭 순서에 두기, 월 제목을 live region으로 안내
- 다른 점이 두 가지 있다.
  - **선택 표시 속성:** APG는 선택한 날짜에 `aria-selected`를 쓰고(격자 셀), 우리는 버튼의 `aria-pressed`를 쓴다. 구조가 다르니(격자 vs 버튼 목록), 스크린리더에서 실제로 어떻게 읽히는지 확인이 필요하다.
  - **PageUp/PageDown:** APG는 이 키로 이전·다음 달 이동을 지원하는데, 우리는 지원하지 않는다.

---

## 7. 개선 후보 (우선순위 제안)

영향이 크고 구현이 작은 순서로 정리했다. **⭐ 표시는 바로 시작할 만한 항목**이다.

### A. 학생 예약 화면 (작음, 바로 효과)
1. ⭐ **다음 가능한 시간 바로가기:** 달력 위에 "가장 빠른 상담: 12월 3일(수) 10:00" 버튼을 둔다. 누르면 그 날짜·시간이 선택된다. (YouCanBook.me)
2. ⭐ **날짜별 남은 시간 수 표시:** 달력 날짜 아래에 "3개 남음"을 보여준다. 학생이 날짜를 하나씩 눌러 보지 않아도 된다. (카카오 예약) 월 단위로 조회하는 API가 필요하다.
3. ⭐ **내 캘린더에 추가(.ics):** 예약 완료 화면과 내 예약에 버튼을 둔다. 메일 기능 없이도 리마인더 효과의 대부분을 얻는다. (Bookings)
4. **모바일 목록 보기:** 남은 시간을 날짜별 목록으로 한눈에 훑게 한다. (YouCanBook.me agenda, Cal.com 열 보기)
5. **맞는 시간이 없을 때의 경로:** "교수님께 메일 보내기"(개설 교수 이메일)와 다른 일정 바로가기를 둔다. (MoJ)

### B. 교수 시간 관리 (중간)
6. ⭐ **날짜별 예외 시간:** 특정 날짜만 시간을 바꾸거나 추가한다. 반복 규칙 + 예외는 레퍼런스 공통 구조다. 어느 일정에 적용되는지 명확히 보여준다. (Calendly)
7. **상담 사이 여유 시간·하루 최대 횟수:** 잠금 블록 계산에 버퍼를 포함하면 동시성 설계를 그대로 쓸 수 있다. (Calendly, Cal.com)
8. **"이 날짜에 상담이 없는 이유" 진단:** 교수 미리보기에서 날짜를 누르면 사유를 보여준다(제외일·기간 밖·다른 수업 예약과 겹침·하루 최대 도달). (Calendly Troubleshoot)
9. **예약 현황 주간 캘린더 보기:** 지금의 목록 보기에 더해 한 주를 칸으로 보여준다. 다른 수업 상담도 함께 표시한다.
10. **일정 복제:** 지난 학기·다른 분반 일정을 불러와 수정한다.

### C. 범위가 큰 기능 (설계 필요)
11. **메일 알림(확정·전날 리마인더·취소):** 발송 서비스와 발신 도메인이 필요하다. 처음부터 변경·취소 링크를 포함한다. (Bookings 사용자 요청)
12. **조교 공동 운영:** 그룹에 조교 역할을 추가하고 일정마다 담당자를 지정한다. (Google 공동 호스트, Bookings)
13. **교수 Google 캘린더 바쁜 시간 반영:** 캘린더 읽기 권한 연동이 필요하다. 레퍼런스 공통 기능 중 가장 효과가 크지만 OAuth 검토가 필요하다.
14. **그룹 상담(슬롯당 여러 명):** Canvas 방식이다. 잠금 설계를 바꿔야 한다(기획안 2차 항목).
15. **대기열 모드:** 시험 기간 질문용이다. (U-M ROHQ)

### D. 접근성 점검
16. 달력 선택 속성(`aria-selected` vs `aria-pressed`)을 실제 스크린리더로 확인하고, PageUp/PageDown 월 이동을 추가한다. (APG)

---

## 8. 다음 단계 제안
1. A-1~3, B-6을 1차 개선 범위로 정한다. 모두 지금 데이터 구조 안에서 가능하다.
2. 각 항목을 화면 시안(현재 화면 + 변경안)으로 만든 뒤 구현한다.
3. C 항목은 하나씩 별도 기획 문서로 범위·비용을 정리한다.

## 참고한 자료
- Calendly: [가능 시간 설정](https://help.calendly.com/hc/en-us/articles/1500004754122), [미팅 한도](https://calendly.com/help/how-to-set-meeting-limits.html), [새 예약 페이지 UI](https://calendly.com/blog/new-scheduling-page-ui), [예외 시간 문의](https://community.calendly.com/asked-answered-79/why-aren-t-my-date-specific-hours-showing-on-my-booking-page-after-i-set-them-4720)
- Cal.com: [예약 레이아웃](https://cal.com/blog/enhanced-flexibility-take-advantage-of-cal-com-s-multiple-booking-layouts), [시간 제한·버퍼](https://cal.com/blog/mastering-event-level-time-limits-what-lies-beyond-buffer-times), [v6.6](https://cal.com/pl/blog/calcom-v6-6)
- Google Calendar: [예약 일정 소개](https://support.google.com/calendar/answer/11608416), [만들기](https://support.google.com/calendar/answer/10729749), [TMU 오피스아워 안내](https://www.torontomu.ca/google/getting-started/google-calendar/appointment-schedule/)
- Microsoft Bookings: [고객 예약 관리](https://learn.microsoft.com/en-us/microsoft-365/bookings/customers-manage-booking?view=o365-worldwide), [리마인더 변경 버튼 요청](https://techcommunity.microsoft.com/discussions/microsoftbookings/reschedule-button-in-reminder-email/3813487), [대학 사례 CGU](https://my.cgu.edu/it/?p=659), [Harvard GSD 도구 비교](https://www.gsd.harvard.edu/resources/office-hour-signup-tools)
- Canvas Scheduler: [Wharton](https://support.wharton.upenn.edu/help/all-about-appointments), [UW–Madison](https://kb.wisc.edu/101518), [Yale](https://help.canvas.yale.edu/a/914686-how-do-i-use-the-sign-up-tool)
- 대기열: [U-M Remote Office Hours Queue](https://its.umich.edu/communication/videoconferencing/remote-office-hours-queue), [Illinois Queue](https://queue.illinois.edu/)
- 패턴·연구: [YouCanBook.me](https://youcanbook.me/blog/bookers-deserve-better), [Baymard 모바일 예약](https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/time-booking-interface), [UX Movement](https://uxmovement.substack.com/p/the-best-mobile-ui-for-picking-date), [Eleken](https://www.eleken.co/blog-posts/time-picker-ux), [PMC 리마인더 선호 연구](https://pmc.ncbi.nlm.nih.gov/articles/PMC5279837)
- 공공 디자인: [W3C APG 날짜 선택](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog.html), [UK MoJ 예약 패턴](https://design-patterns.service.justice.gov.uk/service-patterns/appointment), [GovStack](https://specs.govstack.global/service-patterns/2.-functional-patterns/schedule-an-appointment), [NHS 앱 예약 개선](https://nhsdigital.github.io/design-history-nhsapp/gp-services/2025/10/appointment-booking-updates)
- 국내: [카카오 예약 파트너 문서](https://kakaobusiness.gitbook.io/main/tool/booking/pc/undefined-3)
