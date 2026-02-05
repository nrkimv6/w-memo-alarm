<script lang="ts">
	import { Folder, Plus, Check } from 'lucide-svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		selectedFolderId?: string;
		onSelect: (folderId: string | undefined) => void;
	}

	let { selectedFolderId, onSelect }: Props = $props();

	let showDropdown = $state(false);
	let showNewFolder = $state(false);
	let newFolderName = $state('');
	let newFolderColor = $state(foldersStore.DEFAULT_COLORS[0]);

	const folders = $derived(foldersStore.getSorted());
	const selectedFolder = $derived(selectedFolderId ? foldersStore.getById(selectedFolderId) : null);

	function handleSelect(folderId: string | undefined) {
		onSelect(folderId);
		showDropdown = false;
	}

	async function handleAddFolder() {
		if (!newFolderName.trim()) return;
		const folder = await foldersStore.add(newFolderName.trim(), newFolderColor);
		if (folder) {
			onSelect(folder.id);
		}
		newFolderName = '';
		showNewFolder = false;
		showDropdown = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAddFolder();
		} else if (e.key === 'Escape') {
			showNewFolder = false;
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => showDropdown = !showDropdown}
		class={cn(
			'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors w-full',
			'border-border hover:border-foreground/30 bg-background'
		)}
	>
		{#if selectedFolder}
			<span
				class="w-3 h-3 rounded-full"
				style="background-color: {selectedFolder.color}"
			></span>
			<span class="flex-1 text-left truncate">{selectedFolder.name}</span>
		{:else}
			<Folder class="w-4 h-4 text-muted-foreground" />
			<span class="flex-1 text-left text-muted-foreground">폴더 선택</span>
		{/if}
	</button>

	{#if showDropdown}
		<div class="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			<!-- No folder option -->
			<button
				type="button"
				onclick={() => handleSelect(undefined)}
				class={cn(
					'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
					!selectedFolderId && 'bg-muted'
				)}
			>
				<span class="w-3 h-3 rounded-full border border-dashed border-muted-foreground"></span>
				<span class="flex-1">폴더 없음</span>
				{#if !selectedFolderId}
					<Check class="w-4 h-4 text-primary" />
				{/if}
			</button>

			<!-- Folder list -->
			{#each folders as folder}
				<button
					type="button"
					onclick={() => handleSelect(folder.id)}
					class={cn(
						'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors',
						selectedFolderId === folder.id && 'bg-muted'
					)}
				>
					<span
						class="w-3 h-3 rounded-full"
						style="background-color: {folder.color}"
					></span>
					<span class="flex-1 truncate">{folder.name}</span>
					{#if selectedFolderId === folder.id}
						<Check class="w-4 h-4 text-primary" />
					{/if}
				</button>
			{/each}

			<!-- Add new folder -->
			{#if showNewFolder}
				<div class="p-2 border-t border-border">
					<div class="flex gap-2 mb-2">
						{#each foldersStore.DEFAULT_COLORS as color}
							<button
								type="button"
								onclick={() => newFolderColor = color}
								aria-label="폴더 색상 선택"
								class={cn(
									'w-5 h-5 rounded-full transition-transform',
									newFolderColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
								)}
								style="background-color: {color}"
							></button>
						{/each}
					</div>
					<div class="flex gap-2">
						<input
							type="text"
							placeholder="폴더 이름"
							bind:value={newFolderName}
							onkeydown={handleKeydown}
							class="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
						/>
						<button
							type="button"
							onclick={handleAddFolder}
							disabled={!newFolderName.trim()}
							class="px-2 py-1 text-sm bg-primary text-primary-foreground rounded disabled:opacity-50"
						>
							추가
						</button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => showNewFolder = true}
					class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border-t border-border"
				>
					<Plus class="w-4 h-4" />
					<span>새 폴더 추가</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if showDropdown}
	<button
		type="button"
		class="fixed inset-0 z-40"
		onclick={() => { showDropdown = false; showNewFolder = false; }}
		aria-label="닫기"
	></button>
{/if}
