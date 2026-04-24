<script lang="ts">
	import { goto } from '$app/navigation';
	import SubPageShell from '$lib/components/settings/SubPageShell.svelte';
	import DevCapacitorBackgroundNotificationSection from '$lib/components/settings/dev/DevCapacitorBackgroundNotificationSection.svelte';
	import DevDebugInfoSection from '$lib/components/settings/dev/DevDebugInfoSection.svelte';
	import DevFcmStatusSection from '$lib/components/settings/dev/DevFcmStatusSection.svelte';
	import DevLogViewerSection from '$lib/components/settings/dev/DevLogViewerSection.svelte';
	import DevNotificationBasicsSection from '$lib/components/settings/dev/DevNotificationBasicsSection.svelte';
	import DevSwMemoScheduleSection from '$lib/components/settings/dev/DevSwMemoScheduleSection.svelte';
	import DevWebServiceWorkerNotificationSection from '$lib/components/settings/dev/DevWebServiceWorkerNotificationSection.svelte';
	import { Bug } from 'lucide-svelte';

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

		<DevNotificationBasicsSection />
		<DevCapacitorBackgroundNotificationSection />
		<DevWebServiceWorkerNotificationSection />
		<DevSwMemoScheduleSection />
		<DevFcmStatusSection />
		<DevLogViewerSection />
		<DevDebugInfoSection />
	</div>
</SubPageShell>

