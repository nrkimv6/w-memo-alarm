<script lang="ts">
    import { cn } from "$lib/utils";

    let { className = "" } = $props();

    const year = new Date().getFullYear();
</script>

<footer
    class={cn(
        "py-8 text-center text-sm text-muted-foreground border-t border-border/40 mt-auto",
        className,
    )}
>
    <div class="mb-4 flex items-center justify-center gap-6">
        <a
            href="https://woory.day/privacy"
            class="hover:text-foreground transition-colors"
        >
            개인정보처리방침
        </a>
        <a
            href="https://woory.day/terms"
            class="hover:text-foreground transition-colors"
        >
            이용약관
        </a>
        <a
            href="https://woory.day/contact"
            class="hover:text-foreground transition-colors"
        >
            문의하기
        </a>
    </div>
    <div class="space-y-1">
        <p>© {year} Woory.day. All rights reserved.</p>
        <p class="text-xs text-muted-foreground/60">
            Woory Tools는 여러분의 일상을 돕는 다양한 도구를 제공합니다.
        </p>
    </div>
</footer>
