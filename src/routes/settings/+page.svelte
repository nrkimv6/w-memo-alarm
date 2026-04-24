<script lang="ts">
	import { Bell, Download, Upload, Trash2, RefreshCw, Lock, LockOpen, Bug, LogOut } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import PinLockModal from '$lib/components/memo/PinLockModal.svelte';
	import GroupLabel from '$lib/components/settings/GroupLabel.svelte';
	import Row from '$lib/components/settings/Row.svelte';
	import NavRow from '$lib/components/settings/NavRow.svelte';
	import NavGroup from '$lib/components/settings/NavGroup.svelte';
	import SegmentedControl from '$lib/components/settings/SegmentedControl.svelte';
	import ImpactNote from '$lib/components/settings/ImpactNote.svelte';
	import { APP_VERSION } from '$lib/config';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { downloadFullBackup, importFullBackup, clearAllData } from '$lib/utils/data';
	import { cn } from '$lib/utils';
	import { hasPinSet } from '$lib/utils/memoPinLock';
	import { getUserDisplayName, getUserEmail } from '$lib/utils/user';

	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let importError = $state('');
	let showClearAllDialog = $state(false);
	let updating = $state(false);

	let devMode = $state(false);
	let versionTapCount = $state(0);
	let lastTapTime = $state(0);

	let pinIsSet = $state(hasPinSet());
	let showPinModal = $state(false);
	let pinModalMode = $state<'setup' | 'change' | 'remove'>('setup');

	$effect(() => {
		devMode = localStorage.getItem('dev_mode_unlocked') === 'true';
	});

	const memoCount = $derived(memosStore.memos.length);
	const todoCount = $derived(memosStore.memos.filter(m => m.memoType === 'todo').length);
	const useMarkdown = $derived(settingsStore.settings.useMarkdown ?? false);
	const defaultTime = $derived(settingsStore.settings.defaultReminder.time);
	const defaultDays = $derived(settingsStore.settings.defaultReminder.days);
	const autoReminderOnCreate = $derived(settingsStore.settings.autoReminderOnCreate);
	const defaultReminderMemoCount = $derived(
		memosStore.memos.filter(m => m.reminder?.isDefault === true).length
	);
	const todoRemindEnabled = $derived(settingsStore.settings.todoDefaults.remind.enabled);
	const todoRemindTime = $derived(settingsStore.settings.todoDefaults.remind.time);
	const todoAutoAlertEnabled = $derived(settingsStore.settings.todoDefaults.autoAlert.enabled);
	const todoAutoAlertMinutes = $derived(settingsStore.settings.todoDefaults.autoAlert.minutesBefore);
	const todoShowOverdue = $derived(settingsStore.settings.todoDefaults.showOverdue);
	const todoShowProgress = $derived(settingsStore.settings.todoDefaults.showProgress);
	const todoShowUpcomingOnEmpty = $derived(settingsStore.settings.todoDefaults.showUpcomingOnEmpty);

	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
	const themeOptions = [
		{ value: 'light', label: '라이트' },
		{ value: 'dark', label: '다크' },
		{ value: 'system', label: '시스템' }
	];

	function handleVersionTap() {
		const now = Date.now();
		if (now - lastTapTime > 2000) versionTapCount = 1;
		else versionTapCount++;
		lastTapTime = now;
		if (versionTapCount >= 10) {
			devMode = true;
			localStorage.setItem('dev_mode_unlocked', 'true');
			versionTapCount = 0;
		}
	}

	function handleMarkdownToggle() { settingsStore.setUseMarkdown(!useMarkdown); }
	function handleAutoReminderToggle() { settingsStore.setAutoReminderOnCreate(!autoReminderOnCreate); }

	function handleTimeChange(e: Event) {
		settingsStore.setDefaultReminderTime((e.target as HTMLInputElement).value);
	}

	function toggleDefaultDay(day: number) {
		const next = defaultDays.includes(day)
			? defaultDays.filter(d => d !== day)
			: [...defaultDays, day].sort();
		settingsStore.setDefaultReminderDays(next);
	}

	function handleTodoRemindToggle() { settingsStore.setTodoRemindEnabled(!todoRemindEnabled); }
	function handleTodoRemindTimeChange(e: Event) {
		settingsStore.setTodoRemindTime((e.target as HTMLInputElement).value);
	}
	function handleTodoAutoAlertToggle() { settingsStore.setTodoAutoAlertEnabled(!todoAutoAlertEnabled); }
	function handleTodoAutoAlertMinutesChange(e: Event) {
		settingsStore.setTodoAutoAlertMinutes(parseInt((e.target as HTMLSelectElement).value));
	}
	function handleTodoShowOverdueToggle() { settingsStore.setTodoShowOverdue(!todoShowOverdue); }
	function handleTodoShowProgressToggle() { settingsStore.setTodoShowProgress(!todoShowProgress); }
	function handleTodoShowUpcomingOnEmptyToggle() {
		settingsStore.setTodoShowUpcomingOnEmpty(!todoShowUpcomingOnEmpty);
	}

	function handlePinSetup() { pinModalMode = 'setup'; showPinModal = true; }
	function handlePinChange() { pinModalMode = 'change'; showPinModal = true; }
	function handlePinRemove() { pinModalMode = 'remove'; showPinModal = true; }
	function handlePinSuccess() { showPinModal = false; pinIsSet = hasPinSet(); }

	function handleExport() { downloadFullBackup(); }

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.json')) {
			importError = 'JSON 파일만 가져올 수 있습니다. (.json)';
			input.value = '';
			return;
		}
		importing = true;
		importError = '';
		try {
			const result = await importFullBackup(file);
			if (!result.success) importError = result.message;
		} catch (err) {
			importError = (err as Error).message;
		} finally {
			importing = false;
			input.value = '';
		}
	}

	function handleClearAll() { showClearAllDialog = true; }
	async function confirmClearAll() { await clearAllData(); }

	async function handleUpdateCheck() {
		updating = true;
		try {
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map(name => caches.delete(name)));
			const registration = await navigator.serviceWorker.getRegistration();
			if (registration) {
				if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
				await registration.update();
			}
			window.location.reload();
		} catch (error) {
			console.error('Update check failed:', error);
			updating = false;
		}
	}
