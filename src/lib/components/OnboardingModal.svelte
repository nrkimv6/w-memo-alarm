<script lang="ts">
	import { onMount } from 'svelte';
	import { X, Check, BookOpen, Bell, Star, Keyboard } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let currentStep = $state(0);
	let dialogRef: HTMLDialogElement;

	const steps = [
		{
			icon: BookOpen,
			title: '메모 알람에 오신 것을 환영합니다!',
			description:
				'간단한 메모와 북마크를 관리하고, 알림을 설정할 수 있는 앱입니다.\n3개의 샘플 메모가 추가되었습니다.',
			features: ['📝 메모와 체크리스트 작성', '🔗 북마크 관리', '🔔 알림 설정', '📁 폴더로 정리']
		},
		{
			icon: Bell,
			title: '알림 설정하기',
			description: '메모를 편집하여 알림을 설정할 수 있습니다.',
			features: [
				'특정 날짜/시간에 1회 알림',
				'매일 또는 특정 요일 반복 알림',
				'기본 알림 시간 설정 가능',
				'빠른 입력으로 자동 알림 적용'
			]
		},
		{
			icon: Keyboard,
			title: '키보드 단축키',
			description: '키보드만으로도 빠르게 사용할 수 있습니다.',
			features: [
				'N: 새 메모 만들기',
				'/: 검색 포커스',
				'Esc: 모달 닫기',
				'Ctrl+S: 저장'
			]
		},
		{
			icon: Star,
			title: '준비 완료!',
			description: '이제 메모 알람을 사용할 준비가 되었습니다.\n샘플 메모를 확인하고 편집해보세요!',
			features: [
				'👈 샘플 메모 3개가 추가되었습니다',
				'✨ 메모를 편집하여 나만의 내용으로 변경하세요',
				'🗑️ 필요없는 메모는 삭제할 수 있습니다'
			]
		}
	];
	const step = $derived(steps[currentStep]);

	function next() {
		if (currentStep < steps.length - 1) {
			currentStep++;
		} else {
			onClose();
		}
	}

	function prev() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	function skip() {
		onClose();
	}

	onMount(() => {
		dialogRef.showModal();
		return () => {
			dialogRef.close();
		};
	});
</script>

<dialog
	bind:this={dialogRef}
	class="fixed inset-0 z-50 m-0 h-dvh w-dvw max-h-dvh max-w-full bg-black/60 backdrop-blur-sm p-0"
	onclick={(e) => {
		if (e.target === dialogRef) skip();
	}}
>
	<div
		class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
	>
		<!-- Header -->
		<div class="relative px-6 py-4 border-b dark:border-gray-700">
			<button
				onclick={skip}
				class="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
			>
				<X class="w-5 h-5" />
			</button>
			<div class="flex items-center gap-2 text-sm text-gray-500">
				{#each steps as _, index}
					<div
						class="h-1.5 flex-1 rounded-full {index === currentStep
							? 'bg-blue-500'
							: index < currentStep
								? 'bg-blue-300'
								: 'bg-gray-200 dark:bg-gray-700'}"
					></div>
				{/each}
			</div>
		</div>

		<!-- Content -->
		<div class="px-8 py-8">
			<div class="flex flex-col items-center text-center">
				<!-- Icon -->
				<div class="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
					<svelte:component this={step.icon} class="w-8 h-8 text-blue-600 dark:text-blue-400" />
				</div>

				<!-- Title -->
				<h2 class="text-2xl font-bold mb-3">{step.title}</h2>

				<!-- Description -->
				<p class="text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-line">
					{step.description}
				</p>

				<!-- Features -->
				<div class="w-full space-y-3">
					{#each step.features as feature}
						<div class="flex items-start gap-3 text-left">
							<div class="mt-0.5">
								<Check class="w-5 h-5 text-green-500" />
							</div>
							<span class="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
			<button
				onclick={prev}
				disabled={currentStep === 0}
				class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
			>
				이전
			</button>

			<div class="flex items-center gap-2">
				<button
					onclick={skip}
					class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
				>
					건너뛰기
				</button>
				<button
					onclick={next}
					class="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					{currentStep === steps.length - 1 ? '시작하기' : '다음'}
				</button>
			</div>
		</div>
	</div>
</dialog>

<style>
	dialog::backdrop {
		background: transparent;
	}
</style>
