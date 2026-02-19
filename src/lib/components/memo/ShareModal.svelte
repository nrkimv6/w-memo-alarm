<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Copy,
		Download,
		QrCode,
		Image,
		Share2,
		MessageCircle,
		Twitter,
		Facebook,
		Check
	} from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Memo } from '$lib/types/memo';
	import {
		shareMemo,
		copyToClipboard,
		shareToSNS,
		generateMemoQRCode,
		exportMemoAsImage,
		shareImage
	} from '$lib/utils';
	import { cn } from '$lib/utils';

	interface Props {
		open: boolean;
		memo: Memo | null;
		onClose: () => void;
	}

	let { open = $bindable(false), memo, onClose }: Props = $props();

	let qrCodeDataUrl = $state<string | null>(null);
	let isGeneratingQR = $state(false);
	let isExportingImage = $state(false);
	let copied = $state(false);
	let cardElement: HTMLDivElement;

	const folder = $derived(null);

	// 네이티브 공유 API 지원 여부
	const canNativeShare = $derived(typeof navigator !== 'undefined' && !!navigator.share);

	$effect(() => {
		if (open && memo) {
			generateQR();
		} else {
			qrCodeDataUrl = null;
		}
	});

	async function generateQR() {
		if (!memo) return;
		isGeneratingQR = true;
		try {
			qrCodeDataUrl = await generateMemoQRCode(memo, 200);
		} catch (err) {
			console.error('QR generation failed:', err);
		} finally {
			isGeneratingQR = false;
		}
	}

	async function handleCopy() {
		if (!memo) return;
		const success = await copyToClipboard(memo);
		if (success) {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	async function handleNativeShare() {
		if (!memo) return;
		await shareMemo(memo);
	}

	function handleSNSShare(platform: 'twitter' | 'facebook' | 'kakao') {
		if (!memo) return;
		shareToSNS(memo, platform);
	}

	// 이미지 공유: 네이티브 공유 API 지원 시 앱 공유 시트, 미지원 시 다운로드
	async function handleShareImage() {
		if (!memo || !cardElement) return;
		isExportingImage = true;
		try {
			await shareImage(cardElement, memo);
		} finally {
			isExportingImage = false;
		}
	}

	// 이미지 저장: 항상 파일로 다운로드
	async function handleDownloadImage() {
		if (!memo || !cardElement) return;
		await exportMemoAsImage(cardElement, memo);
	}

	function downloadQRCode() {
		if (!qrCodeDataUrl || !memo) return;
		const link = document.createElement('a');
		link.download = `qr-${memo.title?.slice(0, 20) || memo.id}.png`;
		link.href = qrCodeDataUrl;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<Modal bind:open title="메모 공유" size="md">
	{#if memo}
		<div class="space-y-6">
			<!-- Preview Card for Export (카드 스타일) -->
			<div
				bind:this={cardElement}
				class="p-5 bg-gradient-to-br from-background to-muted rounded-xl border-2 border-border shadow-md"
			>
				<div class="space-y-3">
					<!-- Title -->
					<h3 class="text-lg font-bold text-foreground">
						{#if memo.emoji}
							<span class="mr-2">{memo.emoji}</span>
						{/if}
						{memo.title || '제목 없음'}
					</h3>

					<!-- Content -->
					{#if memo.content}
						<p class="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
							{memo.content}
						</p>
					{/if}

					<!-- URL -->
					{#if memo.url}
						<div class="text-xs text-link truncate">{memo.url}</div>
					{/if}

					<!-- Tags -->
					{#if memo.tags.length > 0}
						<div class="flex flex-wrap gap-1.5 pt-1">
							{#each memo.tags.slice(0, 5) as tag}
								<span class="px-2 py-0.5 text-xs bg-secondary/20 text-secondary rounded-full">
									#{tag}
								</span>
							{/each}
							{#if memo.tags.length > 5}
								<span class="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
									+{memo.tags.length - 5}
								</span>
							{/if}
						</div>
					{/if}

					<!-- Footer -->
					<div class="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/50">
						<span>{formatDate(memo.createdAt)}</span>
						<span class="font-medium text-primary">memo-alarm</span>
					</div>
				</div>
			</div>

			<!-- Share Options -->
			<div class="space-y-4">
				<!-- Quick Actions -->
				<div class="grid grid-cols-2 gap-3">
					<Button
						variant="outline"
						onclick={handleCopy}
						class="justify-start gap-2"
					>
						{#if copied}
							<Check class="w-4 h-4 text-success" />
							<span class="text-success">복사됨</span>
						{:else}
							<Copy class="w-4 h-4" />
							클립보드 복사
						{/if}
					</Button>
					<Button
						variant="outline"
						onclick={handleNativeShare}
						class="justify-start gap-2"
					>
						<MessageCircle class="w-4 h-4" />
						공유하기
					</Button>
					<!-- 이미지 공유: 네이티브 공유 API 지원 시 앱 공유 시트 표시 -->
					<Button
						variant="outline"
						onclick={handleShareImage}
						disabled={isExportingImage}
						class="justify-start gap-2"
					>
						<Share2 class="w-4 h-4" />
						{isExportingImage ? '처리 중...' : canNativeShare ? '이미지 공유' : '이미지 저장'}
					</Button>
					<!-- 이미지 저장: 항상 파일로 다운로드 -->
					{#if canNativeShare}
						<Button
							variant="outline"
							onclick={handleDownloadImage}
							class="justify-start gap-2"
						>
							<Download class="w-4 h-4" />
							이미지 저장
						</Button>
					{:else}
						<Button
							variant="outline"
							onclick={downloadQRCode}
							disabled={!qrCodeDataUrl}
							class="justify-start gap-2"
						>
							<Download class="w-4 h-4" />
							QR 저장
						</Button>
					{/if}
				</div>

				<!-- SNS Share -->
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">SNS:</span>
					<div class="flex gap-2">
						<button
							onclick={() => handleSNSShare('twitter')}
							class="p-2.5 rounded-lg bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] transition-colors"
							title="Twitter"
						>
							<Twitter class="w-5 h-5" />
						</button>
						<button
							onclick={() => handleSNSShare('facebook')}
							disabled={!memo.url}
							class={cn(
								"p-2.5 rounded-lg bg-[#4267B2]/10 text-[#4267B2] transition-colors",
								memo.url ? "hover:bg-[#4267B2]/20" : "opacity-50 cursor-not-allowed"
							)}
							title={memo.url ? "Facebook" : "Facebook (URL이 있는 메모만 공유 가능)"}
						>
							<Facebook class="w-5 h-5" />
						</button>
						<button
							onclick={() => handleSNSShare('kakao')}
							disabled={!memo.url}
							class={cn(
								"p-2.5 rounded-lg bg-[#FEE500]/20 text-[#3C1E1E] transition-colors",
								memo.url ? "hover:bg-[#FEE500]/30" : "opacity-50 cursor-not-allowed"
							)}
							title={memo.url ? "Kakao" : "Kakao (URL이 있는 메모만 공유 가능)"}
						>
							<MessageCircle class="w-5 h-5" />
						</button>
					</div>
				</div>

				<!-- QR Code -->
				<div class="flex flex-col items-center gap-3 pt-2">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<QrCode class="w-4 h-4" />
						<span>QR 코드</span>
					</div>
					{#if isGeneratingQR}
						<div class="w-[200px] h-[200px] bg-muted rounded-lg flex items-center justify-center">
							<span class="text-muted-foreground animate-pulse">생성 중...</span>
						</div>
					{:else if qrCodeDataUrl}
						<img
							src={qrCodeDataUrl}
							alt="QR Code"
							class="w-[200px] h-[200px] bg-white rounded-lg p-2"
						/>
					{:else}
						<div class="w-[200px] h-[200px] bg-muted rounded-lg flex items-center justify-center">
							<span class="text-muted-foreground text-sm">QR 생성 실패</span>
						</div>
					{/if}
					<div class="flex items-center gap-2">
						<p class="text-xs text-muted-foreground text-center">
							QR 코드를 스캔하면 메모 내용을 확인할 수 있습니다
						</p>
						{#if canNativeShare}
							<Button
								variant="ghost"
								size="sm"
								onclick={downloadQRCode}
								disabled={!qrCodeDataUrl}
								class="shrink-0 h-7 px-2 text-xs gap-1"
							>
								<Download class="w-3 h-3" />
								QR 저장
							</Button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="ghost" onclick={onClose}>닫기</Button>
	{/snippet}
</Modal>
