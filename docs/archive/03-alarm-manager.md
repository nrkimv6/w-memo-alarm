# 알림 관리 기능 추가 계획서

## 개요
중앙 집중식 알림 관리 페이지를 구현하여 모든 알림을 한 곳에서 관리할 수 있도록 함

## 현재 상태
- `ScheduledRemindersModal.svelte` - 예약된 알림 목록 표시 (제한적)
- 중앙 집중식 알림 관리 페이지 없음
- 알림 토글 시 메모 동기화 기능 없음

## 목표
- 모든 알림을 시간대별로 그룹화하여 표시
- 시간대별 일괄 토글 기능
- 알림 토글 시 연결된 메모에도 자동 반영
- 개별 알림 수정/삭제 기능

## 위치 결정

### 선택: 설정 페이지 내 탭
**경로**: `/settings` → "알림 관리" 탭

**선택 이유**:
- 기존 설정과 자연스럽게 통합
- 네비게이션 단순화
- 사용자가 설정 관련 기능을 한 곳에서 관리

## 구현 계획

### Phase 1: 알림 관리 스토어 생성
**파일**: `src/lib/stores/alarmManager.svelte.ts`

```typescript
import { memoStore } from './memos.svelte';
import { notificationStore } from './notifications.svelte';
import type { Memo, Reminder } from '$lib/types/memo';

export interface AlarmGroupItem {
  memoId: string;
  memoTitle: string;
  reminderId: string;
  type: 'repeat' | 'once';
  days?: number[];
  date?: string;
  enabled: boolean;
}

export interface AlarmGroup {
  time: string;           // "09:00"
  enabled: boolean;       // 그룹 전체 활성화 상태
  items: AlarmGroupItem[];
}

function createAlarmManagerStore() {
  let alarmGroups = $state<AlarmGroup[]>([]);
  let loading = $state(false);

  // 메모에서 알림 목록 추출 (하위 호환성 지원)
  function getRemindersFromMemo(memo: Memo): Array<Reminder & { memoId: string; memoTitle: string }> {
    const results: Array<Reminder & { memoId: string; memoTitle: string }> = [];

    // 새 형식: reminders 배열
    if (memo.reminders && memo.reminders.length > 0) {
      memo.reminders.forEach(r => {
        results.push({ ...r, memoId: memo.id, memoTitle: memo.title });
      });
    }
    // 구 형식: reminder 단일 객체
    else if (memo.reminder) {
      results.push({
        ...memo.reminder,
        id: memo.reminder.id || memo.id, // ID 없으면 메모 ID 사용
        memoId: memo.id,
        memoTitle: memo.title
      });
    }

    return results;
  }

  // 시간별 그룹화
  function groupByTime(memos: Memo[]): AlarmGroup[] {
    const groups = new Map<string, AlarmGroup>();

    memos.forEach(memo => {
      const reminders = getRemindersFromMemo(memo);

      reminders.forEach(reminder => {
        if (!reminder.enabled) return; // 비활성화된 알림은 제외

        const time = reminder.time;

        if (!groups.has(time)) {
          groups.set(time, {
            time,
            enabled: true,
            items: []
          });
        }

        groups.get(time)!.items.push({
          memoId: reminder.memoId,
          memoTitle: reminder.memoTitle,
          reminderId: reminder.id,
          type: reminder.type || 'repeat',
          days: reminder.days,
          date: reminder.date,
          enabled: reminder.enabled
        });
      });
    });

    // 시간순 정렬
    return Array.from(groups.values())
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // 그룹 데이터 새로고침
  function refresh() {
    alarmGroups = groupByTime(memoStore.memos);
  }

  // 시간대 토글 (핵심 기능)
  async function toggleTimeSlot(time: string, enabled: boolean): Promise<void> {
    const group = alarmGroups.find(g => g.time === time);
    if (!group) return;

    loading = true;

    try {
      // 해당 시간의 모든 메모 알림 상태 변경
      const updatePromises = group.items.map(item =>
        memoStore.updateReminderEnabled(item.memoId, item.reminderId, enabled)
      );

      await Promise.all(updatePromises);

      // 그룹 상태 갱신
      group.enabled = enabled;
      group.items.forEach(item => item.enabled = enabled);
      alarmGroups = [...alarmGroups];

      // Service Worker 동기화
      notificationStore.syncRemindersToServiceWorker();
    } finally {
      loading = false;
    }
  }

  // 개별 알림 토글
  async function toggleReminder(
    memoId: string,
    reminderId: string,
    enabled: boolean
  ): Promise<void> {
    loading = true;

    try {
      await memoStore.updateReminderEnabled(memoId, reminderId, enabled);
      refresh();
      notificationStore.syncRemindersToServiceWorker();
    } finally {
      loading = false;
    }
  }

  // 모든 알림 비활성화
  async function disableAll(): Promise<void> {
    loading = true;

    try {
      const allUpdates: Promise<void>[] = [];

      alarmGroups.forEach(group => {
        group.items.forEach(item => {
          allUpdates.push(
            memoStore.updateReminderEnabled(item.memoId, item.reminderId, false)
          );
        });
      });

      await Promise.all(allUpdates);
      refresh();
      notificationStore.syncRemindersToServiceWorker();
    } finally {
      loading = false;
    }
  }

  return {
    get groups() { return alarmGroups; },
    get loading() { return loading; },
    refresh,
    toggleTimeSlot,
    toggleReminder,
    disableAll
  };
}

export const alarmManagerStore = createAlarmManagerStore();
```

