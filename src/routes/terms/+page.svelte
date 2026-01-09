<script lang="ts">
    import { ArrowLeft } from "lucide-svelte";
    import { goto } from "$app/navigation";
</script>

<svelte:head>
    <title>Terms of Service - 메모알람</title>
    <meta name="description" content="메모알람의 이용약관입니다." />
</svelte:head>

<div class="min-h-screen bg-background">
    <header
        class="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm"
    >
        <div class="max-w-4xl mx-auto px-4 h-14 flex items-center">
            <button
                onclick={() => goto("/")}
                class="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
                aria-label="홈으로 돌아가기"
            >
                <ArrowLeft class="h-5 w-5" />
            </button>
        </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8">
        <h1 class="text-3xl font-bold mb-2">Terms of Service</h1>
        <p class="text-sm text-muted-foreground mb-8">
            최종 업데이트: 2026년 1월 8일
        </p>

        <div class="prose prose-gray dark:prose-invert max-w-none">
            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">1. 서비스 개요</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람은 메모 기반 알람 서비스를 제공하는 앱입니다.
                    사용자는 메모를 작성하고 알람 시간을 설정하여 중요한 일정을
                    잊지 않을 수 있습니다. 본 서비스는 웹 브라우저와 모바일
                    앱(iOS/Android)에서 무료로 제공되며, 회원가입 없이 자유롭게
                    이용할 수 있습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">2. 서비스 기능</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    사용자는 본 서비스를 다음과 같은 목적으로 이용할 수
                    있습니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>메모 작성 및 저장 (할 일, 일정, 메모 등)</li>
                    <li>메모에 알람 시간 설정</li>
                    <li>반복 알람 설정 (매일, 특정 요일, 일회성)</li>
                    <li>URL 링크 추가 및 메모 관리</li>
                    <li>웹과 모바일 간 동기화 (선택적)</li>
                    <li>테마 커스터마이징 (라이트/다크 모드)</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">3. 사용자의 의무</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    사용자는 본 서비스를 이용함에 있어 다음 행위를 해서는 안
                    됩니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>서비스의 정상적인 운영을 방해하는 행위</li>
                    <li>
                        다른 사용자의 데이터를 무단으로 접근하거나 수정하는 행위
                    </li>
                    <li>
                        자동화된 수단(봇, 스크래핑 등)을 사용하여 서비스에
                        과도한 부하를 주는 행위
                    </li>
                    <li>
                        법령에 위반되거나 공공질서 및 미풍양속에 반하는 행위
                    </li>
                    <li>
                        서비스를 통해 얻은 정보를 무단으로 복제, 배포, 전송하는
                        행위
                    </li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">4. 알림 권한 설정</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람이 설정된 시간에 알림을 전달하려면 사용자가 다음을
                    수행해야 합니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>브라우저의 푸시 알림 권한 허용 (웹 버전)</li>
                    <li>모바일 기기의 알림 권한 활성화 (모바일 앱)</li>
                    <li>
                        브라우저 탭이 열려있거나 모바일 앱이 설치되어 있어야 함
                    </li>
                    <li>기기의 인터넷 연결 유지</li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    사용자는 언제든지 기기 설정에서 알림 권한을 변경할 수
                    있습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">
                    5. 중요한 일정 백업 권장
                </h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람은 모든 메모와 알람 정보를 사용자의 기기에
                    저장합니다. 중요한 업무, 약속, 일정의 경우 다음을
                    권장합니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>
                        메모알람 외 추가 알림 설정 (달력 앱, 기타 알람 앱 등)
                    </li>
                    <li>중요 일정은 여러 곳에 기록</li>
                    <li>정기적으로 메모 데이터 백업</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">
                    6. 알림 전달 보장 불가
                </h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람은 다음과 같은 상황에서 알림 전달을 보장할 수
                    없습니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>기기가 꺼져있거나 대기 상태인 경우</li>
                    <li>인터넷 연결이 끊어진 경우</li>
                    <li>기기의 저전량 모드 또는 절전 기능이 활성화된 경우</li>
                    <li>브라우저가 완전히 종료된 경우 (웹 버전)</li>
                    <li>기기 시간대(타임존) 설정이 부정확한 경우</li>
                    <li>
                        운영체제(iOS/Android) 또는 브라우저 업데이트로 인한
                        호환성 문제
                    </li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    따라서 중요한 일정이나 약속은 메모알람을 보조 도구로만
                    사용할 것을 권장합니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">7. 기기별 제한사항</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람의 기능은 기기별로 다를 수 있습니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>
                        <strong>웹 버전</strong>: 브라우저 푸시 알림 지원 필수,
                        백그라운드 실행 제한
                    </li>
                    <li>
                        <strong>모바일 앱 (iOS)</strong>: 앱 권한 설정 필수,
                        백그라운드 알림 제한 가능
                    </li>
                    <li>
                        <strong>모바일 앱 (Android)</strong>: 배터리 최적화
                        설정으로 인한 알림 지연 가능
                    </li>
                    <li>구형 기기에서는 일부 기능 미지원 가능</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">8. 메모 손실 가능성</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    다음과 같은 상황에서 메모 데이터가 손실될 수 있습니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>사용자가 실수로 모든 데이터 삭제</li>
                    <li>브라우저 캐시/쿠키 초기화</li>
                    <li>모바일 앱 삭제 또는 기기 초기화</li>
                    <li>기기 하드웨어 손상</li>
                    <li>운영체제 업데이트로 인한 호환성 문제</li>
                </ul>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람 및 Woory는 손실된 메모 데이터에 대해 책임을 지지
                    않습니다. 따라서 중요한 메모는 정기적으로 백업할 것을
                    권장합니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">9. 지적재산권</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 서비스의 디자인, 로고, 콘텐츠, 소스코드 등 모든
                    지적재산권은 Woory에 귀속됩니다. 사용자는 사전 허락 없이
                    이를 복제, 배포, 전송, 출판할 수 없습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">10. 광고 게재</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 서비스는 운영 비용을 충당하기 위해 Google AdSense 등의
                    광고를 게재할 수 있습니다. 광고 게재와 관련된 쿠키 및 데이터
                    처리는 <a
                        href="/privacy"
                        class="text-primary hover:underline"
                        >개인정보 처리방침</a
                    >을 참고하시기 바랍니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">
                    11. 서비스 변경 및 중단
                </h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람은 운영상 또는 기술상의 필요에 따라 서비스의 전부
                    또는 일부를 변경하거나 중단할 수 있습니다. 서비스 중단 시
                    사전 공지를 원칙으로 하나, 긴급한 경우 사후 공지할 수
                    있습니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">12. 면책 조항</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    메모알람은 다음 사항에 대해 책임을 지지 않습니다:
                </p>
                <ul
                    class="list-disc list-inside text-muted-foreground space-y-2 mb-4"
                >
                    <li>알림 전달 지연 또는 미전달</li>
                    <li>메모 데이터 손실 또는 손상</li>
                    <li>
                        천재지변, 전쟁, 폭동, 해킹, DDOS 공격 등 불가항력적인
                        사유로 인한 서비스 중단
                    </li>
                    <li>사용자의 귀책사유로 인한 서비스 이용 장애</li>
                    <li>
                        제3자 서비스(OS, 브라우저, Capacitor 등)의 변경으로 인한
                        기능 제한
                    </li>
                    <li>
                        사용자가 서비스를 통해 얻은 정보를 사용하여 발생한 손해
                    </li>
                    <li>기기 하드웨어 문제로 인한 데이터 손실</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">13. 준거법 및 관할</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 약관은 대한민국 법률에 따라 규율되고 해석됩니다. 서비스
                    이용과 관련하여 발생한 분쟁은 관할 법원의 판결에 따릅니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">14. 이용약관 변경</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    본 이용약관은 관련 법령 및 서비스 정책에 따라 변경될 수
                    있습니다. 변경 시 본 페이지를 통해 공지하며, 중요한
                    변경사항은 서비스 메인 페이지에서 안내합니다.
                </p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold mb-4">15. 문의</h2>
                <p class="text-muted-foreground leading-relaxed mb-4">
                    이용약관과 관련된 문의사항은 아래 연락처로 문의해주시기
                    바랍니다:
                </p>
                <ul class="list-none text-muted-foreground space-y-2 mb-4">
                    <li>
                        <strong>이메일</strong>:
                        <a
                            href="mailto:contact@woory.day"
                            class="text-primary hover:underline"
                            >contact@woory.day</a
                        >
                    </li>
                    <li>
                        <strong>연락처 페이지</strong>:
                        <a href="/contact" class="text-primary hover:underline"
                            >/contact</a
                        >
                    </li>
                </ul>
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
