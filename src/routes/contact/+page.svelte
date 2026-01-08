<script lang="ts">
    import { ArrowLeft, Mail, MessageSquare, ExternalLink } from 'lucide-svelte';
    import { goto } from '$app/navigation';
</script>

<svelte:head>
    <title>Contact Us - Memo Alarm</title>
    <meta name="description" content="Memo Alarm 문의 및 연락처입니다." />
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
        <h1 class="text-3xl font-bold mb-2">Contact Us</h1>
        <p class="text-muted-foreground mb-8">
            문의사항이나 제안이 있으시면 아래 방법으로 연락해주세요.
        </p>

        <div class="grid gap-6 md:grid-cols-2 mb-12">
            <!-- Email Contact -->
            <div class="p-6 rounded-xl bg-card border border-border">
                <div class="flex items-center gap-3 mb-4">
                    <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Mail class="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold">이메일 문의</h2>
                        <p class="text-sm text-muted-foreground">가장 빠른 응답 방법</p>
                    </div>
                </div>
                <a
                    href="mailto:contact@woory.day"
                    class="inline-flex items-center gap-2 text-primary hover:underline"
                >
                    contact@woory.day
                    <ExternalLink class="h-4 w-4" />
                </a>
            </div>

            <!-- GitHub Issues -->
            <div class="p-6 rounded-xl bg-card border border-border">
                <div class="flex items-center gap-3 mb-4">
                    <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <MessageSquare class="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold">버그 리포트</h2>
                        <p class="text-sm text-muted-foreground">기술적 문제 보고</p>
                    </div>
                </div>
                <a
                    href="https://github.com/nrkimv6/wservice-memo-alarm/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 text-primary hover:underline"
                >
                    GitHub Issues
                    <ExternalLink class="h-4 w-4" />
                </a>
            </div>
        </div>

        <!-- FAQ Section -->
        <section class="mb-12">
            <h2 class="text-2xl font-semibold mb-6">자주 묻는 질문</h2>
            <div class="space-y-4">
                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>알림이 안 와요</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        다음을 확인해주세요:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li>브라우저 또는 기기의 푸시 알림 권한이 활성화되어 있는지 확인</li>
                        <li>알람 시간이 올바르게 설정되었는지 확인</li>
                        <li>현재 시간대(타임존)가 정확한지 확인</li>
                        <li>웹 버전의 경우 브라우저 탭이 열려 있는지 확인 (또는 백그라운드 서비스 활성화)</li>
                        <li>모바일 앱의 경우 앱이 설치되어 있고 활성화되었는지 확인</li>
                        <li>기기의 인터넷 연결 상태 확인</li>
                        <li>기기의 저전량 모드 또는 배터리 절약 모드 확인</li>
                    </ul>
                    <p class="mt-3 text-sm text-muted-foreground">
                        문제가 계속되면 <a href="mailto:contact@woory.day" class="text-primary hover:underline">contact@woory.day</a>로 문의해주세요.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>메모 백업은 어떻게 해요?</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        Memo Alarm의 모든 데이터는 기기의 로컬 저장소에 저장됩니다.
                        따라서 다음 방법으로 백업할 수 있습니다:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li><strong>웹 버전</strong>: 브라우저 개발자도구 &gt; Application &gt; LocalStorage에서 데이터 추출</li>
                        <li><strong>모바일 앱</strong>: 기기 설정에서 전체 데이터 백업 수행</li>
                        <li><strong>수동 백업</strong>: 중요한 메모는 클라우드 저장소(Google Drive, OneDrive 등)에 별도 저장</li>
                    </ul>
                    <p class="mt-3 text-sm text-muted-foreground">
                        기기를 바꾸거나 캐시를 초기화하면 메모가 손실될 수 있으므로 정기적인 백업을 권장합니다.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>반복 알람은 어떻게 설정해요?</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        메모를 생성한 후 알람 설정에서 다음과 같이 반복을 설정할 수 있습니다:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li><strong>매일</strong>: 매일 같은 시간에 반복</li>
                        <li><strong>특정 요일</strong>: 월, 화, 수, 목, 금, 토, 일 중 선택</li>
                        <li><strong>일회성</strong>: 한 번만 알림</li>
                    </ul>
                    <p class="mt-3 text-sm text-muted-foreground">
                        예를 들어, 매일 아침 8시에 "운동하기" 알람을 설정하거나,
                        월/수/금에만 "진료 예약" 알람을 설정할 수 있습니다.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>URL 기능은 어떻게 사용하나요?</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        메모에 URL을 추가하여 관련 웹사이트로 빠르게 접근할 수 있습니다:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li>메모 편집 화면에서 URL 입력 필드에 링크 추가</li>
                        <li>알람이 울릴 때 URL을 클릭하면 해당 웹사이트로 이동</li>
                        <li>예: "과제 제출" 메모에 과제 제출 사이트 URL 추가</li>
                    </ul>
                    <p class="mt-3 text-sm text-muted-foreground">
                        이를 통해 알람 후 바로 필요한 작업을 진행할 수 있습니다.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>모바일 앱 권한 설정</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        Memo Alarm 모바일 앱에서 알림을 받으려면 다음 권한이 필요합니다:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li><strong>알림 권한</strong>: 알람 시간에 푸시 알림 전달</li>
                        <li><strong>저장소 접근</strong>: 메모와 알람 설정 저장</li>
                        <li><strong>배경 실행</strong> (Android): 앱이 백그라운드에서 실행되도록 허용</li>
                    </ul>
                    <p class="mt-3 text-sm text-muted-foreground">
                        권한이 거부된 경우, 기기 설정 - 앱 관리 - Memo Alarm - 권한에서 다시 활성화할 수 있습니다.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>웹과 모바일 간 데이터 동기화</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        현재 Memo Alarm은 각 기기마다 독립적으로 데이터를 저장합니다.
                        향후 동기화 기능이 추가될 예정입니다.
                    </p>
                    <p class="mt-3 text-sm text-muted-foreground">
                        현재는 중요한 메모를 여러 기기에 수동으로 추가하여 관리하실 수 있습니다.
                        동기화 기능에 대한 문의나 제안은 <a href="mailto:contact@woory.day" class="text-primary hover:underline">contact@woory.day</a>로 연락주세요.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>개인정보 및 보안</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        Memo Alarm은 사용자의 메모와 알람 정보를 안전하게 처리합니다:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li>모든 데이터는 사용자의 기기에만 저장</li>
                        <li>서버로 전송되지 않음</li>
                        <li>기기에서만 접근 가능</li>
                    </ul>
                    <p class="mt-3 text-sm text-muted-foreground">
                        개인정보 처리방침과 관련된 문의는
                        <a href="/privacy" class="text-primary hover:underline">개인정보 처리방침</a> 페이지를 먼저 확인해주세요.
                    </p>
                </details>

                <details class="group p-4 rounded-lg bg-card border border-border">
                    <summary class="font-medium cursor-pointer list-none flex items-center justify-between">
                        <span>오류 또는 버그 신고</span>
                        <span class="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
                        기술적 문제나 버그는
                        <a href="https://github.com/nrkimv6/wservice-memo-alarm/issues" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
                            GitHub Issues
                        </a>에서 상세하게 보고해주시면 빠르게 해결하겠습니다.
                        버그 신고 시 다음 정보를 포함해주세요:
                    </p>
                    <ul class="mt-2 ml-4 space-y-2 text-sm text-muted-foreground list-disc">
                        <li>사용 기기 및 OS (예: iPhone iOS 17, Android 14, Chrome 최신버전)</li>
                        <li>앱 또는 브라우저 버전</li>
                        <li>발생한 문제 설명</li>
                        <li>반복 재현 방법</li>
                        <li>예상 동작과 실제 동작의 차이</li>
                    </ul>
                </details>
            </div>
        </section>

        <!-- Response Time -->
        <section class="p-6 rounded-xl bg-muted/50 border border-border">
            <h2 class="text-xl font-semibold mb-3">응답 시간</h2>
            <p class="text-muted-foreground leading-relaxed">
                일반적으로 영업일 기준 <strong>1-3일 이내</strong>에 답변드립니다.
                긴급한 문제(서비스 다운, 보안 이슈 등)는 최우선으로 처리합니다.
            </p>
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
