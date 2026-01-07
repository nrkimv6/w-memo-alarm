<script lang="ts">
	import { Folder, ChevronDown, ChevronUp, Settings, Trash2 } from 'lucide-svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { filterStore } from '$lib/stores/filter.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { cn } from '$lib/utils';

	let showManage = $state(false);
	let editingId = $state<string | null>(null);
	let editingName = $state('');

	const folders = $derived(foldersStore.getSorted());
	const selectedFolderId = $derived(filterStore.selectedFolderId);

	function getMemoCount(folderId: string | null): number {
		return memosStore.memos.filter(m =>
			m.isActive !== false &&
			(folderId === null ? !m.folderId : m.folderId === folderId)
		).length;
	}

	function handleSelect(folderId: string | null) {
		filterStore.setFolderId(folderId);
	}

	function startEdit(id: string, name: string) {
		editingId = id;
		editingName = name;
	}

	function saveEdit() {
		if (editingId && editingName.trim()) {
			foldersStore.update(editingId, { name: editingName.trim() });
		}
		editingId = null;
		editingName = '';
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveEdit();
		} else if (e.key === 'Escape') {
			editingId = null;
		}
	}

	function handleDelete(id: string) {
		// Move memos to no folder
		memosStore.memos
			.filter(m => m.folderId === id)
			.forEach(m => memosStore.setFolder(m.id, undefined));

		foldersStore.remove(id);

		if (selectedFolderId === id) {
			filterStore.setFolderId(null);
		}
	}
</script>

<div class="space-y-2">
	<!-- Folder tabs -->
	<div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
		<!-- All memos -->
		<button
			onclick={() => handleSelect(null)}
			class={cn(
				'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
				selectedFolderId === null
					? 'bg-primary text-primary-foreground'
					: 'bg-muted hover:bg-muted/80 text-muted-foreground'
			)}
		>
			<Folder class="w-3.5 h-3.5" />
			<span>전체</span>
			<span class="text-xs opacity-70">({memosStore.memos.filter(m => m.isActive !== false).length})</span>
		</button>

		<!-- Folder tabs -->
		{#each folders as folder}
			<button
				onclick={() => handleSelect(folder.id)}
				class={cn(
					'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
					selectedFolderId === folder.id
						? 'text-white'
						: 'bg-muted hover:bg-muted/80 text-muted-foreground'
				)}
				style={selectedFolderId === folder.id ? `background-color: ${folder.color}` : undefined}
			>
				<span
					class="w-2.5 h-2.5 rounded-full"
					style="background-color: {folder.color}"
				></span>
				<span>{folder.name}</span>
				<span class="text-xs opacity-70">({getMemoCount(folder.id)})</span>
			</button>
		{/each}

		<!-- Manage button -->
		{#if folders.length > 0}
			<button
				onclick={() => showManage = !showManage}
				class="flex items-center gap-1 px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
				title="폴더 관리"
			>
				<Settings class="w-4 h-4" />
				{#if showManage}
					<ChevronUp class="w-3 h-3" />
				{:else}
					<ChevronDown class="w-3 h-3" />
				{/if}
			</button>
		{/if}
	</div>

	<!-- Folder management -->
	{#if showManage && folders.length > 0}
		<div class="bg-muted/50 rounded-lg p-3 space-y-2">
			<div class="text-xs font-medium text-muted-foreground mb-2">폴더 관리</div>
			{#each folders as folder}
				<div class="flex items-center gap-2">
					<span
						class="w-3 h-3 rounded-full flex-shrink-0"
						style="background-color: {folder.color}"
					></span>

					{#if editingId === folder.id}
						<input
							type="text"
							bind:value={editingName}
							onkeydown={handleEditKeydown}
							onblur={saveEdit}
							class="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
						/>
					{:else}
						<button
							onclick={() => startEdit(folder.id, folder.name)}
							class="flex-1 text-left text-sm hover:text-primary transition-colors"
						>
							{folder.name}
						</button>
					{/if}

					<span class="text-xs text-muted-foreground">
						{getMemoCount(folder.id)}개
					</span>

					<button
						onclick={() => handleDelete(folder.id)}
						class="p-1 text-muted-foreground hover:text-destructive transition-colors"
						title="삭제"
					>
						<Trash2 class="w-3.5 h-3.5" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
