<script lang="ts">
    import { page } from "$app/stores";
    import { Home, List, BellRing, Settings } from "lucide-svelte";

    const navItems = [
        { path: "/", icon: Home, label: "홈" },
        { path: "/memos", icon: List, label: "전체 메모" },
        { path: "/notifications", icon: BellRing, label: "알림내역" },
        { path: "/settings", icon: Settings, label: "설정" },
    ];
</script>

<nav
    class="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
    style="view-transition-name: bottom-nav; padding-bottom: env(safe-area-inset-bottom, 0px);"
>
    <div class="flex items-center justify-around h-16 max-w-lg mx-auto">
        {#each navItems as { path, icon: Icon, label }}
            {@const isActive = $page.url.pathname === path}
            <a
                href={path}
                class="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors {isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'}"
            >
                <Icon class="w-5 h-5" />
                <span class="text-xs font-medium">{label}</span>
            </a>
        {/each}
    </div>
</nav>
