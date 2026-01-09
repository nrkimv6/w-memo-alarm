<script lang="ts">
    import { ChevronDown, Globe } from "lucide-svelte";

    // Hardcoded tools list to ensure portability
    const TOOLS = [
        {
            name: "기도시간",
            url: "https://sacred-hours.woory.day",
            description: "기도 시간 관리",
        },
        {
            name: "명언집",
            url: "https://gentle-words.woory.day",
            description: "일일 명언 및 묵상",
        },
        {
            name: "문센 다모아",
            url: "https://activity.woory.day",
            description: "문화센터 강좌 검색",
        },
        {
            name: "스크린샷 생성기",
            url: "https://screenshot.woory.day",
            description: "모바일 목업 생성",
        },
        {
            name: "메모알람",
            url: "https://memo.woory.day",
            description: "메모 및 알림",
        },
        {
            name: "회선 관리",
            url: "https://line-minder.woory.day",
            description: "회선 관리",
        },
        {
            name: "우리공방",
            url: "https://woory.day",
            description: "전체 도구 모음",
        },
    ];

    let isOpen = $state(false);
</script>

<nav
    class="sticky top-0 z-[100] w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
    <div
        class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
    >
        <!-- Logo -->
        <div class="flex items-center">
            <a
                href="https://woory.day"
                class="flex items-center gap-2 font-bold text-lg transition-colors hover:text-primary group"
            >
                <span class="text-primary">우리공방</span>
            </a>
        </div>

        <!-- Desktop Menu -->
        <div class="flex items-center gap-4">
            <div class="relative group">
                <button
                    class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent/50"
                    onclick={() => (isOpen = !isOpen)}
                    onblur={() => setTimeout(() => (isOpen = false), 200)}
                >
                    <Globe class="h-4 w-4" />
                    <span class="hidden sm:inline">Family Sites</span>
                    <ChevronDown
                        class="h-3.5 w-3.5 opacity-50 transition-transform group-hover:rotate-180"
                    />
                </button>

                <!-- Dropdown -->
                <div
                    class="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95 origin-top-right invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all z-50"
                >
                    <div
                        class="px-2 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                        Woory Apps
                    </div>
                    {#each TOOLS as tool}
                        <a
                            href={tool.url}
                            class="flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus:bg-accent focus:text-accent-foreground"
                        >
                            <span class="font-medium">{tool.name}</span>
                            <span class="text-xs text-muted-foreground"
                                >{tool.description}</span
                            >
                        </a>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</nav>
