<script lang="ts">
	import { Pin, Trash2 } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		onSwipeLeft?: () => void;
		onSwipeRight?: () => void;
		children: Snippet;
	}

	let { onSwipeLeft, onSwipeRight, children }: Props = $props();

	let startX = $state(0);
	let startY = $state(0);
	let currentX = $state(0);
	let isDragging = $state(false);
	let directionLocked: 'none' | 'horizontal' | 'vertical' = 'none';
	let containerElement: HTMLDivElement;

	const SWIPE_THRESHOLD = 80; // 스와이프 감지 임계값 (px)
	const MAX_DRAG = 150; // 최대 드래그 거리

	function handleTouchStart(e: TouchEvent) {
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		isDragging = true;
		directionLocked = 'none';
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;

		const deltaX = e.touches[0].clientX - startX;
		const deltaY = e.touches[0].clientY - startY;

		// 방향 미결정 시: 10px 이상 이동하면 우세 방향으로 잠금
		if (directionLocked === 'none') {
			if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
				directionLocked = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
			}
			return;
		}

		// 수직 스크롤로 잠긴 경우 스와이프 완전 무시
		if (directionLocked === 'vertical') return;

		// 수평 스와이프: 스크롤 방지 + currentX 갱신
		e.preventDefault();
		currentX = deltaX;

		// 최대 드래그 거리 제한
		if (Math.abs(currentX) > MAX_DRAG) {
			currentX = currentX > 0 ? MAX_DRAG : -MAX_DRAG;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;

		// 왼쪽 스와이프 (삭제)
		if (currentX < -SWIPE_THRESHOLD && onSwipeLeft) {
			onSwipeLeft();
		}
		// 오른쪽 스와이프 (핀 고정)
		else if (currentX > SWIPE_THRESHOLD && onSwipeRight) {
			onSwipeRight();
		}

		// 초기화
		isDragging = false;
		currentX = 0;
		startX = 0;
		directionLocked = 'none';
	}

	const translateX = $derived(isDragging ? currentX : 0);
	const showLeftAction = $derived(currentX < -20); // 왼쪽으로 20px 이상 드래그
	const showRightAction = $derived(currentX > 20); // 오른쪽으로 20px 이상 드래그
	const leftOpacity = $derived(Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1));
	const rightOpacity = $derived(Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1));
</script>

<div
	class="relative pt-3"
	style="touch-action: pan-y;"
	bind:this={containerElement}
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<!-- 왼쪽 액션 (삭제) -->
	{#if showLeftAction}
		<div
			class="absolute inset-x-0 top-3 bottom-0 bg-destructive flex items-center justify-end px-6 z-0 rounded-xl"
			style="opacity: {leftOpacity}"
		>
			<Trash2 class="w-6 h-6 text-white" />
		</div>
	{/if}

	<!-- 오른쪽 액션 (핀 고정) -->
	{#if showRightAction}
		<div
			class="absolute inset-x-0 top-3 bottom-0 bg-secondary flex items-center justify-start px-6 z-0 rounded-xl"
			style="opacity: {rightOpacity}"
		>
			<Pin class="w-6 h-6 text-white" />
		</div>
	{/if}

	<!-- 카드 내용 -->
	<div
		class="relative z-10 transition-transform"
		style="transform: translateX({translateX}px); transition-duration: {isDragging ? '0ms' : '200ms'};"
	>
		{@render children()}
	</div>
</div>
