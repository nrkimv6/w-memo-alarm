<script lang="ts">
    import { ArrowLeft } from 'lucide-svelte';
    import { goto } from '$app/navigation';
</script>

<svelte:head>
    <title>Privacy Policy - Memo Alarm</title>
    <meta name="description" content="Memo Alarm의 개인정보 처리방침입니다." />
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
        <h1 class="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p class="text-sm text-muted-foreground mb-8">최종 업데이트: 2026년 1월 8일</p>

        <div class="prose prose-gray dark:prose-invert max-w-none">
            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">1. 개인정보의 수집 및 이용 목적</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm은 메모 기반 알람 서비스를 제공하기 위해 사용자의 개인정보를 최소한으로 수집합니다.
                    본 서비스는 모바일(Capacitor) 및 웹 환경에서 메모, 알람 설정, 반복 알람 정보를 안전하게 관리합니다.
                    별도의 회원가입이나 개인정보 입력을 강제하지 않으며, 모든 데이터는 사용자의 기기에 저장됩니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">2. 수집하는 정보</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 서비스는 다음과 같은 정보를 로컬 저장소(LocalStorage)에 저장할 수 있습니다:
                </p>
                <ul class="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                    <li>메모 내용 (사용자가 작성한 알람 관련 메모)</li>
                    <li>알람 시간 및 날짜 정보</li>
                    <li>반복 알람 설정 (매일, 특정 요일 등)</li>
                    <li>테마 설정 (라이트/다크 모드)</li>
                    <li>사용자 선호도 및 앱 설정</li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    이 데이터는 사용자의 브라우저 또는 모바일 기기에만 저장되며, 서버로 전송되지 않습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">3. Capacitor 모바일 기능</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm은 Capacitor를 사용하여 모바일 네이티브 기능을 제공합니다:
                </p>
                <ul class="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                    <li><strong>푸시 알림 권한</strong>: 설정한 시간에 사용자에게 알림을 전달하기 위해 필요</li>
                    <li><strong>백그라운드 실행</strong>: 앱이 닫혀있어도 알람 시간에 알림을 전달</li>
                    <li><strong>로컬 저장소</strong>: 메모와 알람 정보를 기기에 저장</li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    이러한 기능들은 사용자의 기기에서만 작동하며, 개인정보를 외부로 전송하지 않습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">4. 쿠키 및 추적 기술</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 서비스는 사용자 경험 향상을 위해 다음과 같은 기술을 사용합니다:
                </p>
                <ul class="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                    <li><strong>LocalStorage</strong>: 메모, 알람 설정, 사용자 설정 저장</li>
                    <li><strong>Google Analytics</strong> (선택적): 익명화된 사용 통계 수집</li>
                    <li><strong>Google AdSense</strong>: 광고 게재를 위한 쿠키</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">5. 제3자 서비스</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 서비스는 다음과 같은 제3자 서비스를 사용합니다:
                </p>
                <ul class="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                    <li><strong>Cloudflare Pages</strong>: 웹사이트 호스팅</li>
                    <li><strong>Google AdSense</strong>: 광고 게재</li>
                    <li><strong>Capacitor</strong>: 모바일 앱 런타임</li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    각 제3자 서비스의 개인정보 처리방침은 해당 서비스 제공자의 정책을 따릅니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">6. 메모 데이터 보호</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    Memo Alarm의 모든 메모 내용과 알람 설정은 사용자의 기기에만 저장됩니다.
                    서비스 제공자(Woory)는 사용자의 메모 내용에 접근할 수 없으며,
                    데이터는 사용자의 통제 아래에 있습니다.
                    사용자는 언제든지 기기 설정을 통해 모든 데이터를 삭제할 수 있습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">7. 아동의 개인정보 보호</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 서비스는 만 14세 미만 아동을 대상으로 하지 않으며,
                    의도적으로 아동의 개인정보를 수집하지 않습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">8. 개인정보 보호책임자</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    개인정보 보호와 관련된 문의사항은 아래 연락처로 문의해주시기 바랍니다:
                </p>
                <ul class="list-none text-muted-foreground space-y-2 mb-4">
                    <li><strong>이메일</strong>: <a href="mailto:contact@woory.day" class="text-primary hover:underline">contact@woory.day</a></li>
                    <li><strong>연락처 페이지</strong>: <a href="/contact" class="text-primary hover:underline">/contact</a></li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">9. 개인정보 처리방침 변경</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 개인정보 처리방침은 관련 법령 및 서비스 정책에 따라 변경될 수 있습니다.
                    변경 시 본 페이지를 통해 공지하며, 중요한 변경사항은 서비스 메인 페이지에서 안내합니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">10. 사용자 권리</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    사용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다:
                </p>
                <ul class="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                    <li>브라우저 또는 기기 설정을 통해 모든 데이터(메모, 알람, 설정) 삭제</li>
                    <li>Google Analytics 추적 거부</li>
                    <li>푸시 알림 권한 비활성화</li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    데이터 삭제는 즉시 적용되며, 복구할 수 없습니다.
                </p>
            </section>
        </div>

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
