<script lang="ts">
    import { page } from "$app/stores";
    import { Home, StickyNote, CheckSquare, Settings } from "lucide-svelte";
    import { memosStore } from '$lib/stores/memos.svelte';
    import { isOverdue } from '$lib/utils/todo';

    const navItems = [
        { path: "/", icon: Home, label: "홈" },
        { path: "/memos", icon: StickyNote, label: "메모" },
        { path: "/todos", icon: CheckSquare, label: "할일" },
        { path: "/settings", icon: Settings, label: "설정" },
    ];

    const overdueCount = $derived(
        memosStore.memos.filter(m =>
            m.memoType === 'todo' &&
            m.todoStatus === 'pending' &&
            isOverdue(m)
        ).length
    );
</script>

<nav
    class="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
    style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
    <div class="flex items-center justify-around h-16 max-w-lg mx-auto">
        {#each navItems as { path, icon: Icon, label }}
            {@const isActive = $page.url.pathname === path}
            <a
                href={path}
                class="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative {isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'}"
            >
                <Icon class="w-5 h-5" />
                <span class="text-xs font-medium">{label}</span>
                {#if path === '/todos' && overdueCount > 0}
                    <span class="absolute top-2 right-1/4 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {overdueCount}
                    </span>
                {/if}
            </a>
        {/each}
    </div>
</nav>
