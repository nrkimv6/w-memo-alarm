<script lang="ts">

	import { Download, Upload, Trash2, Sun, Moon, Monitor, Bell, Cloud, LogIn, LogOut, Info, RefreshCw, Bug, BellRing, CheckCircle, XCircle, Smartphone, Radio, FileText, Settings2, CheckSquare } from 'lucide-svelte';
	import AlarmManager from '$lib/components/settings/AlarmManager.svelte';
	import { APP_VERSION } from '$lib/config';
	import Button from '$lib/components/ui/Button.svelte';
		import Footer from "$lib/components/Footer.svelte";
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { devLogStore, type DevLog } from '$lib/stores/devLogs.svelte';
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
	import { SW_MSG } from '$lib/constants/swMessages';
	import { supabase } from '$lib/services/supabase';
	import { registerFCMToken, getFCMConfigStatus } from '$lib/fcm';

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

	// 웹 푸시 테스트 상태
	let webPushTestSent = $state(false);
	let webPushDelayedSent = $state(false);
	let swRegistration = $state<ServiceWorkerRegistration | null>(null);
	let testDelaySeconds = $state(5); // 테스트 알림 지연 시간 (초)

	// SW 스케줄 상태 (개발자 모드용)
	let swScheduleStatus = $state<{
		reminders: Array<{memoId: string; title: string; time: string; type: string}>;
		intervalRunning: boolean;
		loading: boolean;
		error: string | null;
	}>({
		reminders: [],
		intervalRunning: false,
		loading: false,
		error: null
	});

	// 로그 뷰어 상태
	let logFilter = $state<'all' | 'Notification' | 'SW'>('all');
	let showLogViewer = $state(false);

	// 필터링된 로그
	const filteredLogs = $derived.by(() => {
		const logs = devLogStore.logs;
		if (logFilter === 'all') return logs.slice(-100);
		return logs.filter(l => l.source === logFilter).slice(-100);
	});

	// FCM 상태 (개발자 모드용)
	let fcmStatus = $state<{
		envConfigured: boolean;
		hasApiKey: boolean;
		hasVapidKey: boolean;
		projectId: string | null;
		fcmToken: string | null;
		userDevices: Array<{fcm_token: string; is_active: boolean; updated_at: string}>;
		alarmSchedules: Array<{id: string; alarm_time: string; notification_title: string; is_enabled: boolean}>;
		loading: boolean;
		error: string | null;
	}>({
		envConfigured: false,
		hasApiKey: false,
		hasVapidKey: false,
		projectId: null,
		fcmToken: null,
		userDevices: [],
		alarmSchedules: [],
		loading: false,
		error: null
	});
	let fcmRegistering = $state(false);

	// 초기화 - 페이지 로드 시 네이티브 체크
	$effect(() => {
		isNative().then(native => {
			isNativePlatform = native;
		});
	});

	// 개발자 모드 진입 시 상세 상태 체크
	$effect(() => {
		if (devMode) {
			devLogStore.init();
			checkCapacitorStatus();
			checkFCMStatus();
			checkServiceWorker();
		}
	});

	async function checkServiceWorker() {
		if ('serviceWorker' in navigator) {
			swRegistration = await navigator.serviceWorker.ready;
			await checkSWScheduleStatus();
		}
	}

	async function checkSWScheduleStatus() {
		swScheduleStatus.loading = true;
		swScheduleStatus.error = null;

		try {
			const status = await notificationStore.getServiceWorkerScheduleStatus();
			if (status) {
				swScheduleStatus.reminders = status.reminders as any[];
				swScheduleStatus.intervalRunning = status.intervalRunning;
			} else {
				swScheduleStatus.error = 'SW 응답 없음';
			}
		} catch (error) {
			swScheduleStatus.error = (error as Error).message;
		} finally {
			swScheduleStatus.loading = false;
		}
	}

	async function registerRemindersToSW() {
		await notificationStore.registerRemindersToServiceWorker();
		await checkSWScheduleStatus();
		alert('Service Worker에 알림 스케줄이 등록되었습니다. 콘솔에서 로그를 확인하세요.');
	}

	async function testWebPushNotification() {
		webPushTestSent = false;

		if (!('serviceWorker' in navigator)) {
			alert('이 브라우저는 Service Worker를 지원하지 않습니다.');
			return;
		}

		// 알림 권한 확인
		if (Notification.permission !== 'granted') {
			const result = await Notification.requestPermission();
			if (result !== 'granted') {
				alert('알림 권한이 필요합니다.');
				return;
			}
		}

		try {
			const registration = await navigator.serviceWorker.ready;
			registration.active?.postMessage({
				type: SW_MSG.TEST_NOTIFICATION,
				title: '웹 푸시 테스트',
				body: 'Service Worker에서 직접 보낸 알림입니다!'
			});
			webPushTestSent = true;
		} catch (e) {
			alert('테스트 실패: ' + (e as Error).message);
		}
	}

	async function testDelayedWebPushNotification() {
		webPushDelayedSent = false;

		if (!('serviceWorker' in navigator)) {
			alert('이 브라우저는 Service Worker를 지원하지 않습니다.');
			return;
		}

		// 알림 권한 확인
		if (Notification.permission !== 'granted') {
			const result = await Notification.requestPermission();
			if (result !== 'granted') {
				alert('알림 권한이 필요합니다.');
				return;
			}
		}

		try {
			const registration = await navigator.serviceWorker.ready;
			registration.active?.postMessage({
				type: SW_MSG.DELAYED_NOTIFICATION,
				delay: testDelaySeconds * 1000,
				title: '백그라운드 알림 테스트',
				body: `${testDelaySeconds}초 후 알림! 앱을 백그라운드로 보내도 이 알림이 표시되어야 합니다.`
			});
			webPushDelayedSent = true;
			alert(`${testDelaySeconds}초 후 알림이 예약되었습니다.\n\n지금 탭을 최소화하거나 다른 앱으로 전환해보세요!`);
		} catch (e) {
			alert('테스트 실패: ' + (e as Error).message);
		}
	}

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

	async function checkFCMStatus() {
		fcmStatus.loading = true;
		fcmStatus.error = null;

		try {
			// 1. 환경 변수 확인
			const configStatus = getFCMConfigStatus();
			fcmStatus.hasApiKey = configStatus.hasApiKey;
			fcmStatus.hasVapidKey = configStatus.hasVapidKey;
			fcmStatus.projectId = configStatus.projectId;
			fcmStatus.envConfigured = configStatus.isConfigured;

			// 2. 로그인 확인 및 Supabase 데이터 조회
			if (authStore.isAuthenticated && authStore.user?.id && supabase) {
				// user_devices 조회
				const { data: devices, error: devicesError } = await supabase
					.from('user_devices')
					.select('fcm_token, is_active, updated_at')
					.eq('user_id', authStore.user.id)
					.eq('app_name', 'memo-alarm')
					.order('updated_at', { ascending: false });

				if (devicesError) {
					console.error('Failed to fetch user_devices:', devicesError);
				} else {
					fcmStatus.userDevices = devices || [];
					// 활성 토큰이 있으면 저장
					const activeDevice = devices?.find(d => d.is_active);
					fcmStatus.fcmToken = activeDevice?.fcm_token?.substring(0, 20) + '...' || null;
				}

				// alarm_schedules 조회
				const { data: schedules, error: schedulesError } = await supabase
					.from('alarm_schedules')
					.select('id, alarm_time, notification_title, is_enabled')
					.eq('user_id', authStore.user.id)
					.eq('app_name', 'memo-alarm')
					.order('created_at', { ascending: false })
					.limit(10);

				if (schedulesError) {
					console.error('Failed to fetch alarm_schedules:', schedulesError);
				} else {
					fcmStatus.alarmSchedules = schedules || [];
				}
			}
		} catch (error) {
			fcmStatus.error = (error as Error).message;
			console.error('FCM status check failed:', error);
		} finally {
			fcmStatus.loading = false;
		}
	}

	async function manualRegisterFCM() {
		if (!authStore.isAuthenticated || !authStore.user?.id) {
			alert('로그인이 필요합니다.');
			return;
		}

		fcmRegistering = true;
		try {
			const result = await registerFCMToken(authStore.user.id);
			if (result) {
				alert(`FCM 토큰 등록 성공!\n플랫폼: ${result.platform}\n토큰: ${result.token.substring(0, 30)}...`);
				await checkFCMStatus(); // 상태 새로고침
			} else {
				alert('FCM 토큰 등록 실패. 콘솔을 확인하세요.');
			}
		} catch (error) {
			alert('FCM 등록 오류: ' + (error as Error).message);
		} finally {
			fcmRegistering = false;
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

			// 테스트 알림 스케줄링
			const scheduleTime = new Date(Date.now() + testDelaySeconds * 1000);

			await LocalNotifications.schedule({
				notifications: [{
					id: 99999,
					title: '테스트 백그라운드 알림',
					body: `${testDelaySeconds}초 후 알림이 정상 작동합니다! 앱을 닫아도 이 알림이 표시되어야 합니다.`,
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
					registration.waiting.postMessage({ type: SW_MSG.SKIP_WAITING });
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

	// 기본알림을 사용하는 메모 개수
	const defaultReminderMemoCount = $derived(
		memosStore.memos.filter((m) => m.reminder?.isDefault === true).length
	);

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

	// 할일 기본설정
	let todoRemindEnabled = $state(settingsStore.settings.todoDefaults.remind.enabled);
	let todoRemindTime = $state(settingsStore.settings.todoDefaults.remind.time);
	let todoAutoAlertEnabled = $state(settingsStore.settings.todoDefaults.autoAlert.enabled);
	let todoAutoAlertMinutes = $state(settingsStore.settings.todoDefaults.autoAlert.minutesBefore);
	let todoShowOverdue = $state(settingsStore.settings.todoDefaults.showOverdue);
	let todoShowProgress = $state(settingsStore.settings.todoDefaults.showProgress);

	const todoCount = $derived(memosStore.memos.filter(m => m.memoType === 'todo').length);

	function handleTodoRemindToggle() {
		todoRemindEnabled = !todoRemindEnabled;
		settingsStore.setTodoRemindEnabled(todoRemindEnabled);
	}

	function handleTodoRemindTimeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		todoRemindTime = target.value;
		settingsStore.setTodoRemindTime(target.value);
	}

	function handleTodoAutoAlertToggle() {
		todoAutoAlertEnabled = !todoAutoAlertEnabled;
		settingsStore.setTodoAutoAlertEnabled(todoAutoAlertEnabled);
	}

	function handleTodoAutoAlertMinutesChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		todoAutoAlertMinutes = parseInt(target.value);
		settingsStore.setTodoAutoAlertMinutes(todoAutoAlertMinutes);
	}

	function handleTodoShowOverdueToggle() {
		todoShowOverdue = !todoShowOverdue;
		settingsStore.setTodoShowOverdue(todoShowOverdue);
	}

	function handleTodoShowProgressToggle() {
		todoShowProgress = !todoShowProgress;
		settingsStore.setTodoShowProgress(todoShowProgress);
	}

	function handleExport() {
		downloadFullBackup();
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// 파일 확장자 검증
		const fileName = file.name.toLowerCase();
		if (!fileName.endsWith('.json')) {
			importError = 'JSON 파일만 가져올 수 있습니다. (.json)';
			input.value = '';
			return;
		}

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

	async function confirmClearAll() {
		await clearAllData();
	}
</script>

<div>
	<!-- Header section -->
	<div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
		<div class="max-w-6xl mx-auto px-4 py-4">
			<h1 class="text-xl font-bold tracking-tight text-foreground">설정</h1>
		</div>
	</div>

<div class="max-w-2xl mx-auto px-4 py-6 space-y-8">

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

		<!-- 클라우드 보관 -->
		<div class="bg-card rounded-xl border border-border p-5">
			<h3 class="text-sm font-semibold mb-3">클라우드 보관</h3>
			<p class="text-xs text-muted-foreground mb-4">
				계정으로 로그인하여 데이터를 안전하게 클라우드에 보관합니다.
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
					<button
						onclick={() => authStore.signInWithGoogle()}
						class="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
					>
						<svg class="w-5 h-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
						</svg>
						<span class="font-medium">Google로 로그인</span>
					</button>
					<button
						onclick={() => authStore.signInWithKakao()}
						class="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
					>
						<svg class="w-5 h-5" viewBox="0 0 24 24">
							<path fill="#3C1E1E" d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.035 5.906l-.857 3.2a.5.5 0 0 0 .764.548l3.79-2.452c.732.117 1.49.178 2.268.178 5.523 0 10-3.477 10-7.88C22 6.477 17.523 3 12 3z"/>
						</svg>
						<span class="font-medium">Kakao로 로그인</span>
					</button>

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
			<!-- 플랫폼별 안내 메시지 -->
			{#if !isNativePlatform}
				<div class="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
					<Info class="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
					<p class="text-xs text-blue-700 dark:text-blue-300">
						웹 브라우저에서는 로그인 후 FCM 푸시 알림으로 동작합니다.
					</p>
				</div>
			{/if}

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

					<!-- 영향받는 메모 경고 -->
					{#if defaultReminderMemoCount > 0}
						<div class="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
							<Info class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
							<p class="text-xs text-amber-700 dark:text-amber-300">
								변경 시 기본알림을 사용하는 <strong>{defaultReminderMemoCount}개</strong>의 메모에 자동으로 적용됩니다.
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- 할일 기본설정 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<CheckSquare class="w-5 h-5" />
			<h2 class="font-semibold">할일 기본설정</h2>
		</div>

		<div class="bg-card rounded-xl border border-border p-5 space-y-4">
			<p class="text-xs text-muted-foreground">
				현재 <strong>{todoCount}개</strong>의 할일이 있습니다.
			</p>

			<!-- 상기 알림 -->
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm">매일 상기 알림</span>
					<p class="text-xs text-muted-foreground">매일 같은 시각에 할일 상기 알림</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={todoRemindEnabled}
					onclick={handleTodoRemindToggle}
					class={cn('toggle-switch', todoRemindEnabled && 'active')}
				>
					<span class="toggle-switch-thumb"></span>
				</button>
			</div>

			{#if todoRemindEnabled}
				<div class="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
					<label for="todo-remind-time" class="text-sm">상기 시각</label>
					<input
						id="todo-remind-time"
						type="time"
						value={todoRemindTime}
						onchange={handleTodoRemindTimeChange}
						class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="text-xs text-muted-foreground">
						기한 없는 할일도 포함됩니다
					</p>
				</div>
			{/if}

			<!-- 자동 알람 -->
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm">자동 알람</span>
					<p class="text-xs text-muted-foreground">기한 전 N분에 자동으로 알람 발송</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={todoAutoAlertEnabled}
					onclick={handleTodoAutoAlertToggle}
					class={cn('toggle-switch', todoAutoAlertEnabled && 'active')}
				>
					<span class="toggle-switch-thumb"></span>
				</button>
			</div>

			{#if todoAutoAlertEnabled}
				<div class="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
					<label for="todo-auto-alert-minutes" class="text-sm">알람 시각</label>
					<select
						id="todo-auto-alert-minutes"
						value={todoAutoAlertMinutes}
						onchange={handleTodoAutoAlertMinutesChange}
						class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

			<!-- 기한 초과 표시 -->
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm">기한 초과 강조 표시</span>
					<p class="text-xs text-muted-foreground">기한 지난 할일 빨간색 강조</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={todoShowOverdue}
					onclick={handleTodoShowOverdueToggle}
					class={cn('toggle-switch', todoShowOverdue && 'active')}
				>
					<span class="toggle-switch-thumb"></span>
				</button>
			</div>

			<!-- 진행률 표시 -->
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm">진행률 표시</span>
					<p class="text-xs text-muted-foreground">오늘의 완료 진행률 바 표시</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={todoShowProgress}
					onclick={handleTodoShowProgressToggle}
					class={cn('toggle-switch', todoShowProgress && 'active')}
				>
					<span class="toggle-switch-thumb"></span>
				</button>
			</div>
		</div>
	</section>

	<!-- 알림 관리 -->
	<section class="space-y-4">
		<div class="flex items-center gap-2 text-primary">
			<Settings2 class="w-5 h-5" />
			<h2 class="font-semibold">알림 관리</h2>
		</div>

		<div class="bg-card rounded-xl border border-border overflow-hidden">
			<AlarmManager />
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
					accept="*/*"
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
					v{APP_VERSION}
					{#if versionTapCount > 0 && versionTapCount < 10}
						<span class="text-xs text-muted-foreground ml-1">({versionTapCount}/10)</span>
					{/if}
				</button>
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

						<div class="flex gap-2">
							<select
								bind:value={testDelaySeconds}
								class="flex-shrink-0 px-2 py-1.5 text-sm rounded-md border border-input bg-background"
							>
								<option value={5}>5초</option>
								<option value={10}>10초</option>
								<option value={30}>30초</option>
								<option value={60}>1분</option>
								<option value={120}>2분</option>
							</select>
							<Button
								variant="default"
								onclick={testCapacitorNotification}
								class="flex-1"
							>
								백그라운드 알림 테스트
							</Button>
						</div>

						{#if capacitorTestScheduled}
							<p class="text-xs text-green-500 flex items-center gap-1">
								<CheckCircle class="w-3 h-3" />
								{testDelaySeconds}초 후 테스트 알림이 예약됨! 앱을 닫아보세요.
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
							Capacitor 백그라운드 알림은 안드로이드 앱에서만 작동합니다.
							웹 환경에서는 아래 "웹 Service Worker 알림" 테스트를 사용하세요.
						</p>
					{/if}
				</div>

				<!-- 웹 Service Worker 알림 테스트 (핵심!) -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold flex items-center gap-2">
						<Bell class="w-4 h-4" />
						웹 Service Worker 알림
						{#if swRegistration}
							<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">SW 활성</span>
						{:else}
							<span class="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded">SW 없음</span>
						{/if}
					</h3>

					<div class="text-xs text-muted-foreground space-y-1">
						<p>Service Worker 상태: {swRegistration ? '등록됨' : '미등록'}</p>
						<p>Notification 권한: <span class="font-mono">{typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}</span></p>
					</div>

					<div class="space-y-2">
						<Button
							variant="default"
							size="sm"
							onclick={testWebPushNotification}
							class="w-full"
						>
							즉시 알림 테스트 (Service Worker)
						</Button>
						{#if webPushTestSent}
							<p class="text-xs text-green-500 flex items-center gap-1">
								<CheckCircle class="w-3 h-3" />
								테스트 알림이 발송되었습니다!
							</p>
						{/if}

						<div class="flex gap-2">
							<select
								bind:value={testDelaySeconds}
								class="flex-shrink-0 px-2 py-1.5 text-sm rounded-md border border-input bg-background"
							>
								<option value={5}>5초</option>
								<option value={10}>10초</option>
								<option value={30}>30초</option>
								<option value={60}>1분</option>
								<option value={120}>2분</option>
							</select>
							<Button
								variant="secondary"
								size="sm"
								onclick={testDelayedWebPushNotification}
								class="flex-1"
							>
								백그라운드 알림 테스트
							</Button>
						</div>
						{#if webPushDelayedSent}
							<p class="text-xs text-green-500 flex items-center gap-1">
								<CheckCircle class="w-3 h-3" />
								{testDelaySeconds}초 후 알림 예약됨! 탭을 백그라운드로 보내세요.
							</p>
						{/if}
					</div>

					<div class="text-xs text-blue-600 bg-blue-500/10 p-2 rounded space-y-1">
						<p class="font-semibold">테스트 방법:</p>
						<ol class="list-decimal list-inside space-y-0.5">
							<li>시간을 선택하고 "백그라운드 알림 테스트" 클릭</li>
							<li>즉시 탭을 최소화하거나 다른 앱으로 전환</li>
							<li>설정한 시간 후 알림이 오면 성공!</li>
						</ol>
						<p class="mt-2 text-yellow-600">※ 브라우저를 완전히 닫으면 안 됩니다. 탭이 열려있어야 합니다.</p>
					</div>
				</div>

				<!-- SW 메모 알림 스케줄 상태 (핵심!) -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold flex items-center gap-2">
						<Bell class="w-4 h-4" />
						SW 메모 알림 스케줄
						{#if swScheduleStatus.intervalRunning}
							<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">체크 중</span>
						{:else}
							<span class="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">대기</span>
						{/if}
						<button
							onclick={checkSWScheduleStatus}
							class="ml-auto text-xs text-primary hover:underline"
						>
							새로고침
						</button>
					</h3>

					{#if swScheduleStatus.loading}
						<p class="text-xs text-muted-foreground">로딩 중...</p>
					{:else if swScheduleStatus.error}
						<p class="text-xs text-red-500">{swScheduleStatus.error}</p>
					{:else}
						<div class="text-xs space-y-1 p-2 rounded bg-muted">
							<p class="font-semibold">등록된 알림: {swScheduleStatus.reminders.length}개</p>
							<p>Interval 실행 중: {swScheduleStatus.intervalRunning ? '예' : '아니오'}</p>
						</div>

						{#if swScheduleStatus.reminders.length > 0}
							<div class="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-y-auto space-y-1">
								{#each swScheduleStatus.reminders as reminder}
									<p class="truncate border-b border-border/50 pb-1">
										[{reminder.time}] {reminder.title}
										<span class="text-muted-foreground">({reminder.type})</span>
									</p>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-muted-foreground">Service Worker에 등록된 알림이 없습니다.</p>
						{/if}

						<Button
							variant="default"
							size="sm"
							onclick={registerRemindersToSW}
							class="w-full"
						>
							SW에 알림 스케줄 등록
						</Button>

						<div class="text-xs text-orange-600 bg-orange-500/10 p-2 rounded space-y-1">
							<p class="font-semibold">⚠️ 문제 원인:</p>
							<p>현재 메모 알림은 메인 스레드의 setInterval로 체크됩니다.</p>
							<p>앱이 백그라운드로 가면 setInterval이 멈추므로 알림이 안 뜹니다.</p>
							<p class="mt-1 text-green-600 font-semibold">✅ 해결 방법:</p>
							<p>위 버튼을 눌러 Service Worker에 알림 스케줄을 등록하면</p>
							<p>SW에서 매분 체크하여 백그라운드에서도 알림이 작동합니다.</p>
						</div>
					{/if}
				</div>

				<!-- FCM 상태 체크 (웹 푸시) -->
				<div class="space-y-2 pt-2 border-t border-border">
					<h3 class="text-sm font-semibold flex items-center gap-2">
						<Radio class="w-4 h-4" />
						FCM 웹 푸시 상태
						<button
							onclick={checkFCMStatus}
							class="ml-auto text-xs text-primary hover:underline"
						>
							새로고침
						</button>
					</h3>

					{#if fcmStatus.loading}
						<p class="text-xs text-muted-foreground">로딩 중...</p>
					{:else}
						<!-- 환경 변수 상태 -->
						<div class="text-xs space-y-1 p-2 rounded bg-muted">
							<p class="font-semibold mb-1">환경 변수:</p>
							<p class="flex items-center gap-1">
								Firebase API Key:
								{#if fcmStatus.hasApiKey}
									<CheckCircle class="w-3 h-3 text-green-500" />
									<span class="text-green-500">설정됨</span>
								{:else}
									<XCircle class="w-3 h-3 text-red-500" />
									<span class="text-red-500">미설정</span>
								{/if}
							</p>
							<p class="flex items-center gap-1">
								VAPID Key:
								{#if fcmStatus.hasVapidKey}
									<CheckCircle class="w-3 h-3 text-green-500" />
									<span class="text-green-500">설정됨</span>
								{:else}
									<XCircle class="w-3 h-3 text-red-500" />
									<span class="text-red-500">미설정</span>
								{/if}
							</p>
							<p>Project ID: <span class="font-mono">{fcmStatus.projectId || 'N/A'}</span></p>
						</div>

						<!-- 로그인 상태 -->
						<div class="text-xs space-y-1 p-2 rounded bg-muted">
							<p class="font-semibold mb-1">인증 상태:</p>
							<p class="flex items-center gap-1">
								로그인:
								{#if authStore.isAuthenticated}
									<CheckCircle class="w-3 h-3 text-green-500" />
									<span class="text-green-500">{authStore.user?.email || authStore.user?.id?.substring(0, 8)}</span>
								{:else}
									<XCircle class="w-3 h-3 text-yellow-500" />
									<span class="text-yellow-500">미로그인</span>
								{/if}
							</p>
						</div>

						<!-- user_devices 상태 -->
						<div class="text-xs space-y-1 p-2 rounded bg-muted">
							<p class="font-semibold mb-1">user_devices (FCM 토큰):</p>
							{#if fcmStatus.userDevices.length > 0}
								{#each fcmStatus.userDevices as device}
									<p class="flex items-center gap-1 truncate">
										{#if device.is_active}
											<CheckCircle class="w-3 h-3 text-green-500 flex-shrink-0" />
										{:else}
											<XCircle class="w-3 h-3 text-gray-400 flex-shrink-0" />
										{/if}
										<span class="font-mono truncate">{device.fcm_token?.substring(0, 25)}...</span>
										<span class="text-muted-foreground">({device.is_active ? '활성' : '비활성'})</span>
									</p>
								{/each}
							{:else if authStore.isAuthenticated}
								<p class="text-yellow-500">등록된 FCM 토큰 없음</p>
							{:else}
								<p class="text-muted-foreground">로그인 필요</p>
							{/if}
						</div>

						<!-- alarm_schedules 상태 -->
						<div class="text-xs space-y-1 p-2 rounded bg-muted">
							<p class="font-semibold mb-1">alarm_schedules ({fcmStatus.alarmSchedules.length}개):</p>
							{#if fcmStatus.alarmSchedules.length > 0}
								<div class="max-h-24 overflow-y-auto space-y-1">
									{#each fcmStatus.alarmSchedules as schedule}
										<p class="flex items-center gap-1">
											{#if schedule.is_enabled}
												<CheckCircle class="w-3 h-3 text-green-500 flex-shrink-0" />
											{:else}
												<XCircle class="w-3 h-3 text-gray-400 flex-shrink-0" />
											{/if}
											<span class="font-mono">{schedule.alarm_time}</span>
											<span class="truncate">{schedule.notification_title}</span>
										</p>
									{/each}
								</div>
							{:else if authStore.isAuthenticated}
								<p class="text-yellow-500">등록된 알림 스케줄 없음</p>
							{:else}
								<p class="text-muted-foreground">로그인 필요</p>
							{/if}
						</div>

						<!-- FCM 토큰 수동 등록 -->
						{#if authStore.isAuthenticated}
							<Button
								variant="default"
								size="sm"
								onclick={manualRegisterFCM}
								disabled={fcmRegistering}
								class="w-full"
							>
								{#if fcmRegistering}
									FCM 토큰 등록 중...
								{:else}
									FCM 토큰 수동 등록
								{/if}
							</Button>
						{/if}

						{#if fcmStatus.error}
							<p class="text-xs text-red-500">{fcmStatus.error}</p>
						{/if}
					{/if}
				</div>

				<!-- 앱 내 로그 뷰어 (핵심!) -->
				<div class="space-y-2 pt-2 border-t border-border">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold flex items-center gap-2">
							<FileText class="w-4 h-4" />
							알림 로그 뷰어
							<span class="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">
								{devLogStore.logs.length}개
							</span>
						</h3>
						<div class="flex gap-2">
							<button
								onclick={() => showLogViewer = !showLogViewer}
								class="text-xs text-primary hover:underline"
							>
								{showLogViewer ? '접기' : '펼치기'}
							</button>
							<button
								onclick={() => devLogStore.clear()}
								class="text-xs text-red-500 hover:underline"
							>
								지우기
							</button>
						</div>
					</div>

					{#if showLogViewer}
						<!-- 필터 버튼 -->
						<div class="flex gap-1">
							<button
								onclick={() => logFilter = 'all'}
								class={cn(
									"text-xs px-2 py-1 rounded",
									logFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'
								)}
							>
								전체
							</button>
							<button
								onclick={() => logFilter = 'Notification'}
								class={cn(
									"text-xs px-2 py-1 rounded",
									logFilter === 'Notification' ? 'bg-primary text-primary-foreground' : 'bg-muted'
								)}
							>
								Notification
							</button>
							<button
								onclick={() => logFilter = 'SW'}
								class={cn(
									"text-xs px-2 py-1 rounded",
									logFilter === 'SW' ? 'bg-primary text-primary-foreground' : 'bg-muted'
								)}
							>
								SW
							</button>
						</div>

						<!-- 로그 목록 -->
						<div class="text-xs font-mono bg-black text-green-400 p-3 rounded-lg max-h-80 overflow-y-auto space-y-1">
							{#if filteredLogs().length === 0}
								<p class="text-gray-500">로그가 없습니다.</p>
							{:else}
								{#each filteredLogs().reverse() as log}
									<div class={cn(
										"border-b border-gray-800 pb-1",
										log.level === 'error' && 'text-red-400',
										log.level === 'warn' && 'text-yellow-400',
										log.level === 'debug' && 'text-gray-500'
									)}>
										<span class="text-gray-600">
											{new Date(log.timestamp).toLocaleTimeString()}
										</span>
										<span class="text-blue-400">[{log.source}]</span>
										{log.message}
										{#if log.data}
											<span class="text-gray-500">{JSON.stringify(log.data)}</span>
										{/if}
									</div>
								{/each}
							{/if}
						</div>

						<div class="text-xs text-muted-foreground">
							* 로그는 앱이 실행 중일 때만 기록됩니다. 백그라운드 SW 로그는 브라우저 개발자 도구에서 확인하세요.
						</div>
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
