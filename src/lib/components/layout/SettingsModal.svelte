<script lang="ts">
	import { Download, Upload, Trash2, Sun, Moon, Monitor } from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { downloadExport, importMemos } from '$lib/utils/data';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let importError = $state('');

	const memoCount = $derived(memosStore.memos.length);

	function handleExport() {
		downloadExport(memosStore.memos);
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importing = true;
		importError = '';

		try {
			const memos = await importMemos(file);
			memosStore.importMemos(memos, false);
			alert(`${memos.length}개의 메모를 가져왔습니다.`);
		} catch (err) {
			importError = (err as Error).message;
		} finally {
			importing = false;
			input.value = '';
		}
	}

	function handleClearAll() {
		if (confirm('모든 메모를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			memosStore.clearAll();
			onClose();
		}
	}
</script>

<Modal bind:open title="설정">
	<div class="space-y-6">
		<!-- 테마 -->
		<div class="space-y-3">
			<h3 class="text-sm font-medium">테마</h3>
			<div class="flex gap-2">
				<button
					onclick={() => themeStore.setTheme('light')}
					class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors {themeStore.theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}"
				>
					<Sun class="w-5 h-5" />
					<span class="text-xs">라이트</span>
				</button>
				<button
					onclick={() => themeStore.setTheme('dark')}
					class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors {themeStore.theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}"
				>
					<Moon class="w-5 h-5" />
					<span class="text-xs">다크</span>
				</button>
				<button
					onclick={() => themeStore.setTheme('system')}
					class="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors {themeStore.theme === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}"
				>
					<Monitor class="w-5 h-5" />
					<span class="text-xs">시스템</span>
				</button>
			</div>
		</div>

		<!-- 데이터 관리 -->
		<div class="space-y-3">
			<h3 class="text-sm font-medium">데이터 관리</h3>
			<p class="text-xs text-muted-foreground">현재 {memoCount}개의 메모가 저장되어 있습니다.</p>

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

		<!-- 위험 영역 -->
		<div class="space-y-3 pt-4 border-t border-border">
			<h3 class="text-sm font-medium text-destructive">위험 영역</h3>
			<Button variant="destructive" onclick={handleClearAll} class="w-full justify-start">
				<Trash2 class="w-4 h-4" />
				모든 메모 삭제
			</Button>
		</div>
	</div>

	{#snippet footer()}
		<Button onclick={onClose}>닫기</Button>
	{/snippet}
</Modal>
