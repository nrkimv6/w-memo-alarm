<script lang="ts">
	import { WifiOff, RefreshCw, AlertTriangle, Cloud, CloudOff } from 'lucide-svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { networkStatus } from '$lib/services/networkStatus.svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	const isOnline = $derived(networkStatus.isOnline);
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const syncingFromServer = $derived(memosStore.syncingFromServer);
	const pendingCount = $derived(memosStore.pendingCount);
	const failedCount = $derived(memosStore.failedCount);
	const localOnlyCount = $derived(memosStore.localOnlyCount);

	// 배너를 보여줄 조건
	const showBanner = $derived(
		isAuthenticated && (!isOnline || syncingFromServer || pendingCount > 0 || failedCount > 0 || localOnlyCount > 0)
	);
</script>

{#if showBanner}
	<div class="fixed left-0 right-0 z-40 px-4 pb-2 pointer-events-none" style="bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">
		<div class="max-w-md mx-auto pointer-events-auto">
			{#if !isOnline}
				<!-- 오프라인 상태 -->
				<div class="flex items-center gap-2 px-4 py-2 bg-amber-500/90 text-white rounded-full shadow-lg text-sm backdrop-blur-sm">
					<WifiOff class="w-4 h-4 flex-shrink-0" />
					<span class="flex-1">오프라인 모드 - 변경사항은 로컬에 저장됩니다</span>
				</div>
			{:else if failedCount > 0}
				<!-- 동기화 실패 -->
				<div class="flex items-center gap-2 px-4 py-2 bg-destructive/90 text-white rounded-full shadow-lg text-sm backdrop-blur-sm">
					<AlertTriangle class="w-4 h-4 flex-shrink-0" />
					<span class="flex-1">{failedCount}개 메모 동기화 실패</span>
				</div>
			{:else if syncingFromServer}
				<!-- 서버에서 동기화 중 -->
				<div class="flex items-center gap-2 px-4 py-2 bg-primary/90 text-white rounded-full shadow-lg text-sm backdrop-blur-sm">
					<RefreshCw class="w-4 h-4 flex-shrink-0 animate-spin" />
					<span class="flex-1">서버에서 메모 동기화 중...</span>
				</div>
			{:else if pendingCount > 0}
				<!-- 서버로 동기화 중 -->
				<div class="flex items-center gap-2 px-4 py-2 bg-amber-500/90 text-white rounded-full shadow-lg text-sm backdrop-blur-sm">
					<RefreshCw class="w-4 h-4 flex-shrink-0 animate-spin" />
					<span class="flex-1">{pendingCount}개 메모 동기화 중...</span>
				</div>
			{:else if localOnlyCount > 0}
				<!-- 로컬 전용 메모 있음 (서버 확인 전) -->
				<div class="flex items-center gap-2 px-4 py-2 bg-blue-500/90 text-white rounded-full shadow-lg text-sm backdrop-blur-sm">
					<CloudOff class="w-4 h-4 flex-shrink-0" />
					<span class="flex-1">로컬 캐시에서 로드됨 - 동기화 확인 중</span>
				</div>
			{/if}
		</div>
	</div>
{/if}
