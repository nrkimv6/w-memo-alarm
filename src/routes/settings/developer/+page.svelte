<script lang="ts">
	import { goto } from '$app/navigation';
	import SubPageShell from '$lib/components/settings/SubPageShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { cn } from '$lib/utils';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { devLogStore } from '$lib/stores/devLogs.svelte';
	import { supabase } from '$lib/services/supabase';
	import { registerFCMToken, getFCMConfigStatus, detectProjectMarkerMismatch } from '$lib/fcm';
	import { SW_MSG } from '$lib/constants/swMessages';
	import {
		isNative,
		requestNotificationPermission as requestNativePermission,
		checkNotificationPermission as checkNativePermission,
		scheduleNotification,
		cancelAllNotifications
	} from '$lib/utils/capacitor';
	import {
		Bell,
		BellRing,
		CheckCircle,
		XCircle,
		Radio,
		FileText,
		Trash2,
		Bug
	} from 'lucide-svelte';

	// Capacitor 상태
	let isNativePlatform = $state(false);
	let nativePermission = $state<string>('확인 중...');
	let pendingNotifications = $state<string[]>([]);
	let capacitorTestScheduled = $state(false);

	// 알림 테스트 상태
	let testNotificationSent = $state(false);

	// 웹 푸시 테스트 상태
	let webPushTestSent = $state(false);
	let webPushDelayedSent = $state(false);
	let swRegistration = $state<ServiceWorkerRegistration | null>(null);
	let testDelaySeconds = $state(5);

	// SW 스케줄 상태
	let swScheduleStatus = $state<{
		reminders: Array<{ memoId: string; title: string; time: string; type: string }>;
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

	const filteredLogs = $derived.by(() => {
		const logs = devLogStore.logs;
		if (logFilter === 'all') return logs.slice(-100);
		return logs.filter((l) => l.source === logFilter).slice(-100);
	});

	type FcmNotificationLog = {
		status: string;
		error_message: string | null;
		sent_at: string | null;
	};

	type FcmProjectComparison = 'match' | 'mismatch' | 'unknown';

	function formatDevDateTime(value: string | null) {
		if (!value) return '없음';
		return new Date(value).toLocaleString();
	}

	function extractProjectIdFromMessage(message: string | null) {
		if (!message) return null;
		const patterns = [
			/service_account_project_id["'=:\s]+([a-z0-9-]+)/i,
			/env_project_id["'=:\s]+([a-z0-9-]+)/i,
			/project_id["'=:\s]+([a-z0-9-]+)/i,
			/projects\/([a-z0-9-]+)/i
		];
		for (const pattern of patterns) {
			const match = message.match(pattern);
			if (match?.[1]) return match[1];
		}
		return null;
	}

	let fcmStatus = $state<{
		envConfigured: boolean;
		hasApiKey: boolean;
		hasVapidKey: boolean;
		projectId: string | null;
		envProjectId: string | null;
		messagingSenderId: string | null;
		fcmToken: string | null;
		userDevices: Array<{ fcm_token: string; is_active: boolean; updated_at: string }>;
		alarmSchedules: Array<{
			id: string;
			alarm_time: string;
			notification_title: string;
			is_enabled: boolean;
		}>;
		notificationLogs: FcmNotificationLog[];
		lastSuccessAt: string | null;
		lastFailedAt: string | null;
		lastErrorMessage: string | null;
		loading: boolean;
		error: string | null;
	}>({
		envConfigured: false,
		hasApiKey: false,
		hasVapidKey: false,
		projectId: null,
		envProjectId: null,
		messagingSenderId: null,
		fcmToken: null,
		userDevices: [],
		alarmSchedules: [],
		notificationLogs: [],
		lastSuccessAt: null,
		lastFailedAt: null,
		lastErrorMessage: null,
		loading: false,
		error: null
	});
	let fcmRegistering = $state(false);

	const activeFcmTokenCount = $derived.by(() => {
		return fcmStatus.userDevices.filter((device) => device.is_active).length;
	});

	const serverProjectId = $derived.by(() => {
		return extractProjectIdFromMessage(fcmStatus.lastErrorMessage);
	});

	const projectIdComparison = $derived.by((): FcmProjectComparison => {
		if (!fcmStatus.projectId || !serverProjectId) return 'unknown';
		return fcmStatus.projectId === serverProjectId ? 'match' : 'mismatch';
	});

	const notificationLogsPermissionIssue = $derived.by(() => {
		if (!fcmStatus.error?.startsWith('notification_logs 조회 실패:')) return false;
		return /permission denied|forbidden|not allowed|rls/i.test(fcmStatus.error);
	});

	const projectMarkerState = $derived.by(() => {
		const { mismatch, stored, current } = detectProjectMarkerMismatch();
		return { mismatch, stored, current };
	});

	const senderMismatchLogs = $derived.by(() => {
		return fcmStatus.notificationLogs.filter((log) =>
			log.error_message?.includes('[SENDER_ID_MISMATCH@')
		);
	});

	const recentHasSenderMismatch = $derived.by(() => senderMismatchLogs.length > 0);

	const recentHasPermissionDenied = $derived.by(() =>
		fcmStatus.notificationLogs.some((log) => log.error_message?.includes('[PERMISSION_DENIED]'))
	);

	const fcmCutoverSuccess = $derived.by(() => {
		return activeFcmTokenCount >= 1 && !recentHasSenderMismatch && !recentHasPermissionDenied;
	});

	$effect(() => {
		isNative().then((native) => {
			isNativePlatform = native;
		});
	});

	$effect(() => {
		devLogStore.init();
		checkCapacitorStatus();
		checkFCMStatus();
		checkServiceWorker();
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
		if (Notification.permission !== 'granted') {
			const result = await Notification.requestPermission();
			if (result !== 'granted') { alert('알림 권한이 필요합니다.'); return; }
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
		if (Notification.permission !== 'granted') {
			const result = await Notification.requestPermission();
			if (result !== 'granted') { alert('알림 권한이 필요합니다.'); return; }
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
		fcmStatus.userDevices = [];
		fcmStatus.alarmSchedules = [];
		fcmStatus.notificationLogs = [];
		fcmStatus.fcmToken = null;
		fcmStatus.lastSuccessAt = null;
		fcmStatus.lastFailedAt = null;
		fcmStatus.lastErrorMessage = null;
		try {
			const configStatus = getFCMConfigStatus();
			fcmStatus.hasApiKey = configStatus.hasApiKey;
			fcmStatus.hasVapidKey = configStatus.hasVapidKey;
			fcmStatus.projectId = configStatus.projectId;
			fcmStatus.envProjectId = configStatus.envProjectId;
			fcmStatus.messagingSenderId = configStatus.messagingSenderId;
			fcmStatus.envConfigured = configStatus.isConfigured;

			if (authStore.isAuthenticated && authStore.user?.id && supabase) {
				const { data: devices, error: devicesError } = await supabase
					.from('user_devices')
					.select('fcm_token, is_active, updated_at')
					.eq('user_id', authStore.user.id)
					.eq('app_name', 'memo-alarm')
					.order('updated_at', { ascending: false });
				if (!devicesError) {
					fcmStatus.userDevices = devices || [];
					const activeDevice = devices?.find((d) => d.is_active);
					fcmStatus.fcmToken = activeDevice?.fcm_token
						? activeDevice.fcm_token.substring(0, 20) + '...'
						: null;
				}

				const { data: schedules, error: schedulesError } = await supabase
					.from('alarm_schedules')
					.select('id, alarm_time, notification_title, is_enabled')
					.eq('user_id', authStore.user.id)
					.eq('app_name', 'memo-alarm')
					.order('created_at', { ascending: false })
					.limit(10);
				if (!schedulesError) fcmStatus.alarmSchedules = schedules || [];

				const { data: notificationLogs, error: notificationLogsError } = await supabase
					.from('notification_logs')
					.select('status, error_message, sent_at')
					.eq('user_id', authStore.user.id)
					.eq('app_name', 'memo-alarm')
					.order('sent_at', { ascending: false })
					.limit(10);
				if (notificationLogsError) {
					const baseMessage = `notification_logs 조회 실패: ${notificationLogsError.message}`;
					fcmStatus.error = /permission denied|forbidden|not allowed|rls/i.test(
						notificationLogsError.message
					)
						? `${baseMessage} (notification_logs RLS 정책이 user_id 매칭 SELECT를 허용해야 합니다.)`
						: baseMessage;
				} else {
					fcmStatus.notificationLogs = (notificationLogs || []) as FcmNotificationLog[];
					const lastSuccessLog = fcmStatus.notificationLogs.find((l) => l.status === 'success');
					const lastFailedLog = fcmStatus.notificationLogs.find((l) => l.status === 'failed');
					fcmStatus.lastSuccessAt = lastSuccessLog?.sent_at || null;
					fcmStatus.lastFailedAt = lastFailedLog?.sent_at || null;
					fcmStatus.lastErrorMessage = lastFailedLog?.error_message || null;
				}
			}
		} catch (error) {
			fcmStatus.error = (error as Error).message;
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
				await checkFCMStatus();
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
			pendingNotifications = pending.notifications.map(
				(n) =>
					`[${n.id}] ${n.title} - ${n.schedule?.at ? new Date(n.schedule.at).toLocaleString() : '시간 없음'}`
			);
		} catch (e) {
			pendingNotifications = ['로드 실패'];
		}
	}

	async function requestNativeNotificationPermission() {
		const granted = await requestNativePermission();
		nativePermission = granted ? 'granted' : 'denied';
	}

	async function testCapacitorNotification() {
		capacitorTestScheduled = false;
		if (!isNativePlatform) { alert('네이티브 앱에서만 사용 가능합니다.'); return; }
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			const permission = await LocalNotifications.checkPermissions();
			if (permission.display !== 'granted') {
				const req = await LocalNotifications.requestPermissions();
				if (req.display !== 'granted') { alert('알림 권한이 필요합니다.'); return; }
			}
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

	async function testNotification() {
		testNotificationSent = false;
		if (notificationStore.permission !== 'granted') {
			const granted = await notificationStore.requestPermission();
			if (!granted) { alert('알림 권한이 필요합니다. 브라우저 설정에서 알림을 허용해주세요.'); return; }
		}
		try {
			const testMemo = {
				id: 'test-notification', title: '테스트 알림',
				content: '알림이 정상적으로 작동합니다!', url: '',
				reminder: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
			};
			// @ts-ignore
			notificationStore.showNotification(testMemo);
			testNotificationSent = true;
		} catch (error) {
			alert('알림 발송에 실패했습니다: ' + (error as Error).message);
		}
	}

	function triggerManualCheck() {
		notificationStore.checkAndTriggerReminders();
		alert('알림 체크가 수동으로 실행되었습니다.');
	}

	function exitDevMode() {
		localStorage.removeItem('dev_mode_unlocked');
		goto('/settings');
	}
</script>

<SubPageShell title="개발자 모드" eyebrow="Developer">
	<div class="bg-card rounded-xl border border-orange-500/30 p-5 space-y-4">
		<div class="flex items-center gap-2 text-orange-500">
			<Bug class="w-4 h-4" />
			<span class="text-sm font-semibold">개발자 도구</span>
			<button onclick={exitDevMode} class="ml-auto text-xs text-muted-foreground hover:text-foreground">
				모드 해제
			</button>
		</div>

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
			<p class="text-xs text-muted-foreground">현재 상태: <span class="font-mono">{notificationStore.permission}</span></p>
			{#if notificationStore.permission !== 'granted'}
				<Button variant="secondary" size="sm" onclick={() => notificationStore.requestPermission()} class="w-full">알림 권한 요청</Button>
			{/if}
		</div>

		<!-- 테스트 알림 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<h3 class="text-sm font-semibold flex items-center gap-2"><BellRing class="w-4 h-4" /> 알림 테스트</h3>
			<Button variant="default" onclick={testNotification} class="w-full">테스트 알림 보내기</Button>
			{#if testNotificationSent}
				<p class="text-xs text-green-500 flex items-center gap-1"><CheckCircle class="w-3 h-3" /> 테스트 알림이 발송되었습니다!</p>
			{/if}
		</div>

		<!-- 수동 알림 체크 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<h3 class="text-sm font-semibold">수동 알림 체크</h3>
			<p class="text-xs text-muted-foreground">현재 시간에 맞는 알림이 있는지 수동으로 체크합니다.</p>
			<Button variant="secondary" onclick={triggerManualCheck} class="w-full">알림 체크 실행</Button>
		</div>

		<!-- Capacitor 백그라운드 알림 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<h3 class="text-sm font-semibold flex items-center gap-2">
				<Bell class="w-4 h-4" /> Capacitor 백그라운드 알림
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
					<Button variant="secondary" size="sm" onclick={requestNativeNotificationPermission} class="w-full">네이티브 알림 권한 요청</Button>
				{/if}
				<div class="flex gap-2">
					<select bind:value={testDelaySeconds} class="flex-shrink-0 px-2 py-1.5 text-sm rounded-md border border-input bg-background">
						<option value={5}>5초</option><option value={10}>10초</option>
						<option value={30}>30초</option><option value={60}>1분</option>
						<option value={120}>2분</option>
					</select>
					<Button variant="default" onclick={testCapacitorNotification} class="flex-1">백그라운드 알림 테스트</Button>
				</div>
				{#if capacitorTestScheduled}
					<p class="text-xs text-green-500 flex items-center gap-1"><CheckCircle class="w-3 h-3" /> {testDelaySeconds}초 후 테스트 알림이 예약됨! 앱을 닫아보세요.</p>
				{/if}
				<div class="space-y-1 mt-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold">예약된 알림 ({pendingNotifications.length}개)</span>
						<button onclick={loadPendingNotifications} class="text-xs text-primary hover:underline">새로고침</button>
					</div>
					{#if pendingNotifications.length > 0}
						<div class="text-xs font-mono bg-muted p-2 rounded max-h-32 overflow-y-auto space-y-1">
							{#each pendingNotifications as notification}<p class="truncate">{notification}</p>{/each}
						</div>
						<Button variant="destructive" size="sm" onclick={clearAllScheduledNotifications} class="w-full">
							<Trash2 class="w-3 h-3" /> 모든 예약 알림 취소
						</Button>
					{:else}
						<p class="text-xs text-muted-foreground">예약된 알림이 없습니다.</p>
					{/if}
				</div>
			{:else}
				<p class="text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
					Capacitor 백그라운드 알림은 안드로이드 앱에서만 작동합니다. 웹 환경에서는 아래 "웹 Service Worker 알림" 테스트를 사용하세요.
				</p>
			{/if}
		</div>

		<!-- 웹 Service Worker 알림 테스트 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<h3 class="text-sm font-semibold flex items-center gap-2">
				<Bell class="w-4 h-4" /> 웹 Service Worker 알림
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
				<Button variant="default" size="sm" onclick={testWebPushNotification} class="w-full">즉시 알림 테스트 (Service Worker)</Button>
				{#if webPushTestSent}
					<p class="text-xs text-green-500 flex items-center gap-1"><CheckCircle class="w-3 h-3" /> 테스트 알림이 발송되었습니다!</p>
				{/if}
				<div class="flex gap-2">
					<select bind:value={testDelaySeconds} class="flex-shrink-0 px-2 py-1.5 text-sm rounded-md border border-input bg-background">
						<option value={5}>5초</option><option value={10}>10초</option>
						<option value={30}>30초</option><option value={60}>1분</option>
						<option value={120}>2분</option>
					</select>
					<Button variant="secondary" size="sm" onclick={testDelayedWebPushNotification} class="flex-1">백그라운드 알림 테스트</Button>
				</div>
				{#if webPushDelayedSent}
					<p class="text-xs text-green-500 flex items-center gap-1"><CheckCircle class="w-3 h-3" /> {testDelaySeconds}초 후 알림 예약됨! 탭을 백그라운드로 보내세요.</p>
				{/if}
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
		</div>

		<!-- SW 메모 알림 스케줄 상태 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<h3 class="text-sm font-semibold flex items-center gap-2">
				<Bell class="w-4 h-4" /> SW 메모 알림 스케줄
				{#if swScheduleStatus.intervalRunning}
					<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">체크 중</span>
				{:else}
					<span class="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">대기</span>
				{/if}
				<button onclick={checkSWScheduleStatus} class="ml-auto text-xs text-primary hover:underline">새로고침</button>
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
							<p class="truncate border-b border-border/50 pb-1">[{reminder.time}] {reminder.title} <span class="text-muted-foreground">({reminder.type})</span></p>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-muted-foreground">Service Worker에 등록된 알림이 없습니다.</p>
				{/if}
				<Button variant="default" size="sm" onclick={registerRemindersToSW} class="w-full">SW에 알림 스케줄 등록</Button>
				<div class="text-xs text-orange-600 bg-orange-500/10 p-2 rounded space-y-1">
					<p class="font-semibold">⚠️ 문제 원인:</p>
					<p>현재 메모 알림은 메인 스레드의 setInterval로 체크됩니다. 앱이 백그라운드로 가면 setInterval이 멈추므로 알림이 안 뜹니다.</p>
					<p class="mt-1 text-green-600 font-semibold">✅ 해결 방법:</p>
					<p>위 버튼을 눌러 Service Worker에 알림 스케줄을 등록하면 SW에서 매분 체크하여 백그라운드에서도 알림이 작동합니다.</p>
				</div>
			{/if}
		</div>

		<!-- FCM 상태 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<h3 class="text-sm font-semibold flex items-center gap-2">
				<Radio class="w-4 h-4" /> FCM 웹 푸시 상태
				<button onclick={checkFCMStatus} class="ml-auto text-xs text-primary hover:underline">새로고침</button>
			</h3>
			{#if fcmStatus.loading}
				<p class="text-xs text-muted-foreground">로딩 중...</p>
			{:else}
				<div class="text-xs space-y-1 p-2 rounded bg-muted">
					<p class="font-semibold mb-1">환경 변수:</p>
					<p class="flex items-center gap-1">Firebase API Key: {#if fcmStatus.hasApiKey}<CheckCircle class="w-3 h-3 text-green-500" /><span class="text-green-500">설정됨</span>{:else}<XCircle class="w-3 h-3 text-red-500" /><span class="text-red-500">미설정</span>{/if}</p>
					<p class="flex items-center gap-1">VAPID Key: {#if fcmStatus.hasVapidKey}<CheckCircle class="w-3 h-3 text-green-500" /><span class="text-green-500">설정됨</span>{:else}<XCircle class="w-3 h-3 text-red-500" /><span class="text-red-500">미설정</span>{/if}</p>
					<p>Project ID: <span class="font-mono">{fcmStatus.projectId || 'N/A'}</span></p>
					<p>Env Project ID: <span class="font-mono">{fcmStatus.envProjectId || 'N/A'}</span></p>
					<p>Messaging Sender ID: <span class="font-mono">{fcmStatus.messagingSenderId || 'N/A'}</span></p>
				</div>
				<div class="text-xs space-y-1 p-2 rounded bg-muted">
					<p class="font-semibold mb-1">인증 상태:</p>
					<p class="flex items-center gap-1">로그인: {#if authStore.isAuthenticated}<CheckCircle class="w-3 h-3 text-green-500" /><span class="text-green-500">{authStore.user?.email || authStore.user?.id?.substring(0, 8)}</span>{:else}<XCircle class="w-3 h-3 text-yellow-500" /><span class="text-yellow-500">미로그인</span>{/if}</p>
				</div>
				<div class="text-xs space-y-1 p-2 rounded bg-muted">
					<p class="font-semibold mb-1">user_devices (FCM 토큰):</p>
					{#if fcmStatus.userDevices.length > 0}
						{#each fcmStatus.userDevices as device}
							<p class="flex items-center gap-1 truncate">
								{#if device.is_active}<CheckCircle class="w-3 h-3 text-green-500 flex-shrink-0" />{:else}<XCircle class="w-3 h-3 text-gray-400 flex-shrink-0" />{/if}
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
				<div class="text-xs space-y-1 p-2 rounded bg-muted">
					<p class="font-semibold mb-1">alarm_schedules ({fcmStatus.alarmSchedules.length}개):</p>
					{#if fcmStatus.alarmSchedules.length > 0}
						<div class="max-h-24 overflow-y-auto space-y-1">
							{#each fcmStatus.alarmSchedules as schedule}
								<p class="flex items-center gap-1">
									{#if schedule.is_enabled}<CheckCircle class="w-3 h-3 text-green-500 flex-shrink-0" />{:else}<XCircle class="w-3 h-3 text-gray-400 flex-shrink-0" />{/if}
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
				<div class="text-xs space-y-2 p-2 rounded bg-muted">
					<p class="font-semibold">서버측 FCM 상태</p>
					<p>마지막 성공: <span class="font-mono">{formatDevDateTime(fcmStatus.lastSuccessAt)}</span></p>
					<p>마지막 실패: <span class="font-mono">{formatDevDateTime(fcmStatus.lastFailedAt)}</span></p>
					<p class="break-all">마지막 오류: <span class="font-mono">{fcmStatus.lastErrorMessage || '없음'}</span></p>
					<p>활성 토큰 수: <span class="font-mono">{activeFcmTokenCount}개</span></p>
					<p class="flex items-center gap-2">
						클라이언트 ↔ 서버 Project ID 비교:
						{#if projectIdComparison === 'match'}
							<span class="rounded bg-green-500/15 px-2 py-0.5 text-green-600">일치</span>
						{:else if projectIdComparison === 'mismatch'}
							<span class="rounded bg-orange-500/15 px-2 py-0.5 text-orange-600">불일치</span>
						{:else}
							<span class="rounded bg-gray-500/15 px-2 py-0.5 text-muted-foreground">판별 불가</span>
						{/if}
					</p>
					{#if serverProjectId}
						<p>서버 오류 기준 Project ID: <span class="font-mono">{serverProjectId}</span></p>
					{/if}
					{#if fcmStatus.notificationLogs.length > 0}
						<div class="space-y-1 border-t border-border/50 pt-2">
							<p class="font-semibold">최근 10건 notification_logs</p>
							<div class="max-h-40 space-y-2 overflow-y-auto">
								{#each fcmStatus.notificationLogs as log}
									<div class="flex items-start gap-2">
										{#if log.status === 'success'}<CheckCircle class="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />{:else}<XCircle class="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500" />{/if}
										<div class="min-w-0 space-y-0.5">
											<p class="font-mono">{formatDevDateTime(log.sent_at)}</p>
											<p class="text-muted-foreground">{log.status}</p>
											{#if log.error_message}<p class="break-all font-mono">{log.error_message}</p>{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				<div class="text-xs space-y-2 p-2 rounded bg-muted">
					<p class="font-semibold flex items-center gap-2">
						FCM 프로젝트 마커
						{#if fcmCutoverSuccess}<span class="rounded bg-green-500/15 px-2 py-0.5 text-green-600">cutover 완료</span>
						{:else if activeFcmTokenCount === 0}<span class="rounded bg-gray-500/15 px-2 py-0.5 text-muted-foreground">토큰 없음</span>
						{:else}<span class="rounded bg-orange-500/15 px-2 py-0.5 text-orange-600">확인 필요</span>{/if}
					</p>
					<p>현재 마커: <span class="font-mono">{projectMarkerState.current ?? '—'}</span></p>
					<p>저장된 마커: <span class="font-mono">{projectMarkerState.stored ?? '미저장'}</span></p>
					<p>재등록 필요: {#if projectMarkerState.mismatch}<span class="text-orange-500 font-semibold">예 (마커 불일치)</span>{:else if projectMarkerState.stored === null}<span class="text-muted-foreground">최초 등록 대기</span>{:else}<span class="text-green-600">아니오</span>{/if}</p>
					{#if senderMismatchLogs.length > 0}
						<div class="space-y-1 border-t border-border/50 pt-2">
							<p class="font-semibold text-orange-600">SENDER_ID_MISMATCH 로그 ({senderMismatchLogs.length}건)</p>
							<div class="max-h-24 space-y-1 overflow-y-auto">
								{#each senderMismatchLogs as log}<p class="font-mono break-all">{formatDevDateTime(log.sent_at)} — {log.error_message}</p>{/each}
							</div>
						</div>
					{/if}
				</div>
				{#if projectIdComparison === 'mismatch'}
					<div class="space-y-1 rounded bg-orange-500/10 p-2 text-xs text-orange-700">
						<p class="font-semibold">프로젝트 불일치 경고</p>
						<p>클라이언트 env와 서버 오류에 남은 Project ID가 다릅니다. 서버 서비스 계정이 다른 Firebase 프로젝트를 가리키고 있을 수 있습니다.</p>
					</div>
				{/if}
				{#if fcmStatus.lastErrorMessage?.startsWith('[PERMISSION_DENIED]')}
					<div class="space-y-1 rounded bg-blue-500/10 p-2 text-xs text-blue-700">
						<p class="font-semibold">서버 권한 오류</p>
						<p>클라이언트 key 문제가 아니라 `send-notifications` 서비스 계정 권한 부족 가능성이 큽니다.</p>
					</div>
				{/if}
				{#if notificationLogsPermissionIssue}
					<div class="space-y-1 rounded bg-yellow-500/10 p-2 text-xs text-yellow-700">
						<p class="font-semibold">notification_logs 조회 권한 확인 필요</p>
						<p>RLS나 인증 컨텍스트 문제로 최근 서버 발송 로그를 읽지 못하고 있습니다.</p>
					</div>
				{/if}
				{#if authStore.isAuthenticated}
					<Button variant="default" size="sm" onclick={manualRegisterFCM} disabled={fcmRegistering} class="w-full">
						{fcmRegistering ? 'FCM 토큰 등록 중...' : 'FCM 토큰 수동 등록'}
					</Button>
				{/if}
				{#if fcmStatus.error}<p class="text-xs text-red-500">{fcmStatus.error}</p>{/if}
			{/if}
		</div>

		<!-- 앱 내 로그 뷰어 -->
		<div class="space-y-2 pt-2 border-t border-border">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold flex items-center gap-2">
					<FileText class="w-4 h-4" /> 알림 로그 뷰어
					<span class="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">{devLogStore.logs.length}개</span>
				</h3>
				<div class="flex gap-2">
					<button onclick={() => showLogViewer = !showLogViewer} class="text-xs text-primary hover:underline">{showLogViewer ? '접기' : '펼치기'}</button>
					<button onclick={() => devLogStore.clear()} class="text-xs text-red-500 hover:underline">지우기</button>
				</div>
			</div>
			{#if showLogViewer}
				<div class="flex gap-1">
					{#each [['all', '전체'], ['Notification', 'Notification'], ['SW', 'SW']] as [val, label]}
						<button onclick={() => logFilter = val as typeof logFilter} class={cn('text-xs px-2 py-1 rounded', logFilter === val ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{label}</button>
					{/each}
				</div>
				<div class="text-xs font-mono bg-black text-green-400 p-3 rounded-lg max-h-80 overflow-y-auto space-y-1">
					{#if filteredLogs.length === 0}
						<p class="text-gray-500">로그가 없습니다.</p>
					{:else}
						{#each filteredLogs.slice().reverse() as log}
							<div class={cn('border-b border-gray-800 pb-1', log.level === 'error' && 'text-red-400', log.level === 'warn' && 'text-yellow-400', log.level === 'debug' && 'text-gray-500')}>
								<span class="text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
								<span class="text-blue-400">[{log.source}]</span>
								{log.message}
								{#if log.data}<span class="text-gray-500">{JSON.stringify(log.data)}</span>{/if}
							</div>
						{/each}
					{/if}
				</div>
				<div class="text-xs text-muted-foreground">* 로그는 앱이 실행 중일 때만 기록됩니다. 백그라운드 SW 로그는 브라우저 개발자 도구에서 확인하세요.</div>
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
</SubPageShell>
