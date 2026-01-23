<script lang="ts">
	import { Download, Upload, Trash2, Sun, Moon, Monitor, Bell, Cloud, LogIn, LogOut, Info, RefreshCw, Bug, BellRing, CheckCircle, XCircle } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Footer from "$lib/components/Footer.svelte";
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { downloadFullBackup, importFullBackup, clearAllData } from '$lib/utils/data';
	import { cn } from '$lib/utils';
	import { getUserDisplayName, getUserEmail } from '$lib/utils/user';
	import {
		isNative,
		requestNotificationPermission as requestNativePermission,
		checkNotificationPermission as checkNativePermission,
		scheduleNotification,
		cancelAllNotifications
	} from '$lib/utils/capacitor';

	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let importError = $state('');
	let showClearAllDialog = $state(false);
	let updating = $state(false);

	// 개발자 모드
	let devMode = $state(false);
	let versionTapCount = $state(0);
	let lastTapTime = $state(0);
	let testNotificationSent = $state(false);

	// Capacitor 상태
	let isNativePlatform = $state(false);
	let nativePermission = $state<string>('확인 중...');
	let pendingNotifications = $state<string[]>([]);
	let capacitorTestScheduled = $state(false);

	// 초기화
	$effect(() => {
		if (devMode) {
			checkCapacitorStatus();
		}
	});

	async function checkCapacitorStatus() {
		isNativePlatform = await isNative();
		if (isNativePlatform) {
			const hasPermission = await checkNativePermission();
			nativePermission = hasPermission ? 'granted' : 'denied';
			await loadPendingNotifications();
		} else {
			nativePermission = 'N/A (웹 환경)';
		}
	}

	async function loadPendingNotifications() {
		if (!isNativePlatform) return;
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			const pending = await LocalNotifications.getPending();
			pendingNotifications = pending.notifications.map(n =>
				`[${n.id}] ${n.title} - ${n.schedule?.at ? new Date(n.schedule.at).toLocaleString() : '시간 없음'}`
			);
		} catch (e) {
			console.error('Failed to load pending notifications:', e);
			pendingNotifications = ['로드 실패'];
		}
	}

	async function requestNativeNotificationPermission() {
		const granted = await requestNativePermission();
		nativePermission = granted ? 'granted' : 'denied';
	}

	async function testCapacitorNotification() {
		capacitorTestScheduled = false;

		if (!isNativePlatform) {
			alert('네이티브 앱에서만 사용 가능합니다.');
			return;
		}

		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');

			// 권한 확인
			const permission = await LocalNotifications.checkPermissions();
			if (permission.display !== 'granted') {
				const req = await LocalNotifications.requestPermissions();
				if (req.display !== 'granted') {
					alert('알림 권한이 필요합니다.');
					return;
				}
			}

			// 5초 후 테스트 알림 스케줄링
			const scheduleTime = new Date(Date.now() + 5000);

			await LocalNotifications.schedule({
				notifications: [{
					id: 99999,
					title: '테스트 백그라운드 알림',
					body: '5초 후 알림이 정상 작동합니다! 앱을 닫아도 이 알림이 표시되어야 합니다.',
					schedule: { at: scheduleTime },
					extra: { memoId: 'test', isTest: true }
				}]
			});

			capacitorTestScheduled = true;
			await loadPendingNotifications();
			alert(`테스트 알림이 ${scheduleTime.toLocaleTimeString()}에 예약되었습니다.\n\n앱을 백그라운드로 보내거나 닫아도 알림이 와야 합니다.`);
		} catch (e) {
			console.error('Capacitor notification test failed:', e);
			alert('테스트 실패: ' + (e as Error).message);
		}
	}

	async function clearAllScheduledNotifications() {
		if (!isNativePlatform) return;

		try {
			await cancelAllNotifications();
			await loadPendingNotifications();
			alert('모든 예약된 알림이 취소되었습니다.');
		} catch (e) {
			alert('취소 실패: ' + (e as Error).message);
		}
	}

	function handleVersionTap() {
		const now = Date.now();
		// 2초 내에 탭해야 카운트 유지
		if (now - lastTapTime > 2000) {
			versionTapCount = 1;
		} else {
			versionTapCount++;
		}
		lastTapTime = now;

		if (versionTapCount >= 10) {
			devMode = true;
			versionTapCount = 0;
		}
	}

	async function testNotification() {
		testNotificationSent = false;

		// 권한 확인 및 요청
		if (notificationStore.permission !== 'granted') {
			const granted = await notificationStore.requestPermission();
			if (!granted) {
				alert('알림 권한이 필요합니다. 브라우저 설정에서 알림을 허용해주세요.');
				return;
			}
		}

		// 테스트 알림 발송
		try {
			const testMemo = {
				id: 'test-notification',
				title: '테스트 알림',
				content: '알림이 정상적으로 작동합니다!',
				url: '',
				reminder: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			// @ts-ignore - 테스트용 메모 객체
			notificationStore.showNotification(testMemo);
			testNotificationSent = true;
		} catch (error) {
			console.error('테스트 알림 실패:', error);
			alert('알림 발송에 실패했습니다: ' + (error as Error).message);
		}
	}

	function triggerManualCheck() {
		notificationStore.checkAndTriggerReminders();
		alert('알림 체크가 수동으로 실행되었습니다.');
	}

	async function handleUpdateCheck() {
		updating = true;
		try {
			// 1. 모든 캐시 삭제
			const cacheNames = await caches.keys();
			await Promise.all(cacheNames.map((name) => caches.delete(name)));

			// 2. Service Worker 업데이트 확인
			const registration = await navigator.serviceWorker.getRegistration();
			if (registration) {
				// 새 SW가 대기 중이면 활성화
				if (registration.waiting) {
					registration.waiting.postMessage({ type: 'SKIP_WAITING' });
				}
				// 업데이트 확인
				await registration.update();
			}

			// 3. 페이지 새로고침
			window.location.reload();
		} catch (error) {
			console.error('Update check failed:', error);
			updating = false;
		}
	}

	const memoCount = $derived(memosStore.memos.length);

	// 기본 알림 설정
	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
	let defaultTime = $state(settingsStore.settings.defaultReminder.time);
	let defaultDays = $state<number[]>([...settingsStore.settings.defaultReminder.days]);
	let autoReminderOnCreate = $state(settingsStore.settings.autoReminderOnCreate);

	function toggleDefaultDay(day: number) {
		if (defaultDays.includes(day)) {
			defaultDays = defaultDays.filter((d) => d !== day);
		} else {
			defaultDays = [...defaultDays, day].sort();
		}
		settingsStore.setDefaultReminderDays(defaultDays);
	}

	function handleTimeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		defaultTime = target.value;
		settingsStore.setDefaultReminderTime(target.value);
	}

	function handleAutoReminderToggle() {
		autoReminderOnCreate = !autoReminderOnCreate;
		settingsStore.setAutoReminderOnCreate(autoReminderOnCreate);
	}

	function handleExport() {
		downloadFullBackup();
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importing = true;
		importError = '';

		try {
			const result = await importFullBackup(file);
			if (!result.success) {
				importError = result.message;
			}
		} catch (err) {
			importError = (err as Error).message;
		} finally {
			importing = false;
			input.value = '';
		}
	}

	function handleClearAll() {
		showClearAllDialog = true;
	}

	function confirmClearAll() {
		clearAllData();
	}
