<script lang="ts">
    import { ArrowLeft, Sparkles, Bell, Heart, Globe, Zap, Shield, Link } from 'lucide-svelte';
    import { goto } from '$app/navigation';
</script>

<svelte:head>
    <title>About - Memo Alarm</title>
    <meta name="description" content="Memo Alarm은 메모와 알람을 하나로 통합한 스마트 알림 서비스입니다. 할 일을 놓치지 않게 도와줍니다." />
</svelte:head>

<div class="min-h-screen bg-background">
    <header class="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div class="max-w-4xl mx-auto px-4 h-14 flex items-center">
            <button
                onclick={() => goto('/')}
                class="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
                aria-label="홈으로 돌아가기"
            >
                <ArrowLeft class="h-5 w-5" />
            </button>
        </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8">
        <!-- Hero Section -->
        <section class="mb-12">
            <h1 class="text-4xl font-bold mb-4">About Memo Alarm</h1>
            <p class="text-xl text-muted-foreground leading-relaxed">
                메모와 알람을 하나로 통합한 스마트 알림 서비스입니다. 해야 할 일, 기억해야 할 사항을 메모로 기록하고
                알람을 설정하여 중요한 순간을 절대 놓치지 않도록 도와줍니다.
            </p>
        </section>

        <!-- Mission Section -->
        <section class="mb-12">
            <h2 class="text-2xl font-semibold mb-6">우리의 미션</h2>
            <div class="prose prose-gray dark:prose-invert max-w-none">
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm은 "메모와 알람을 하나로, 할 일을 놓치지 않게"라는 철학을 바탕으로 개발되었습니다.
                    현대인들은 매일 수많은 할 일과 약속, 마감일에 둘러싸여 있습니다.
                    메모는 작성하지만 그것을 상기하는 알림이 없으면 의미가 없고,
                    알람은 설정하지만 왜 그 알람이 필요한지 잊어버리곤 합니다.
                </p>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm은 이 두 가지를 통합하여, 사용자가 메모를 작성할 때 바로 알람을 설정할 수 있게 합니다.
                    복잡한 단계 없이, 간단하고 빠르게 "하려던 일"을 기록하고 "언제 할 것인지"를 정합니다.
                    설정된 시간이 되면 앱이 알려줌으로써, 사용자는 자신의 일정과 약속을 항상 기억할 수 있습니다.
                </p>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    우리는 단순한 알람 앱을 넘어, 사용자의 생산성과 시간 관리를 지원하는 신뢰할 수 있는 파트너가 되고자 합니다.
                    업무 마감일, 개인 약속, 중요한 사건, 반복되는 일상의 작은 일들까지 모두 Memo Alarm으로 관리할 수 있습니다.
                    각 사용자가 자신만의 일정 관리 방식을 구축하고 유지할 수 있도록,
                    유연하고 직관적이며 빠른 인터페이스를 제공합니다.
                </p>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm은 모든 사람에게 열려 있습니다. 직장인, 학생, 프리랜서, 주부, 창업가 등
                    자신의 시간을 효율적으로 관리하고 싶은 모든 분들을 위한 도구입니다.
                    번거로운 학습 곡선 없이, 처음 사용하는 순간부터 직관적으로 사용할 수 있습니다.
                </p>
            </div>
        </section>

        <!-- Features Section -->
        <section class="mb-12">
            <h2 class="text-2xl font-semibold mb-6">주요 기능</h2>
            <div class="grid gap-6 md:grid-cols-2">
                <div class="p-6 rounded-xl bg-card border border-border">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Bell class="h-6 w-6 text-primary" />
                        </div>
                        <h3 class="text-lg font-semibold">메모 기반 알람</h3>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        메모를 작성하고 바로 알람 시간을 설정합니다.
                        메모 내용과 알람이 함께 저장되어 알림이 울릴 때 메모가 함께 표시됩니다.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-card border border-border">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Heart class="h-6 w-6 text-primary" />
                        </div>
                        <h3 class="text-lg font-semibold">반복 알람</h3>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        매일, 특정 요일, 또는 일회성으로 알람을 설정합니다.
                        반복되는 일상의 일들을 한 번 설정하면 계속 알림을 받습니다.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-card border border-border">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Link class="h-6 w-6 text-primary" />
                        </div>
                        <h3 class="text-lg font-semibold">URL 링크 기능</h3>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        메모에 URL을 추가하여 알람이 울릴 때 바로 웹사이트로 이동할 수 있습니다.
                        "과제 제출" 메모에는 제출 사이트 URL을, "회의"에는 화상 회의 링크를 추가합니다.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-card border border-border">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Sparkles class="h-6 w-6 text-primary" />
                        </div>
                        <h3 class="text-lg font-semibold">빠른 생성</h3>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        간단한 인터페이스로 메모와 알람을 빠르게 생성합니다.
                        복잡한 설정 없이 핵심만 입력하면 됩니다.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-card border border-border">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Zap class="h-6 w-6 text-primary" />
                        </div>
                        <h3 class="text-lg font-semibold">오프라인 지원</h3>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        인터넷 연결이 없어도 저장된 메모와 알람 정보를 확인하고 관리할 수 있습니다.
                        모든 데이터는 기기에 저장됩니다.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-card border border-border">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <Shield class="h-6 w-6 text-primary" />
                        </div>
                        <h3 class="text-lg font-semibold">완전 무료</h3>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                        모든 기능을 무료로 제공합니다. 회원가입도 필요 없으며,
                        광고 수익으로 운영되어 비용 부담이 없습니다.
                    </p>
                </div>
            </div>
        </section>

        <!-- Usage Guide Section -->
        <section class="mb-12">
            <h2 class="text-2xl font-semibold mb-6">사용 가이드</h2>
            <div class="space-y-6">
                <div class="p-6 rounded-xl bg-muted/50 border border-border">
                    <h3 class="text-lg font-semibold mb-3">1. 메모 작성</h3>
                    <p class="text-muted-foreground leading-relaxed mb-3">
                        메인 페이지의 "메모 작성" 버튼을 클릭합니다.
                        해야 할 일, 기억할 사항, 약속 등을 간단히 입력합니다.
                        예: "병원 예약", "보고서 제출", "엄마께 전화하기" 등
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-muted/50 border border-border">
                    <h3 class="text-lg font-semibold mb-3">2. 알람 설정</h3>
                    <p class="text-muted-foreground leading-relaxed mb-3">
                        메모를 작성한 후 알람 시간을 설정합니다.
                        다음 정보를 입력해주세요:
                    </p>
                    <ul class="list-disc list-inside text-muted-foreground space-y-1 mb-3">
                        <li>시간과 분 (예: 14:30)</li>
                        <li>알람 메시지 (선택사항)</li>
                    </ul>
                    <p class="text-muted-foreground leading-relaxed">
                        설정 후 저장하면 해당 시간에 알림을 받게 됩니다.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-muted/50 border border-border">
                    <h3 class="text-lg font-semibold mb-3">3. 반복 설정</h3>
                    <p class="text-muted-foreground leading-relaxed mb-3">
                        같은 시간에 매일 또는 특정 요일에 반복되는 알람을 설정합니다:
                    </p>
                    <ul class="list-disc list-inside text-muted-foreground space-y-1 mb-3">
                        <li><strong>매일</strong>: 매일 같은 시간에 알람</li>
                        <li><strong>평일</strong>: 월~금에만 알람</li>
                        <li><strong>주말</strong>: 토~일에만 알람</li>
                        <li><strong>특정 요일</strong>: 월, 수, 금 등 선택한 요일에만 알람</li>
                        <li><strong>일회성</strong>: 한 번만 알람</li>
                    </ul>
                </div>

                <div class="p-6 rounded-xl bg-muted/50 border border-border">
                    <h3 class="text-lg font-semibold mb-3">4. URL 추가</h3>
                    <p class="text-muted-foreground leading-relaxed mb-3">
                        메모에 URL을 추가하여 알람이 울릴 때 바로 해당 페이지로 이동할 수 있습니다.
                        메모 편집 화면에서 URL 필드에 링크를 입력합니다.
                    </p>
                    <p class="text-muted-foreground leading-relaxed">
                        예:
                    </p>
                    <ul class="list-disc list-inside text-muted-foreground space-y-1">
                        <li>과제: https://eclass.example.com/assignments</li>
                        <li>회의: https://meet.google.com/abc-defg-hij</li>
                        <li>쇼핑: https://www.shopping-site.com/cart</li>
                    </ul>
                </div>

                <div class="p-6 rounded-xl bg-muted/50 border border-border">
                    <h3 class="text-lg font-semibold mb-3">5. 알림 권한 허용</h3>
                    <p class="text-muted-foreground leading-relaxed mb-3">
                        Memo Alarm이 알림을 보내려면 사용자의 기기에서 알림 권한을 허용해야 합니다:
                    </p>
                    <ul class="list-disc list-inside text-muted-foreground space-y-1 mb-3">
                        <li><strong>웹 버전</strong>: 브라우저 주소창 옆의 알림 권한 팝업에서 "허용" 선택</li>
                        <li><strong>모바일 앱</strong>: 앱 설치 후 알림 권한 요청에서 "허용" 선택</li>
                    </ul>
                    <p class="text-muted-foreground leading-relaxed">
                        권한을 거부하면 알림을 받을 수 없으므로 반드시 허용해주세요.
                    </p>
                </div>

                <div class="p-6 rounded-xl bg-muted/50 border border-border">
                    <h3 class="text-lg font-semibold mb-3">6. 메모 관리</h3>
                    <p class="text-muted-foreground leading-relaxed mb-3">
                        메모 목록에서 다음 작업을 수행할 수 있습니다:
                    </p>
                    <ul class="list-disc list-inside text-muted-foreground space-y-1">
                        <li>메모 클릭: 상세 내용 확인 및 편집</li>
                        <li>삭제: 더 이상 필요 없는 메모 삭제</li>
                        <li>알람 수정: 시간이나 반복 설정 변경</li>
                        <li>완료 표시: 처리 완료된 메모 체크</li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- Technology Stack -->
        <section class="mb-12">
            <h2 class="text-2xl font-semibold mb-6">기술 스택</h2>
            <div class="p-6 rounded-xl bg-card border border-border">
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm은 최신 웹 기술과 크로스 플랫폼 모바일 기술을 사용하여
                    빠르고 안정적이며 사용자 친화적인 서비스를 제공합니다:
                </p>
                <ul class="space-y-2 text-muted-foreground">
                    <li><strong>프런트엔드 프레임워크:</strong> SvelteKit 2 + Svelte 5 (최신 Runes)</li>
                    <li><strong>언어:</strong> TypeScript 5 (타입 안정성 보장)</li>
                    <li><strong>스타일링:</strong> Tailwind CSS 3/4 (반응형 디자인)</li>
                    <li><strong>UI 컴포넌트:</strong> bits-ui, lucide-svelte</li>
                    <li><strong>모바일 개발:</strong> Capacitor 8 (iOS & Android 네이티브 앱)</li>
                    <li><strong>데이터 저장:</strong> LocalStorage (기기 로컬 저장, 서버 전송 없음)</li>
                    <li><strong>배포:</strong> Cloudflare Pages (글로벌 CDN, 빠른 속도)</li>
                    <li><strong>알림:</strong> Web Notifications API + Capacitor Push Notifications</li>
                </ul>
            </div>
        </section>

        <!-- Contact CTA -->
        <section class="p-6 rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-2 border-blue-500/20 dark:border-blue-400/20">
            <h2 class="text-2xl font-semibold mb-3">피드백 및 제안</h2>
            <p class="text-muted-foreground leading-relaxed mb-4">
                Memo Alarm을 더욱 좋게 만들기 위해 여러분의 소중한 의견을 기다리고 있습니다.
                새로운 기능 아이디어, 개선 사항, 버그 보고 등 언제든지 연락해주세요.
                모든 피드백은 앱 발전에 큰 도움이 됩니다.
            </p>
            <a
                href="/contact"
                class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
                의견 보내기
                <ArrowLeft class="h-4 w-4 rotate-180" />
            </a>
        </section>

        <div class="mt-12 pt-8 border-t border-border">
            <a
                href="/"
                class="inline-flex items-center gap-2 text-primary hover:underline"
            >
                <ArrowLeft class="h-4 w-4" />
                홈으로 돌아가기
            </a>
        </div>
    </main>
</div>
