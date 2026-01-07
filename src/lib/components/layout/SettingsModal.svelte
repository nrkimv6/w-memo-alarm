<script lang="ts">
	import { Download, Upload, Trash2, Sun, Moon, Monitor, Bell, Cloud, CloudOff, RefreshCw, Copy, Check } from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { syncStore } from '$lib/stores/sync.svelte';
	import { downloadFullBackup, importFullBackup, clearAllData } from '$lib/utils/data';
	import { cn } from '$lib/utils';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	let fileInput: HTMLInputElement;
	let importing = $state(false);
	let importError = $state('');

	const memoCount = $derived(memosStore.memos.length);

	// Phase 14: 동기화 상태
	let syncCodeInput = $state('');
	let deviceName = $state('');
	let copied = $state(false);

	async function handleRegister() {
		await syncStore.register(deviceName || undefined);
	}

	async function handleConnect() {
		if (syncCodeInput.length === 6) {
			await syncStore.connect(syncCodeInput.toUpperCase());
			syncCodeInput = '';
		}
	}

	async function handleSync() {
		await syncStore.sync();
	}

	function handleDisconnect() {
		if (confirm('동기화 연결을 해제하시겠습니까? 로컬 데이터는 유지됩니다.')) {
			syncStore.disconnect();
		}
	}

	async function copyCode() {
		if (syncStore.user?.syncCode) {
			await navigator.clipboard.writeText(syncStore.user.syncCode);
			copied = true;
			setTimeout(() => copied = false, 2000);
		}
	}

	function toggleAutoSync() {
		if (syncStore.autoSync) {
			syncStore.stopAutoSync();
		} else {
			syncStore.startAutoSync();
		}
	}

	// Default reminder settings
	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
	let defaultTime = $state(settingsStore.settings.defaultReminder.time);
	let defaultDays = $state<number[]>([...settingsStore.settings.defaultReminder.days]);
	let autoReminderOnCreate = $state(settingsStore.settings.autoReminderOnCreate);

	function toggleDefaultDay(day: number) {
		if (defaultDays.includes(day)) {
			defaultDays = defaultDays.filter((d) => d !== day);
		} else {
			defaultDays = [...defaultDays, day].sort();
		}
		settingsStore.setDefaultReminderDays(defaultDays);
	}

	function handleTimeChange(e: Event) {
		const target = e.target as HTMLInputElement;
		defaultTime = target.value;
		settingsStore.setDefaultReminderTime(target.value);
	}

	function handleAutoReminderToggle() {
		autoReminderOnCreate = !autoReminderOnCreate;
		settingsStore.setAutoReminderOnCreate(autoReminderOnCreate);
	}

	function handleExport() {
		downloadFullBackup();
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importing = true;
		importError = '';

		try {
			const result = await importFullBackup(file);
			if (!result.success) {
				importError = result.message;
			}
		} catch (err) {
			importError = (err as Error).message;
		} finally {
			importing = false;
			input.value = '';
		}
	}

	function handleClearAll() {
		if (confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			clearAllData();
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

		<!-- Phase 14: 클라우드 동기화 -->
		<div class="space-y-3">
			<h3 class="text-sm font-medium flex items-center gap-2">
				<Cloud class="w-4 h-4" />
				클라우드 동기화
			</h3>

			{#if syncStore.isConnected}
				<!-- 연결됨 -->
				<div class="p-3 rounded-lg bg-success/10 border border-success/20 space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-success">동기화 연결됨</span>
						{#if syncStore.status.isOnline}
							<span class="flex items-center gap-1 text-xs text-success">
								<span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
								온라인
							</span>
						{:else}
							<span class="flex items-center gap-1 text-xs text-muted-foreground">
								<CloudOff class="w-3 h-3" />
								오프라인
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<span class="text-xs text-muted-foreground">동기화 코드:</span>
						<code class="px-2 py-1 text-sm font-mono bg-background rounded">{syncStore.user?.syncCode}</code>
						<button onclick={copyCode} class="p-1 hover:bg-muted rounded" title="코드 복사">
							{#if copied}
								<Check class="w-4 h-4 text-success" />
							{:else}
								<Copy class="w-4 h-4" />
							{/if}
						</button>
					</div>

					{#if syncStore.status.lastSyncAt}
						<p class="text-xs text-muted-foreground">
							마지막 동기화: {new Date(syncStore.status.lastSyncAt).toLocaleString('ko-KR')}
						</p>
					{/if}

					<div class="flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							onclick={handleSync}
							disabled={syncStore.status.isSyncing || !syncStore.status.isOnline}
							class="flex-1"
						>
							<RefreshCw class={cn('w-4 h-4', syncStore.status.isSyncing && 'animate-spin')} />
							{syncStore.status.isSyncing ? '동기화 중...' : '지금 동기화'}
						</Button>
						<Button variant="ghost" size="sm" onclick={handleDisconnect}>
							연결 해제
						</Button>
					</div>

					<!-- 자동 동기화 -->
					<div class="flex items-center justify-between pt-2 border-t border-border/50">
						<span class="text-sm">자동 동기화 (5분 간격)</span>
						<button
							type="button"
							role="switch"
							aria-checked={syncStore.autoSync}
							onclick={toggleAutoSync}
							class={cn('toggle-switch', syncStore.autoSync && 'active')}
							aria-label="자동 동기화 토글"
						>
							<span class="toggle-switch-thumb"></span>
						</button>
					</div>
				</div>
			{:else}
				<!-- 미연결 -->
				<div class="space-y-4 p-3 rounded-lg bg-muted/50 border border-border">
					<p class="text-sm text-muted-foreground">
						다른 기기와 메모를 동기화하려면 동기화 코드를 생성하거나 기존 코드를 입력하세요.
					</p>

					<!-- 새 코드 생성 -->
					<div class="space-y-2">
						<Input
							bind:value={deviceName}
							placeholder="기기 이름 (선택)"
							class="text-sm"
						/>
						<Button
							variant="default"
							onclick={handleRegister}
							disabled={syncStore.status.isSyncing}
							class="w-full"
						>
							<Cloud class="w-4 h-4" />
							새 동기화 코드 생성
						</Button>
					</div>

					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						<div class="flex-1 h-px bg-border"></div>
						<span>또는</span>
						<div class="flex-1 h-px bg-border"></div>
					</div>

					<!-- 기존 코드로 연결 -->
					<div class="space-y-2">
						<Input
							bind:value={syncCodeInput}
							placeholder="동기화 코드 6자리 입력"
							maxlength={6}
							class="text-sm font-mono uppercase text-center tracking-widest"
						/>
						<Button
							variant="secondary"
							onclick={handleConnect}
							disabled={syncCodeInput.length !== 6 || syncStore.status.isSyncing}
							class="w-full"
						>
							기존 코드로 연결
						</Button>
					</div>

					{#if syncStore.status.error}
						<p class="text-xs text-destructive">{syncStore.status.error}</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- 기본 알림 설정 -->
		<div class="space-y-3">
			<h3 class="text-sm font-medium flex items-center gap-2">
				<Bell class="w-4 h-4" />
				기본 알림 설정
			</h3>

			<!-- 자동 알림 토글 -->
			<div class="flex items-center justify-between">
				<div>
					<span class="text-sm">새 메모에 자동 알림</span>
					<p class="text-xs text-muted-foreground">메모 생성 시 자동으로 알림 설정</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={autoReminderOnCreate}
					onclick={handleAutoReminderToggle}
					class={cn('toggle-switch', autoReminderOnCreate && 'active')}
				>
					<span class="toggle-switch-thumb"></span>
				</button>
			</div>

			{#if autoReminderOnCreate}
				<div class="space-y-4 p-3 rounded-lg bg-muted/50 border border-border">
					<!-- 기본 시간 -->
					<div class="space-y-2">
						<label for="default-reminder-time" class="text-sm">기본 알림 시간</label>
						<input
							id="default-reminder-time"
							type="time"
							value={defaultTime}
							onchange={handleTimeChange}
							class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					<!-- 기본 요일 -->
					<div class="space-y-2">
						<span class="text-sm">기본 반복 요일</span>
						<div class="flex gap-1">
							{#each dayLabels as label, i}
								<button
									type="button"
									onclick={() => toggleDefaultDay(i)}
									class={cn(
										'w-8 h-8 rounded-full text-xs font-medium transition-colors',
										defaultDays.includes(i)
											? 'bg-primary text-primary-foreground'
											: 'bg-background border border-border hover:bg-muted'
									)}
								>
									{label}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
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