</script>

<div class="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-24">
	<h1 class="text-2xl font-bold">설정</h1>

	<!-- 테마 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<Sun class="w-5 h-5" />
			<h2 class="font-semibold">테마</h2>
		</div>

		<div class="bg-card rounded-xl border border-border p-5">
			<div class="flex gap-2">
				<button
					onclick={() => themeStore.setTheme('light')}
					class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors {themeStore.theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}"
				>
					<Sun class="w-5 h-5" />
					<span class="text-sm">라이트</span>
				</button>
				<button
					onclick={() => themeStore.setTheme('dark')}
					class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors {themeStore.theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}"
				>
					<Moon class="w-5 h-5" />
					<span class="text-sm">다크</span>
				</button>
				<button
					onclick={() => themeStore.setTheme('system')}
					class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors {themeStore.theme === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}"
				>
					<Monitor class="w-5 h-5" />
					<span class="text-sm">시스템</span>
				</button>
			</div>
		</div>
	</section>

	<!-- 클라우드 동기화 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<Cloud class="w-5 h-5" />
			<h2 class="font-semibold">클라우드 동기화</h2>
		</div>

		<!-- 로그인 방식 (Supabase 동기화) -->
		<div class="bg-card rounded-xl border border-border p-5">
			<h3 class="text-sm font-semibold mb-3">Supabase 동기화</h3>
			<p class="text-xs text-muted-foreground mb-4">
				Google/Kakao 계정으로 로그인하여 안전하게 데이터를 보호합니다.
			</p>

			{#if authStore.isAuthenticated}
				<!-- 로그인됨 -->
				<div class="space-y-4">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-success">로그인됨</span>
					</div>

					<div class="text-sm">
						{#if authStore.user}
							<p class="font-medium">{getUserDisplayName(authStore.user)}</p>
							{#if getUserEmail(authStore.user)}
								<p class="text-xs text-muted-foreground">
									{getUserEmail(authStore.user)}
								</p>
							{/if}
						{/if}
					</div>

					<Button variant="ghost" size="sm" onclick={() => authStore.signOut()} class="w-full">
						<LogOut class="w-4 h-4" />
						로그아웃
					</Button>

					<p class="text-xs text-muted-foreground">
						데이터는 자동으로 동기화됩니다.
					</p>
				</div>
			{:else}
				<!-- 미로그인 -->
				<div class="space-y-3">
					<Button
						variant="default"
						onclick={() => authStore.signInWithGoogle()}
						class="w-full"
					>
						<LogIn class="w-4 h-4" />
						Google로 로그인
					</Button>
					<Button
						variant="secondary"
						onclick={() => authStore.signInWithKakao()}
						class="w-full"
					>
						<LogIn class="w-4 h-4" />
						Kakao로 로그인
					</Button>

					{#if authStore.error}
						<p class="text-xs text-destructive">{authStore.error}</p>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- 기본 알림 설정 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<Bell class="w-5 h-5" />
			<h2 class="font-semibold">기본 알림 설정</h2>
		</div>

		<div class="bg-card rounded-xl border border-border p-5 space-y-4">
			<!-- 자동 알림 토글 -->
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm">새 메모에 자동 알림</span>
					<p class="text-xs text-muted-foreground">메모 생성 시 자동으로 알림 설정</p>
				</div>
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
			</div>

			{#if autoReminderOnCreate}
				<div class="space-y-4 p-3 rounded-lg bg-muted/50 border border-border">
					<!-- 기본 시간 -->
					<div class="space-y-2">
						<label for="default-reminder-time" class="text-sm">기본 알림 시간</label>
						<input
							id="default-reminder-time"
							type="time"
							value={defaultTime}
							onchange={handleTimeChange}
							class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					<!-- 기본 요일 -->
					<div class="space-y-2">
						<span class="text-sm">기본 반복 요일</span>
						<div class="flex gap-1">
							{#each dayLabels as label, i}
								<button
									type="button"
									onclick={() => toggleDefaultDay(i)}
									class={cn(
										'w-8 h-8 rounded-full text-xs font-medium transition-colors',
										defaultDays.includes(i)
											? 'bg-primary text-primary-foreground'
											: 'bg-background border border-border hover:bg-muted'
									)}
								>
									{label}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- 데이터 관리 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<Download class="w-5 h-5" />
			<h2 class="font-semibold">데이터 관리</h2>
		</div>

		<div class="bg-card rounded-xl border border-border p-5 space-y-4">
			<p class="text-sm text-muted-foreground">현재 {memoCount}개의 메모가 저장되어 있습니다.</p>

			<div class="flex flex-col gap-2">
				<Button variant="secondary" onclick={handleExport} class="justify-start">
					<Download class="w-4 h-4" />
					백업 내보내기
				</Button>

				<Button variant="secondary" onclick={() => fileInput.click()} disabled={importing} class="justify-start">
					<Upload class="w-4 h-4" />
					{importing ? '가져오는 중...' : '백업 가져오기'}
				</Button>
				<input
					bind:this={fileInput}
					type="file"
					accept=".json"
					onchange={handleImport}
					class="hidden"
				/>

				{#if importError}
					<p class="text-xs text-destructive">{importError}</p>
				{/if}
			</div>
		</div>
	</section>

	<!-- 위험 영역 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-destructive">
			<Trash2 class="w-5 h-5" />
			<h2 class="font-semibold">위험 영역</h2>
		</div>

		<div class="bg-card rounded-xl border border-destructive/20 p-5">
			<Button variant="destructive" onclick={handleClearAll} class="w-full justify-start">
				<Trash2 class="w-4 h-4" />
				모든 메모 삭제
			</Button>
		</div>
	</section>

	<!-- 앱 정보 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<Info class="w-5 h-5" />
			<h2 class="font-semibold">앱 정보</h2>
		</div>

		<div class="bg-card rounded-xl border border-border p-5 space-y-4">
			<div class="flex justify-between items-center text-sm">
				<span class="text-muted-foreground">버전</span>
				<button
					onclick={handleVersionTap}
					class="font-medium select-none cursor-pointer hover:text-primary transition-colors"
					title={versionTapCount > 0 ? `${10 - versionTapCount}번 더 탭하세요` : ''}
				>
					1.0.0
					{#if versionTapCount > 0 && versionTapCount < 10}
						<span class="text-xs text-muted-foreground ml-1">({versionTapCount}/10)</span>
					{/if}
				</button>
			</div>
			<div class="flex justify-between items-center text-sm">
				<span class="text-muted-foreground">빌드</span>
				<span class="font-medium">2026.01.09</span>
			</div>

			<!-- 앱 업데이트 확인 -->
			<div class="pt-2 border-t border-border">
				<Button
					variant="secondary"
					onclick={handleUpdateCheck}
					disabled={updating}
					class="w-full justify-start"
				>
					<RefreshCw class={cn('w-4 h-4', updating && 'animate-spin')} />
					{updating ? '업데이트 확인 중...' : '앱 업데이트 확인'}
				</Button>
				<p class="text-xs text-muted-foreground mt-2">
					새 버전이 있으면 캐시를 초기화하고 업데이트합니다. 저장된 메모는 유지됩니다.
				</p>
			</div>
		</div>
	</section>

	<!-- 개발자 모드 -->
	{#if devMode}
		<section class="space-y-4">
			<div class="flex items-center gap-2 text-orange-500">
				<Bug class="w-5 h-5" />
				<h2 class="font-semibold">개발자 모드</h2>
				<button
					onclick={() => devMode = false}
					class="ml-auto text-xs text-muted-foreground hover:text-foreground"
				>
					닫기
				</button>
			</div>

			<div class="bg-card rounded-xl border border-orange-500/30 p-5 space-y-4">
				<!-- 알림 권한 상태 -->
				<div class="space-y-2">
					<h3 class="text-sm font-semibold flex items-center gap-2">
						알림 권한 상태
						{#if notificationStore.permission === 'granted'}
							<CheckCircle class="w-4 h-4 text-green-500" />
						{:else if notificationStore.permission === 'denied'}
							<XCircle class="w-4 h-4 text-red-500" />
						{:else}
							<XCircle class="w-4 h-4 text-yellow-500" />
						{/if}
					</h3>
					<p class="text-xs text-muted-foreground">
						현재 상태: <span class="font-mono">{notificationStore.permission}</span>
					</p>
					{#if notificationStore.permission !== 'granted'}
						<Button
							variant="secondary"
							size="sm"
							onclick={() => notificationStore.requestPermission()}
							class="w-full"
						>
							알림 권한 요청
						</Button>
					{/if}
				</div>

				<!-- 테스트 알림 -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold flex items-center gap-2">
						<BellRing class="w-4 h-4" />
						알림 테스트
					</h3>
					<Button
						variant="default"
						onclick={testNotification}
						class="w-full"
					>
						테스트 알림 보내기
					</Button>
					{#if testNotificationSent}
						<p class="text-xs text-green-500 flex items-center gap-1">
							<CheckCircle class="w-3 h-3" />
							테스트 알림이 발송되었습니다!
						</p>
					{/if}
				</div>

				<!-- 수동 알림 체크 -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold">수동 알림 체크</h3>
					<p class="text-xs text-muted-foreground">
						현재 시간에 맞는 알림이 있는지 수동으로 체크합니다.
					</p>
					<Button
						variant="secondary"
						onclick={triggerManualCheck}
						class="w-full"
					>
						알림 체크 실행
					</Button>
				</div>

				<!-- Capacitor 백그라운드 알림 (핵심!) -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold flex items-center gap-2">
						<Bell class="w-4 h-4" />
						Capacitor 백그라운드 알림
						{#if isNativePlatform}
							<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">네이티브</span>
						{:else}
							<span class="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">웹</span>
						{/if}
					</h3>

					<div class="text-xs text-muted-foreground space-y-1">
						<p>플랫폼: {isNativePlatform ? '네이티브 앱' : '웹 브라우저'}</p>
						<p>네이티브 알림 권한: <span class="font-mono">{nativePermission}</span></p>
					</div>

					{#if isNativePlatform}
						{#if nativePermission !== 'granted'}
							<Button
								variant="secondary"
								size="sm"
								onclick={requestNativeNotificationPermission}
								class="w-full"
							>
								네이티브 알림 권한 요청
							</Button>
						{/if}

						<Button
							variant="default"
							onclick={testCapacitorNotification}
							class="w-full"
						>
							5초 후 백그라운드 알림 테스트
						</Button>

						{#if capacitorTestScheduled}
							<p class="text-xs text-green-500 flex items-center gap-1">
								<CheckCircle class="w-3 h-3" />
								테스트 알림이 예약되었습니다! 앱을 닫아보세요.
							</p>
						{/if}

						<!-- 예약된 알림 목록 -->
						<div class="space-y-1 mt-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold">예약된 알림 ({pendingNotifications.length}개)</span>
								<button
									onclick={loadPendingNotifications}
									class="text-xs text-primary hover:underline"
								>
									새로고침
								</button>
							</div>
							{#if pendingNotifications.length > 0}
								<div class="text-xs font-mono bg-muted p-2 rounded max-h-32 overflow-y-auto space-y-1">
									{#each pendingNotifications as notification}
										<p class="truncate">{notification}</p>
									{/each}
								</div>
								<Button
									variant="destructive"
									size="sm"
									onclick={clearAllScheduledNotifications}
									class="w-full"
								>
									<Trash2 class="w-3 h-3" />
									모든 예약 알림 취소
								</Button>
							{:else}
								<p class="text-xs text-muted-foreground">예약된 알림이 없습니다.</p>
							{/if}
						</div>
					{:else}
						<p class="text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
							백그라운드 알림은 안드로이드 앱에서만 작동합니다.
							웹에서는 브라우저가 열려 있을 때만 알림이 가능합니다.
						</p>
					{/if}
				</div>

				<!-- 디버그 정보 -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold">디버그 정보</h3>
					<div class="text-xs font-mono bg-muted p-3 rounded-lg space-y-1">
						<p>알림 스토어 초기화: {notificationStore.initialized ? '완료' : '미완료'}</p>
						<p>오늘 알림 개수: {notificationStore.getTodayReminders().length}</p>
						<p>예정된 알림: {notificationStore.getUpcomingReminders().length}</p>
						<p>완료된 알림: {notificationStore.getPastReminders().length}</p>
						<p>스누즈된 알림: {notificationStore.snoozedReminders.length}</p>
						<p>Service Worker: {'serviceWorker' in navigator ? '지원됨' : '미지원'}</p>
						<p>Notification API: {'Notification' in window ? '지원됨' : '미지원'}</p>
						<p>Capacitor 네이티브: {isNativePlatform ? '예' : '아니오'}</p>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- Footer -->
	<Footer className="mt-8" />
</div>

<!-- Confirm Dialogs -->
<ConfirmDialog
	bind:open={showClearAllDialog}
	title="모든 데이터 삭제"
	message="모든 데이터를 삭제하시겠습니까?"
	confirmText="삭제"
	variant="destructive"
	onConfirm={confirmClearAll}
	onCancel={() => {}}
/>
