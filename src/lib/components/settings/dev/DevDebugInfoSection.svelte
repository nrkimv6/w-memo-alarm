<script lang="ts">
	import { browser } from '$app/environment';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { isNative } from '$lib/utils/capacitor';

	let isNativePlatform = $state(false);

	$effect(() => {
		if (!browser) return;
		isNative().then((native) => {
			isNativePlatform = native;
		});
	});
</script>

<!-- 디버그 정보 -->
<div class="space-y-2 pt-2 border-t border-border">
	<h3 class="text-sm font-semibold">디버그 정보</h3>
	<div class="text-xs font-mono bg-muted p-3 rounded-lg space-y-1">
		<p>알림 스토어 초기화: {notificationStore.initialized ? '완료' : '미완료'}</p>
		<p>오늘 알림 개수: {notificationStore.getTodayReminders().length}</p>
		<p>예정된 알림: {notificationStore.getUpcomingReminders().length}</p>
		<p>완료된 알림: {notificationStore.getPastReminders().length}</p>
		<p>스누즈된 알림: {notificationStore.snoozedReminders.length}</p>
		<p>Service Worker: {browser && 'serviceWorker' in navigator ? '지원됨' : '미지원'}</p>
		<p>Notification API: {browser && 'Notification' in window ? '지원됨' : '미지원'}</p>
		<p>Capacitor 네이티브: {isNativePlatform ? '예' : '아니오'}</p>
	</div>
</div>
