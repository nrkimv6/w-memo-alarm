<script lang="ts">
	import { Pin, Trash2 } from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { onboardingStore } from '$lib/stores/onboarding.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	function handleConfirm() {
		onboardingStore.markSwipeGuideSeen();
		onClose();
	}

	function handleNeverShowAgain() {
		onboardingStore.markSwipeGuideSeen();
		onClose();
	}
</script>

<Modal bind:open title="💡 메모 카드 사용 팁" size="md">
	<div class="space-y-6">
		<!-- 스와이프 액션 안내 -->
		<div class="space-y-4">
			<div class="flex items-center gap-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
				<div class="flex items-center justify-center w-12 h-12 bg-destructive/20 rounded-full">
					<Trash2 class="w-6 h-6 text-destructive" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold text-foreground mb-1">왼쪽으로 밀면 삭제</h3>
					<p class="text-sm text-muted-foreground">메모 카드를 왼쪽으로 스와이프하면 삭제할 수 있습니다</p>
				</div>
			</div>

			<div class="flex items-center gap-4 p-4 bg-secondary/10 rounded-lg border border-secondary/20">
				<div class="flex items-center justify-center w-12 h-12 bg-secondary/20 rounded-full">
					<Pin class="w-6 h-6 text-secondary" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold text-foreground mb-1">오른쪽으로 밀면 고정</h3>
					<p class="text-sm text-muted-foreground">메모 카드를 오른쪽으로 스와이프하면 상단에 고정할 수 있습니다</p>
				</div>
			</div>
		</div>

		<!-- 케밥 메뉴 안내 -->
		<div class="p-4 bg-muted/50 rounded-lg">
			<p class="text-sm text-foreground">
				<span class="font-semibold">메뉴(⋮)</span>를 눌러 수정, 삭제, 숨기기 등 더 많은 기능을 사용할 수 있습니다
			</p>
		</div>

		<!-- 버튼 -->
		<div class="flex gap-3">
			<Button variant="outline" onclick={handleNeverShowAgain} class="flex-1">
				다시 보지 않기
			</Button>
			<Button onclick={handleConfirm} class="flex-1">
				확인
			</Button>
		</div>
	</div>
</Modal>
