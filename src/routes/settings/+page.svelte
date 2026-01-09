<script lang="ts">
    import Footer from "$lib/components/Footer.svelte";
    import { Info } from "lucide-svelte";
</script>

<div class="max-w-2xl mx-auto px-4 py-8 space-y-8">
    <h1 class="text-2xl font-bold">설정</h1>

    <!-- 앱 정보 -->
    <section class="space-y-4">
        <div class="flex items-center gap-2 text-primary">
            <Info class="w-5 h-5" />
            <h2 class="font-semibold">앱 정보</h2>
        </div>

        <div class="bg-card rounded-xl border border-border p-5 space-y-4">
            <div class="flex justify-between items-center text-sm">
                <span class="text-muted-foreground">버전</span>
                <span class="font-medium">1.0.0</span>
            </div>
            <div class="flex justify-between items-center text-sm">
                <span class="text-muted-foreground">빌드</span>
                <span class="font-medium">2026.01.08</span>
            </div>
        </div>

        <p class="text-sm text-muted-foreground px-1">
            * 상세한 알림 및 데이터 설정 기능은 홈 화면에서 관리할 수 있습니다.
            (추후 이곳으로 통합될 예정입니다)
        </p>
    </section>

    <!-- Footer (법적 고지) -->
    <Footer className="pb-24 mt-8" />
</div>
