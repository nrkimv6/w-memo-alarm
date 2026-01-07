<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center bg-background px-4">
	<div class="text-center space-y-4">
		<div class="text-6xl font-bold text-primary">{$page.status}</div>
		<h1 class="text-2xl font-semibold text-foreground">
			{#if $page.status === 404}
				페이지를 찾을 수 없습니다
			{:else if $page.status === 500}
				서버 오류가 발생했습니다
			{:else}
				오류가 발생했습니다
			{/if}
		</h1>
		<p class="text-muted-foreground">
			{$page.error?.message || '요청을 처리할 수 없습니다.'}
		</p>
		<a
			href="/"
			class="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
		>
			홈으로 돌아가기
		</a>
	</div>
</div>