### Phase 2: 메모 스토어 확장
**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
// 알림 활성화 상태만 업데이트하는 메서드 추가
async function updateReminderEnabled(
  memoId: string,
  reminderId: string,
  enabled: boolean
): Promise<void> {
  const memo = getMemo(memoId);
  if (!memo) return;

  // reminders 배열 사용 (1:N 구조)
  if (memo.reminders && memo.reminders.length > 0) {
    const updatedReminders = memo.reminders.map(r =>
      r.id === reminderId ? { ...r, enabled } : r
    );
    await update(memoId, { reminders: updatedReminders });
  }
  // 기존 reminder 필드 사용 (1:1 구조)
  else if (memo.reminder) {
    await update(memoId, {
      reminder: { ...memo.reminder, enabled }
    });
  }
}
```

### Phase 3: 알림 관리 UI 컴포넌트
**파일**: `src/lib/components/settings/AlarmManager.svelte`

```svelte
<script lang="ts">
  import { alarmManagerStore } from '$lib/stores/alarmManager.svelte';
  import { memoStore } from '$lib/stores/memos.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';

  // 초기화
  $effect(() => {
    if (memoStore.memos.length > 0) {
      alarmManagerStore.refresh();
    }
  });

  // 요일 포맷팅
  function formatDays(days: number[]): string {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    if (days.length === 7) return '매일';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '평일';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
    return days.map(d => dayNames[d]).join(', ');
  }

  // 메모 편집 모달 열기
  function openMemoEdit(memoId: string) {
    // 메모 편집 이벤트 발생
    window.dispatchEvent(new CustomEvent('open-memo-edit', { detail: { memoId } }));
  }
</script>

