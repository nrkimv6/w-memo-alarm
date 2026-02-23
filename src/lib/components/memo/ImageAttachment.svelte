<script lang="ts">
	import { X, ImagePlus, Clipboard } from 'lucide-svelte';

	interface Props {
		images: string[];
		onImagesChange: (images: string[]) => void;
		readonly?: boolean;
	}

	let { images = [], onImagesChange, readonly = false }: Props = $props();

	let fileInput: HTMLInputElement;
	let isDragging = $state(false);
	let lightboxIndex = $state<number | null>(null);

	// 이미지 압축: 최대 800px, JPEG quality 0.75
	async function compressImage(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const MAX = 800;
					let { width, height } = img;
					if (width > MAX || height > MAX) {
						if (width > height) {
							height = Math.round((height * MAX) / width);
							width = MAX;
						} else {
							width = Math.round((width * MAX) / height);
							height = MAX;
						}
					}
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					if (!ctx) { reject(new Error('canvas context unavailable')); return; }
					ctx.drawImage(img, 0, 0, width, height);
					resolve(canvas.toDataURL('image/jpeg', 0.75));
				};
				img.onerror = reject;
				img.src = e.target?.result as string;
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleFiles(files: FileList | File[]) {
		const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
		if (!arr.length) return;
		const compressed = await Promise.all(arr.map(compressImage));
		onImagesChange([...images, ...compressed]);
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) handleFiles(input.files);
		input.value = '';
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
	}

	async function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		const imageFiles: File[] = [];
		for (const item of Array.from(items)) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}
		if (imageFiles.length) {
			e.preventDefault();
			await handleFiles(imageFiles);
		}
	}

	function removeImage(index: number) {
		const next = images.filter((_, i) => i !== index);
		onImagesChange(next);
		if (lightboxIndex !== null) {
			if (lightboxIndex >= next.length) lightboxIndex = next.length - 1;
			if (next.length === 0) lightboxIndex = null;
		}
	}

	function openLightbox(index: number) {
		lightboxIndex = index;
	}

	function closeLightbox() {
		lightboxIndex = null;
	}

	function prevImage() {
		if (lightboxIndex !== null && lightboxIndex > 0) lightboxIndex--;
	}

	function nextImage() {
		if (lightboxIndex !== null && lightboxIndex < images.length - 1) lightboxIndex++;
	}

	function handleLightboxKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeLightbox();
		if (e.key === 'ArrowLeft') prevImage();
		if (e.key === 'ArrowRight') nextImage();
	}
</script>

<svelte:window on:paste={readonly ? undefined : handlePaste} on:keydown={lightboxIndex !== null ? handleLightboxKeydown : undefined} />

<div class="space-y-2">
	<!-- 이미지 그리드 -->
	{#if images.length > 0}
		<div class="grid grid-cols-3 gap-2">
			{#each images as src, i}
				<div class="relative group aspect-square">
					<button
						type="button"
						class="w-full h-full rounded-lg overflow-hidden border border-border focus:outline-none focus:ring-2 focus:ring-primary"
						onclick={() => openLightbox(i)}
					>
						<img
							{src}
							alt={`첨부 이미지 ${i + 1}`}
							class="w-full h-full object-cover"
						/>
					</button>
					{#if !readonly}
						<button
							type="button"
							onclick={() => removeImage(i)}
							class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
							title="이미지 제거"
						>
							<X class="w-3 h-3" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- 업로드 영역 -->
	{#if !readonly}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex items-center gap-3"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			{#if isDragging}
				<div class="flex-1 border-2 border-dashed border-primary rounded-lg p-4 text-center text-sm text-primary">
					이미지를 놓으세요
				</div>
			{:else}
				<button
					type="button"
					onclick={() => fileInput.click()}
					class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<ImagePlus class="w-4 h-4" />
					이미지 추가
				</button>
				<span class="text-xs text-muted-foreground/50">또는 붙여넣기 (Ctrl+V)</span>
			{/if}
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			class="hidden"
			onchange={handleFileInput}
		/>
	{/if}
</div>

<!-- 라이트박스 -->
{#if lightboxIndex !== null && images[lightboxIndex]}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
		onclick={closeLightbox}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative max-w-[90vw] max-h-[90vh]"
			onclick={(e) => e.stopPropagation()}
		>
			<img
				src={images[lightboxIndex]}
				alt={`첨부 이미지 ${lightboxIndex + 1}`}
				class="max-w-full max-h-[85vh] object-contain rounded-lg"
			/>
			<!-- 닫기 -->
			<button
				type="button"
				onclick={closeLightbox}
				class="absolute -top-3 -right-3 w-8 h-8 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center transition-colors"
			>
				<X class="w-4 h-4" />
			</button>
			<!-- 이전/다음 -->
			{#if images.length > 1}
				<div class="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
					<button
						type="button"
						onclick={prevImage}
						disabled={lightboxIndex === 0}
						class="px-3 py-1 bg-white/20 hover:bg-white/40 text-white rounded-full text-sm transition-colors disabled:opacity-30"
					>
						‹
					</button>
					<span class="px-3 py-1 bg-white/10 text-white rounded-full text-sm">
						{lightboxIndex + 1} / {images.length}
					</span>
					<button
						type="button"
						onclick={nextImage}
						disabled={lightboxIndex === images.length - 1}
						class="px-3 py-1 bg-white/20 hover:bg-white/40 text-white rounded-full text-sm transition-colors disabled:opacity-30"
					>
						›
					</button>
				</div>
			{/if}
			{#if !readonly}
				<button
					type="button"
					onclick={() => { if (lightboxIndex !== null) removeImage(lightboxIndex); }}
					class="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-destructive/80 hover:bg-destructive text-white rounded text-xs transition-colors"
				>
					<X class="w-3 h-3" />
					삭제
				</button>
			{/if}
		</div>
	</div>
{/if}
