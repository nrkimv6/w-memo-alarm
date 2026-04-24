<script lang="ts">
	import SubPageShell from '$lib/components/settings/SubPageShell.svelte';
	import AlarmManager from '$lib/components/settings/AlarmManager.svelte';
</script>

<SubPageShell
	title="알림 관리"
	eyebrow="알림"
	description="메모별 알림을 시간대별로 관리합니다."
>
	<div class="settings-surface-card overflow-hidden">
		<AlarmManager />
	</div>
	<p class="pb-6 text-center text-[11px] text-muted-foreground">
		메모 잠금이 설정된 경우 알림 클릭 시 PIN 입력이 필요합니다.
	</p>
</SubPageShell>
