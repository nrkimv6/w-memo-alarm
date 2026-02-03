# 메모:알림 1:N 관계 개선 계획서

## 개요
현재 메모당 하나의 알림만 설정 가능한 구조를 메모당 여러 개의 알림을 설정할 수 있도록 변경

## 현재 문제점
- `Memo.reminder?: Reminder` - 단일 알림만 지원
- 알림 추가 버튼 클릭 시 기존 알림이 덮어써짐
- 하나의 메모에 여러 시간대 알림 설정 불가

## 목표
- 메모당 여러 개의 알림 설정 가능
- 기본 알림(default) 1개 + 추가 알림 N개 구조
- 기존 데이터 하위 호환성 유지

## 구현 계획

### Phase 1: 타입 정의 변경
**파일**: `src/lib/types/memo.ts`

```typescript
// 기존
export interface Reminder {
  enabled: boolean;
  time: string;
  days: number[];
  autoOpen: boolean;
  type?: 'repeat' | 'once';
  date?: string;
  datetime?: string;
  isDefault?: boolean;
}

export interface Memo {
  // ...
  reminder?: Reminder;
}

// 변경
export interface Reminder {
  id: string;              // 새로 추가: 알림 고유 ID
  enabled: boolean;
  time: string;
  days: number[];
  autoOpen: boolean;
  type?: 'repeat' | 'once';
  date?: string;
  datetime?: string;
  isDefault?: boolean;     // 기본 알림 여부
}

export interface Memo {
  // ...
  reminder?: Reminder;     // 하위 호환성 유지 (deprecated)
  reminders?: Reminder[];  // 새로운 다중 알림 배열
}
```

### Phase 2: 마이그레이션 로직
**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
// 기존 단일 reminder를 reminders 배열로 마이그레이션
function migrateToMultipleReminders(memo: Memo): Memo {
  // 이미 reminders가 있으면 스킵
  if (memo.reminders && memo.reminders.length > 0) {
    return memo;
  }

  // reminder가 있으면 reminders로 변환
  if (memo.reminder) {
    return {
      ...memo,
      reminders: [{
        ...memo.reminder,
        id: memo.reminder.id || crypto.randomUUID(),
        isDefault: true
      }],
      reminder: undefined  // 기존 필드 제거
    };
  }

  return memo;
}

// 메모 로드 시 자동 마이그레이션
async function loadMemos() {
  const memos = await fetchMemos();
  return memos.map(migrateToMultipleReminders);
}
```

### Phase 3: 헬퍼 함수 추가
**파일**: `src/lib/stores/memos.svelte.ts`

```typescript
// 메모의 알림 목록 가져오기 (하위 호환성)
function getReminders(memo: Memo): Reminder[] {
  if (memo.reminders && memo.reminders.length > 0) {
    return memo.reminders;
  }
  if (memo.reminder) {
    return [{ ...memo.reminder, id: memo.reminder.id || crypto.randomUUID() }];
  }
  return [];
}

// 기본 알림 가져오기
function getDefaultReminder(memo: Memo): Reminder | undefined {
  const reminders = getReminders(memo);
  return reminders.find(r => r.isDefault);
}

// 추가 알림 목록 가져오기
function getAdditionalReminders(memo: Memo): Reminder[] {
  const reminders = getReminders(memo);
  return reminders.filter(r => !r.isDefault);
}

// 알림 추가
async function addReminder(memoId: string, reminder: Omit<Reminder, 'id'>): Promise<void> {
  const memo = getMemo(memoId);
  if (!memo) return;

  const newReminder: Reminder = {
    ...reminder,
    id: crypto.randomUUID()
  };

  const currentReminders = getReminders(memo);
  await update(memoId, {
    reminders: [...currentReminders, newReminder]
  });
}

// 알림 수정
async function updateReminder(
  memoId: string,
  reminderId: string,
  changes: Partial<Reminder>
): Promise<void> {
  const memo = getMemo(memoId);
  if (!memo) return;

  const reminders = getReminders(memo);
  const updatedReminders = reminders.map(r =>
    r.id === reminderId ? { ...r, ...changes } : r
  );

  await update(memoId, { reminders: updatedReminders });
}

// 알림 삭제
async function removeReminder(memoId: string, reminderId: string): Promise<void> {
  const memo = getMemo(memoId);
  if (!memo) return;

  const reminders = getReminders(memo);
  const filteredReminders = reminders.filter(r => r.id !== reminderId);

  await update(memoId, { reminders: filteredReminders });
}