</script>

<div class="min-h-screen">
	<header class="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
		<div class="mx-auto max-w-2xl px-4 py-4">
			<h1 class="text-xl font-bold tracking-tight text-foreground">설정</h1>
		</div>
	</header>

	<main class="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-6">

		<!-- 앱 정보 hero -->
		<div class="settings-surface-card settings-bg-gradient flex items-center justify-between px-5 py-4">
			<div>
				<p class="text-sm font-semibold text-foreground">메모알람</p>
				<p class="text-xs text-muted-foreground">메모와 알림을 함께</p>
			</div>
			<button
				onclick={handleVersionTap}
				class="select-none text-sm tabular-nums text-muted-foreground transition-colors hover:text-foreground"
				title={versionTapCount > 0 ? `${10 - versionTapCount}번 더 탭하세요` : undefined}
			>
				v{APP_VERSION}
				{#if versionTapCount > 0 && versionTapCount < 10}
					<span class="ml-1 text-xs text-primary">({versionTapCount}/10)</span>
				{/if}
			</button>
		</div>

		<!-- 모양 -->
		<div class="space-y-2">
			<GroupLabel>모양</GroupLabel>
			<div class="settings-surface-card divide-y divide-border">
				<div class="px-4 py-3">
					<p class="mb-2.5 text-sm font-medium">테마</p>
					<SegmentedControl
						value={themeStore.theme}
						options={themeOptions}
						onchange={v => themeStore.setTheme(v as 'light' | 'dark' | 'system')}
					/>
					{#if themeStore.theme === 'system'}
						<p class="mt-2 text-center text-xs text-muted-foreground">
							현재 {themeStore.resolved === 'dark' ? '다크' : '라이트'} 모드 적용 중
						</p>
					{/if}
				</div>
				<Row label="마크다운 렌더링" hint="메모에서 마크다운 문법을 감지하면 서식을 적용합니다">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={useMarkdown}
							aria-label="마크다운 렌더링 토글"
							onclick={handleMarkdownToggle}
							class={cn('toggle-switch', useMarkdown && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>
			</div>
		</div>

		<!-- 계정 -->
		<div class="space-y-2">
			<GroupLabel>계정</GroupLabel>
			<div class="settings-surface-card">
				{#if authStore.isAuthenticated}
					<div class="space-y-3 px-4 py-4">
						<div>
							{#if authStore.user}
								<p class="text-sm font-medium">{getUserDisplayName(authStore.user)}</p>
								{#if getUserEmail(authStore.user)}
									<p class="text-xs text-muted-foreground">{getUserEmail(authStore.user)}</p>
								{/if}
							{/if}
							<p class="mt-1 text-xs text-success">클라우드 동기화 활성</p>
						</div>
						<Button variant="ghost" size="sm" onclick={() => authStore.signOut()} class="w-full justify-start gap-2">
							<LogOut class="h-4 w-4" />
							로그아웃
						</Button>
					</div>
				{:else}
					<div class="space-y-3 px-4 py-4">
						<p class="text-xs text-muted-foreground">로그인하면 데이터가 자동으로 클라우드에 백업됩니다.</p>
						<button
							onclick={() => authStore.signInWithGoogle()}
							class="flex w-full items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm font-medium transition-colors hover:bg-muted"
						>
							<svg class="h-5 w-5" viewBox="0 0 24 24">
								<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
								<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
								<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
								<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
							</svg>
							Google로 로그인
						</button>
						<button
							onclick={() => authStore.signInWithKakao()}
							class="flex w-full items-center justify-center gap-2 rounded-lg border border-border p-3 text-sm font-medium transition-colors hover:bg-muted"
						>
							<svg class="h-5 w-5" viewBox="0 0 24 24">
								<path fill="#3C1E1E" d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.035 5.906l-.857 3.2a.5.5 0 0 0 .764.548l3.79-2.452c.732.117 1.49.178 2.268.178 5.523 0 10-3.477 10-7.88C22 6.477 17.523 3 12 3z"/>
							</svg>
							Kakao로 로그인
						</button>
						{#if authStore.error}
							<p class="text-xs text-destructive">{authStore.error}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- 알림 -->
		<div class="space-y-2">
			<GroupLabel>알림</GroupLabel>
			<div class="settings-surface-card divide-y divide-border">
				<Row label="새 메모에 자동 알림" hint="메모 생성 시 자동으로 알림을 설정합니다">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={autoReminderOnCreate}
							aria-label="자동 알림 토글"
							onclick={handleAutoReminderToggle}
							class={cn('toggle-switch', autoReminderOnCreate && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>

				{#if autoReminderOnCreate}
					<div class="space-y-4 bg-muted/40 px-4 py-3">
						<div class="space-y-1.5">
							<label for="default-reminder-time" class="text-xs font-medium text-muted-foreground">
								기본 알림 시간
							</label>
							<input
								id="default-reminder-time"
								type="time"
								value={defaultTime}
								onchange={handleTimeChange}
								class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div class="space-y-1.5">
							<p class="text-xs font-medium text-muted-foreground">기본 반복 요일</p>
							<div class="flex gap-1">
								{#each dayLabels as dayLabel, i}
									<button
										type="button"
										onclick={() => toggleDefaultDay(i)}
										class={cn(
											'h-8 w-8 rounded-full text-xs font-medium transition-colors',
											defaultDays.includes(i)
												? 'bg-primary text-primary-foreground'
												: 'border border-border bg-background hover:bg-muted'
										)}
									>
										{dayLabel}
									</button>
								{/each}
							</div>
						</div>
					</div>
					{#if defaultReminderMemoCount > 0}
						<ImpactNote>
							변경 시 기본알림을 사용하는 <strong>{defaultReminderMemoCount}개</strong>의 메모에 자동 적용됩니다.
						</ImpactNote>
					{/if}
				{/if}
			</div>

			<NavGroup>
				<NavRow href="/settings/notifications" label="알림 관리" hint="메모별 알림 시간 설정">
					{#snippet icon()}
						<Bell class="h-4 w-4" />
					{/snippet}
				</NavRow>
			</NavGroup>
		</div>

		<!-- 메모 & 할일 -->
		<div class="space-y-2">
			<GroupLabel>메모 & 할일</GroupLabel>

			<!-- PIN 잠금 -->
			<div class="settings-surface-card">
				<div class="settings-row">
					{#if pinIsSet}
						<Lock class="h-5 w-5 shrink-0 text-primary" />
						<div class="flex-1">
							<p class="text-sm font-medium">PIN 설정됨</p>
							<p class="text-xs text-muted-foreground">잠긴 메모는 PIN 입력 후 열람 가능</p>
						</div>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={handlePinChange}
								class="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
							>
								변경
							</button>
							<button
								type="button"
								onclick={handlePinRemove}
								class="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
							>
								제거
							</button>
						</div>
					{:else}
						<LockOpen class="h-5 w-5 shrink-0 text-muted-foreground" />
						<div class="flex-1">
							<p class="text-sm font-medium">메모 잠금 (PIN)</p>
							<p class="text-xs text-muted-foreground">PIN으로 개별 메모를 잠글 수 있습니다</p>
						</div>
						<button
							type="button"
							onclick={handlePinSetup}
							class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							설정
						</button>
					{/if}
				</div>
			</div>

			<!-- 할일 기본설정 -->
			<div class="settings-surface-card divide-y divide-border">
				<Row label="매일 상기 알림" hint="매일 같은 시각에 할일을 상기시킵니다">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={todoRemindEnabled}
							aria-label="매일 상기 알림"
							onclick={handleTodoRemindToggle}
							class={cn('toggle-switch', todoRemindEnabled && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>

				{#if todoRemindEnabled}
					<div class="bg-muted/40 px-4 py-3">
						<label for="todo-remind-time" class="text-xs font-medium text-muted-foreground">
							상기 시각
						</label>
						<input
							id="todo-remind-time"
							type="time"
							value={todoRemindTime}
							onchange={handleTodoRemindTimeChange}
							class="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>
				{/if}

				<Row label="자동 알람" hint="기한 전 N분에 자동으로 알람을 발송합니다">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={todoAutoAlertEnabled}
							aria-label="자동 알람"
							onclick={handleTodoAutoAlertToggle}
							class={cn('toggle-switch', todoAutoAlertEnabled && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>

				{#if todoAutoAlertEnabled}
					<div class="bg-muted/40 px-4 py-3">
						<label for="todo-auto-alert-minutes" class="text-xs font-medium text-muted-foreground">
							알람 시각
						</label>
						<select
							id="todo-auto-alert-minutes"
							value={todoAutoAlertMinutes}
							onchange={handleTodoAutoAlertMinutesChange}
							class="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value={30}>30분 전</option>
							<option value={60}>1시간 전</option>
							<option value={180}>3시간 전</option>
							<option value={1440}>하루 전</option>
							<option value={4320}>3일 전</option>
							<option value={10080}>1주 전</option>
						</select>
					</div>
				{/if}

				<Row label="기한 초과 강조" hint="기한 지난 할일을 빨간색으로 강조 표시">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={todoShowOverdue}
							aria-label="기한 초과 강조"
							onclick={handleTodoShowOverdueToggle}
							class={cn('toggle-switch', todoShowOverdue && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>

				<Row label="진행률 표시" hint="오늘의 완료 진행률 바를 표시합니다">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={todoShowProgress}
							aria-label="진행률 표시"
							onclick={handleTodoShowProgressToggle}
							class={cn('toggle-switch', todoShowProgress && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>

				<Row label="빈 화면에 다가오는 할일" hint="필터에 할일이 없을 때 다음 할일을 미리 표시">
					{#snippet trailing()}
						<button
							type="button"
							role="switch"
							aria-checked={todoShowUpcomingOnEmpty}
							aria-label="빈 화면에 다가오는 할일 표시"
							onclick={handleTodoShowUpcomingOnEmptyToggle}
							class={cn('toggle-switch', todoShowUpcomingOnEmpty && 'active')}
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					{/snippet}
				</Row>

				<div class="px-4 py-3">
					<p class="text-xs text-muted-foreground">
						현재 <strong class="text-foreground">{todoCount}개</strong>의 할일
					</p>
				</div>
			</div>
		</div>

		<!-- 데이터 -->
		<div class="space-y-2">
			<GroupLabel>데이터</GroupLabel>
			<div class="settings-surface-card divide-y divide-border">
				<Row
					as="button"
					label="백업 내보내기"
					hint={`${memoCount}개 메모 저장됨`}
					onclick={handleExport}
				>
					{#snippet trailing()}
						<Download class="h-4 w-4 text-muted-foreground" />
					{/snippet}
				</Row>

				<Row
					as="button"
					label={importing ? '가져오는 중...' : '백업 가져오기'}
					onclick={() => fileInput.click()}
				>
					{#snippet trailing()}
						<Upload class="h-4 w-4 text-muted-foreground" />
					{/snippet}
				</Row>
				<input bind:this={fileInput} type="file" accept="*/*" onchange={handleImport} class="hidden" />

				{#if importError}
					<div class="px-4 py-2">
						<p class="text-xs text-destructive">{importError}</p>
					</div>
				{/if}

				<button
					onclick={handleClearAll}
					class="settings-row w-full transition-colors hover:bg-muted/60 active:bg-muted"
				>
					<div class="min-w-0 flex-1">
						<div class="text-sm font-medium text-destructive">모든 메모 삭제</div>
					</div>
					<Trash2 class="h-4 w-4 shrink-0 text-destructive" />
				</button>
			</div>
		</div>

		<!-- 앱 -->
		<div class="space-y-2">
			<GroupLabel>앱</GroupLabel>
			<div class="settings-surface-card">
				<Row
					as="button"
					label={updating ? '업데이트 확인 중...' : '앱 업데이트 확인'}
					hint="캐시를 초기화하고 최신 버전으로 업데이트합니다"
					onclick={handleUpdateCheck}
				>
					{#snippet trailing()}
						<RefreshCw class={cn('h-4 w-4 text-muted-foreground', updating && 'animate-spin')} />
					{/snippet}
				</Row>
			</div>
		</div>

		<!-- 개발자 (devMode일 때만) -->
		{#if devMode}
			<div class="space-y-2">
				<GroupLabel>개발자</GroupLabel>
				<NavGroup>
					<NavRow href="/settings/developer" label="개발자 도구" hint="FCM, Service Worker, 로그 뷰어">
						{#snippet icon()}
							<Bug class="h-4 w-4" />
						{/snippet}
					</NavRow>
				</NavGroup>
			</div>
		{/if}

		<Footer className="pt-4" />
	</main>
</div>

<PinLockModal
	bind:open={showPinModal}
	mode={pinModalMode}
	onSuccess={handlePinSuccess}
	onClose={() => (showPinModal = false)}
/>

<ConfirmDialog
	bind:open={showClearAllDialog}
	title="모든 데이터 삭제"
	message="모든 데이터를 삭제하시겠습니까?"
	confirmText="삭제"
	variant="destructive"
	onConfirm={confirmClearAll}
	onCancel={() => {}}
/>