<div class="alarm-manager">
  <header class="manager-header">
    <div>
      <h2>알림 관리</h2>
      <p class="subtitle">시간대별로 알림을 관리합니다</p>
    </div>
    {#if alarmManagerStore.groups.length > 0}
      <button
        class="disable-all-btn"
        onclick={() => alarmManagerStore.disableAll()}
        disabled={alarmManagerStore.loading}
      >
        모두 비활성화
      </button>
    {/if}
  </header>

  {#if alarmManagerStore.loading}
    <div class="loading">처리 중...</div>
  {/if}

  {#if alarmManagerStore.groups.length === 0}
    <div class="empty-state">
      <p>설정된 알림이 없습니다</p>
      <p class="hint">메모에서 알림을 추가해보세요</p>
    </div>
  {:else}
    <div class="alarm-groups">
      {#each alarmManagerStore.groups as group (group.time)}
        <div class="alarm-group" class:disabled={!group.enabled}>
          <!-- 시간대 헤더 -->
          <div class="group-header">
            <div class="time-info">
              <span class="time">{group.time}</span>
              <span class="count">{group.items.length}개 알림</span>
            </div>
            <Toggle
              checked={group.enabled}
              onchange={(e) => alarmManagerStore.toggleTimeSlot(
                group.time,
                e.target.checked
              )}
              disabled={alarmManagerStore.loading}
            />
          </div>

          <!-- 해당 시간의 알림 목록 -->
          <div class="reminder-list">
            {#each group.items as item (item.reminderId)}
              <div class="reminder-item">
                <div class="memo-info">
                  <span class="title">{item.memoTitle}</span>
                  <div class="badges">
                    <span class="type-badge" class:once={item.type === 'once'}>
                      {item.type === 'once' ? '1회' : '반복'}
                    </span>
                    {#if item.type === 'repeat' && item.days}
                      <span class="days-badge">{formatDays(item.days)}</span>
                    {:else if item.date}
                      <span class="date-badge">{item.date}</span>
                    {/if}
                  </div>
                </div>
                <button
                  class="edit-btn"
                  onclick={() => openMemoEdit(item.memoId)}
                >
                  수정
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .alarm-manager {
    padding: 1rem;
  }

  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .manager-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .subtitle {
    margin: 0.25rem 0 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .disable-all-btn {
    padding: 0.5rem 1rem;
    background: var(--danger);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .disable-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    text-align: center;
    padding: 1rem;
    color: var(--text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
  }

  .empty-state .hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .alarm-groups {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .alarm-group {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    transition: opacity 0.2s;
  }

  .alarm-group.disabled {
    opacity: 0.6;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .time-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .time {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .count {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .reminder-list {
    background: var(--background);
  }

  .reminder-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-light);
  }

  .reminder-item:last-child {
    border-bottom: none;
  }

  .memo-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .title {
    font-weight: 500;
  }

  .badges {
    display: flex;
    gap: 0.5rem;
  }

  .type-badge,
  .days-badge,
  .date-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    background: var(--surface);
  }

  .type-badge.once {
    background: var(--warning-bg);
    color: var(--warning);
  }

  .edit-btn {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .edit-btn:hover {
    background: var(--surface);
    color: var(--text-primary);
  }
</style>
```

### Phase 4: 설정 페이지에 통합
**파일**: `src/routes/settings/+page.svelte`

```svelte
<script>
  import AlarmManager from '$lib/components/settings/AlarmManager.svelte';

  let activeTab = $state('general');
</script>

<div class="settings-page">
  <nav class="tabs">
    <button
      class:active={activeTab === 'general'}
      onclick={() => activeTab = 'general'}
    >
      일반
    </button>
    <button
      class:active={activeTab === 'alarms'}
      onclick={() => activeTab = 'alarms'}
    >
      알림 관리
    </button>
  </nav>

  <div class="tab-content">
    {#if activeTab === 'general'}
      <!-- 기존 일반 설정 내용 -->
    {:else if activeTab === 'alarms'}
      <AlarmManager />
    {/if}
  </div>
</div>
```

### Phase 5: Notification Store 확장
**파일**: `src/lib/stores/notifications.svelte.ts`

```typescript
// Service Worker와 알림 상태 동기화
function syncRemindersToServiceWorker() {
  const memos = memoStore.memos;
  const reminders: ScheduledReminder[] = [];

  memos.forEach(memo => {
    // reminders 배열 사용 (1:N)
    if (memo.reminders) {
      memo.reminders.filter(r => r.enabled).forEach(r => {
        reminders.push({
          memoId: memo.id,
          reminderId: r.id,
          title: memo.title,
          body: memo.content?.substring(0, 100) || '',
          time: r.time,
          type: r.type || 'repeat',
          days: r.days,
          date: r.date,
          url: memo.url,
          autoOpen: r.autoOpen
        });
      });
    }
    // reminder 단일 객체 사용 (1:1, 하위 호환)
    else if (memo.reminder?.enabled) {
      reminders.push({
        memoId: memo.id,
        reminderId: memo.reminder.id || memo.id,
        title: memo.title,
        body: memo.content?.substring(0, 100) || '',
        time: memo.reminder.time,
        type: memo.reminder.type || 'repeat',
        days: memo.reminder.days,
        date: memo.reminder.date,
        url: memo.url,
        autoOpen: memo.reminder.autoOpen
      });
    }
  });

  // Service Worker에 전송
  navigator.serviceWorker.controller?.postMessage({
    type: 'REGISTER_MEMO_REMINDERS',
    reminders
  });
}
```

## 핵심 기능: 토글 OFF 시 메모 동기화

토글을 OFF하면 다음이 순차적으로 실행됩니다:

1. **로컬 상태 업데이트** (낙관적 UI)
2. **메모 스토어 업데이트** → localStorage 캐시 저장
3. **Supabase 서버 동기화** → ma_memos 테이블 업데이트
4. **알림 스케줄 업데이트** → alarm_schedules 테이블 업데이트
5. **Service Worker 동기화** → 백그라운드 알림 상태 갱신

## 파일 구조

```
src/
├── lib/
│   ├── components/
│   │   └── settings/
│   │       └── AlarmManager.svelte      # 알림 관리 UI
│   └── stores/
│       ├── alarmManager.svelte.ts       # 알림 관리 스토어
│       ├── memos.svelte.ts              # updateReminderEnabled 추가
│       └── notifications.svelte.ts      # syncRemindersToServiceWorker 추가
└── routes/
    └── settings/
        └── +page.svelte                  # 탭 추가
```

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/stores/alarmManager.svelte.ts` | 새 파일 생성 |
| `src/lib/stores/memos.svelte.ts` | updateReminderEnabled 메서드 추가 |
| `src/lib/stores/notifications.svelte.ts` | syncRemindersToServiceWorker 추가 |
| `src/lib/components/settings/AlarmManager.svelte` | 새 파일 생성 |
| `src/routes/settings/+page.svelte` | 탭 추가 및 AlarmManager 통합 |

## 예상 작업량
- 알림 관리 스토어: 2시간
- 메모 스토어 확장: 1시간
- AlarmManager 컴포넌트: 3시간
- 설정 페이지 통합: 1시간
- Service Worker 동기화: 1시간
- 테스트: 2시간

## 테스트 시나리오
1. 시간대별 그룹화 정상 표시
2. 시간대 토글 OFF → 해당 시간 모든 메모 알림 비활성화
3. 시간대 토글 ON → 해당 시간 모든 메모 알림 활성화
4. 개별 메모 수정 버튼 → 메모 편집 모달 열림
5. 모두 비활성화 → 전체 알림 OFF
6. 메모에서 알림 변경 → 알림 관리 페이지 자동 갱신