// 알림 활성화 상태 변경
async function updateReminderEnabled(
  memoId: string,
  reminderId: string,
  enabled: boolean
): Promise<void> {
  await updateReminder(memoId, reminderId, { enabled });
}
```

### Phase 4: UI 컴포넌트 수정
**파일**: `src/lib/components/memo/ReminderSettings.svelte`

```svelte
<script lang="ts">
  import type { Reminder } from '$lib/types/memo';

  interface Props {
    reminders: Reminder[];
    onRemindersChange: (reminders: Reminder[]) => void;
  }

  let { reminders = [], onRemindersChange }: Props = $props();

  // 기본 알림
  let defaultReminder = $derived(reminders.find(r => r.isDefault));

  // 추가 알림
  let additionalReminders = $derived(reminders.filter(r => !r.isDefault));

  // 새 알림 추가
  function addReminder() {
    const newReminder: Reminder = {
      id: crypto.randomUUID(),
      enabled: true,
      time: '09:00',
      days: [1, 2, 3, 4, 5],
      autoOpen: false,
      type: 'repeat',
      isDefault: false
    };
    onRemindersChange([...reminders, newReminder]);
  }

  // 알림 수정
  function updateReminder(id: string, changes: Partial<Reminder>) {
    const updated = reminders.map(r =>
      r.id === id ? { ...r, ...changes } : r
    );
    onRemindersChange(updated);
  }

  // 알림 삭제
  function removeReminder(id: string) {
    const filtered = reminders.filter(r => r.id !== id);
    onRemindersChange(filtered);
  }
</script>

