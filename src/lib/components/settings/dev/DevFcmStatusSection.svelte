<script lang="ts">
	import { browser } from '$app/environment';
	import Button from '$lib/components/ui/Button.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { supabase } from '$lib/services/supabase';
	import { registerFCMToken, getFCMConfigStatus, detectProjectMarkerMismatch } from '$lib/fcm';
	import { CheckCircle, Radio, XCircle } from 'lucide-svelte';

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
		if (!browser) return { mismatch: false, stored: null as string | null, current: null as string | null };
		const { mismatch, stored, current } = detectProjectMarkerMismatch();
		return { mismatch, stored, current };
	});

	const senderMismatchLogs = $derived.by(() => {
		return fcmStatus.notificationLogs.filter((log) => log.error_message?.includes('[SENDER_ID_MISMATCH@'));
	});

	const recentHasSenderMismatch = $derived.by(() => senderMismatchLogs.length > 0);

	const recentHasPermissionDenied = $derived.by(() =>
		fcmStatus.notificationLogs.some((log) => log.error_message?.includes('[PERMISSION_DENIED]'))
	);

	const fcmCutoverSuccess = $derived.by(() => {
		return activeFcmTokenCount >= 1 && !recentHasSenderMismatch && !recentHasPermissionDenied;
	});

	$effect(() => {
		if (!browser) return;
		checkFCMStatus();
	});

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
					fcmStatus.fcmToken = activeDevice?.fcm_token ? activeDevice.fcm_token.substring(0, 20) + '...' : null;
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
					fcmStatus.error = /permission denied|forbidden|not allowed|rls/i.test(notificationLogsError.message)
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
</script>

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
			<p class="flex items-center gap-1">
				Firebase API Key:
				{#if fcmStatus.hasApiKey}
					<CheckCircle class="w-3 h-3 text-green-500" /><span class="text-green-500">설정됨</span>
				{:else}
					<XCircle class="w-3 h-3 text-red-500" /><span class="text-red-500">미설정</span>
				{/if}
			</p>
			<p class="flex items-center gap-1">
				VAPID Key:
				{#if fcmStatus.hasVapidKey}
					<CheckCircle class="w-3 h-3 text-green-500" /><span class="text-green-500">설정됨</span>
				{:else}
					<XCircle class="w-3 h-3 text-red-500" /><span class="text-red-500">미설정</span>
				{/if}
			</p>
			<p>Project ID: <span class="font-mono">{fcmStatus.projectId || 'N/A'}</span></p>
			<p>Env Project ID: <span class="font-mono">{fcmStatus.envProjectId || 'N/A'}</span></p>
			<p>Messaging Sender ID: <span class="font-mono">{fcmStatus.messagingSenderId || 'N/A'}</span></p>
		</div>
		<div class="text-xs space-y-1 p-2 rounded bg-muted">
			<p class="font-semibold mb-1">인증 상태:</p>
			<p class="flex items-center gap-1">
				로그인:
				{#if authStore.isAuthenticated}
					<CheckCircle class="w-3 h-3 text-green-500" /><span class="text-green-500">{authStore.user?.email || authStore.user?.id?.substring(0, 8)}</span>
				{:else}
					<XCircle class="w-3 h-3 text-yellow-500" /><span class="text-yellow-500">미로그인</span>
				{/if}
			</p>
		</div>
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
		<div class="text-xs space-y-2 p-2 rounded bg-muted">
			<p class="font-semibold">서버측 FCM 상태</p>
			<p>마지막 성공: <span class="font-mono">{formatDevDateTime(fcmStatus.lastSuccessAt)}</span></p>
			<p>마지막 실패: <span class="font-mono">{formatDevDateTime(fcmStatus.lastFailedAt)}</span></p>
			<p class="break-all">마지막 오류: <span class="font-mono">{fcmStatus.lastErrorMessage || '없음'}</span></p>
			<p>활성 토큰 수: <span class="font-mono">{activeFcmTokenCount}</span></p>
			<p>FCM cutover 성공: {#if fcmCutoverSuccess}<span class="text-green-600">예</span>{:else}<span class="text-red-600">아니오</span>{/if}</p>
			<p class="mt-1">
				FCM 프로젝트 마커:
				{#if projectMarkerState.mismatch}
					<span class="text-red-600">불일치</span>
				{:else}
					<span class="text-green-600">일치</span>
				{/if}
			</p>
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