<div class="reminder-settings">
  <!-- 기본 알림 섹션 -->
  <div class="default-reminder-section">
    <div class="section-header">
      <h4>기본 알림</h4>
      {#if !defaultReminder}
        <button class="add-default-btn" onclick={addDefaultReminder}>
          + 기본 알림 추가
        </button>
      {/if}
    </div>

    {#if defaultReminder}
      <ReminderCard
        reminder={defaultReminder}
        isDefault={true}
        onUpdate={(changes) => updateReminder(defaultReminder.id, changes)}
        onDelete={() => removeReminder(defaultReminder.id)}
      />
    {/if}
  </div>

  <!-- 추가 알림 섹션 -->
  <div class="additional-reminders-section">
    <div class="section-header">
      <h4>추가 알림 ({additionalReminders.length})</h4>
    </div>

    {#each additionalReminders as reminder (reminder.id)}
      <ReminderCard
        {reminder}
        isDefault={false}
        onUpdate={(changes) => updateReminder(reminder.id, changes)}
        onDelete={() => removeReminder(reminder.id)}
      />
    {/each}

    <button class="add-reminder-btn" onclick={addReminder}>
      + 알림 추가
    </button>
  </div>
</div>
```

### Phase 5: ReminderCard 컴포넌트
**파일**: `src/lib/components/memo/ReminderCard.svelte`

```svelte
<script lang="ts">
  import type { Reminder } from '$lib/types/memo';

  interface Props {
    reminder: Reminder;
    isDefault: boolean;
    onUpdate: (changes: Partial<Reminder>) => void;
    onDelete: () => void;
  }

  let { reminder, isDefault, onUpdate, onDelete }: Props = $props();

  let expanded = $state(false);
</script>

<div class="reminder-card" class:disabled={!reminder.enabled}>
  <div class="card-header">
    <div class="time-info">
      <span class="time">{reminder.time}</span>
      {#if isDefault}
        <span class="badge default">기본</span>
      {/if}
      <span class="badge type">
        {reminder.type === 'once' ? '1회' : '반복'}
      </span>
    </div>

    <div class="actions">
      <Toggle
        checked={reminder.enabled}
        onchange={(e) => onUpdate({ enabled: e.target.checked })}
      />
      <button class="expand-btn" onclick={() => expanded = !expanded}>
        {expanded ? '접기' : '펼치기'}
      </button>
      {#if !isDefault}
        <button class="delete-btn" onclick={onDelete}>삭제</button>
      {/if}
    </div>
  </div>

  {#if expanded}
    <div class="card-body">
      <!-- 시간 설정 -->
      <label>
        시간
        <input
          type="time"
          value={reminder.time}
          onchange={(e) => onUpdate({ time: e.target.value })}
        />
      </label>

      <!-- 타입 선택 -->
      <label>
        알림 타입
        <select
          value={reminder.type}
          onchange={(e) => onUpdate({ type: e.target.value })}
        >
          <option value="repeat">반복</option>
          <option value="once">1회</option>
        </select>
      </label>

      <!-- 요일 선택 (반복) -->
      {#if reminder.type === 'repeat'}
        <DaySelector
          days={reminder.days}
          onDaysChange={(days) => onUpdate({ days })}
        />
      {:else}
        <!-- 날짜 선택 (1회) -->
        <label>
          날짜
          <input
            type="date"
            value={reminder.date}
            onchange={(e) => onUpdate({ date: e.target.value })}
          />
        </label>
      {/if}

      <!-- URL 자동 열기 -->
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={reminder.autoOpen}
          onchange={(e) => onUpdate({ autoOpen: e.target.checked })}
        />
        알림 클릭 시 URL 자동 열기
      </label>
    </div>
  {/if}
</div>
```

### Phase 6: 서비스 레이어 수정
**파일**: `src/lib/services/alarmSchedules.ts`

```typescript
// 메모의 모든 알림을 서버에 등록
export async function syncMemoAlarms(
  userId: string,
  memoId: string,
  title: string,
  reminders: Reminder[]
): Promise<void> {
  // 1. 기존 알람 모두 삭제
  await deleteMemoAlarms(memoId);

  // 2. 활성화된 알람만 생성
  const enabledReminders = reminders.filter(r => r.enabled);

  for (const reminder of enabledReminders) {
    await createSingleAlarm(userId, memoId, title, reminder);
  }
}

// 단일 알람 생성 (내부 함수)
async function createSingleAlarm(
  userId: string,
  memoId: string,
  title: string,
  reminder: Reminder
): Promise<void> {
  const alarmData: AlarmSchedule = {
    user_id: userId,
    app_name: 'memo-alarm',
    alarm_type: 'memo_reminder',
    alarm_time: `${reminder.time}:00`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_enabled: reminder.enabled,
    notification_title: title,
    notification_body: `메모 알림: ${title}`,
    days_of_week: reminder.type === 'repeat' ? reminder.days : null,
    target_date: reminder.type === 'once' ? reminder.date : null,
    metadata: {
      memo_id: memoId,
      reminder_id: reminder.id,
      auto_open: reminder.autoOpen
    }
  };

  await supabase.from('alarm_schedules').insert(alarmData);
}
```

### Phase 7: Service Worker 수정
**파일**: `src/service-worker.ts`

```typescript
interface ScheduledReminder {
  memoId: string;
  reminderId: string;  // 새로 추가
  title: string;
  body: string;
  time: string;
  type: 'once' | 'repeat';
  days?: number[];
  date?: string;
  url?: string;
  autoOpen?: boolean;
  lastNotified?: string;
}
```

## 데이터 마이그레이션 전략

### 자동 마이그레이션
1. 앱 시작 시 `migrateToMultipleReminders()` 자동 실행
2. localStorage 캐시 데이터도 마이그레이션
3. 서버 데이터는 저장 시점에 새 형식으로 변환

### 하위 호환성
1. `reminder` 필드는 읽기 전용으로 유지
2. 새 코드는 항상 `reminders` 필드 사용
3. `getReminders()` 헬퍼로 양쪽 형식 모두 지원

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/types/memo.ts` | Reminder에 id 추가, Memo에 reminders 배열 추가 |
| `src/lib/stores/memos.svelte.ts` | 마이그레이션 로직, 헬퍼 함수 추가 |
| `src/lib/components/memo/ReminderSettings.svelte` | 다중 알림 UI로 재구성 |
| `src/lib/components/memo/ReminderCard.svelte` | 새 컴포넌트 생성 |
| `src/lib/services/alarmSchedules.ts` | syncMemoAlarms 함수 추가 |
| `src/service-worker.ts` | reminderId 필드 추가 |

## 예상 작업량
- 타입 정의: 30분
- 마이그레이션 로직: 1시간
- 헬퍼 함수: 1시간
- UI 컴포넌트: 3시간
- 서비스 레이어: 1시간
- Service Worker: 30분
- 테스트: 2시간

## 테스트 시나리오
1. 기존 단일 알림 메모 → 자동 마이그레이션 확인
2. 기본 알림 추가/수정/삭제
3. 추가 알림 추가/수정/삭제
4. 여러 알림이 각각 정상 동작 확인
5. 서버 동기화 확인
