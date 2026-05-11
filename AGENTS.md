# memo-alarm

> 메모 알람 앱 (QR 코드 지원)

## 프로젝트 정보

| 항목 | 내용 |
|------|------|
| 프레임워크 | SvelteKit 2 + Svelte 5 |
| 언어 | TypeScript |
| 스타일링 | Tailwind CSS |
| 데이터베이스 | Supabase |
| 모바일 | Capacitor 8 (Android/iOS) |
| 배포 | Cloudflare Workers |
| URL | memo.woory.day |
| 주요 라이브러리 | Capacitor, Firebase, qrcode, html2canvas |

## 프로젝트 특성

- **모바일 앱 지원**: Capacitor로 네이티브 로컬 알림
- QR 코드 생성 기능
- html2canvas로 메모 이미지 변환
- Supabase + FCM으로 알림 처리

## 🔴 .git 보호 규칙 (최우선)

**절대 금지:**
- `.git` 디렉토리 삭제/이동/수정
- `git clean -f`, `git reset --hard`
- `git checkout .`, `git restore .`
- `Remove-Item -Recurse -Force` (코드 대상)

git 문제 발생 시: 읽기 전용 명령으로 상태 확인 후 사용자에게 보고만 할 것.

## 커밋 규칙

```bash
# ❌ 금지: git commit 직접 사용
git commit -m "..."

# ✅ 필수: 전역 커밋 스크립트 사용
git add .
"D:\work\project\tools\common\commit.sh" "feat: 기능 추가"
```

**Conventional Commits**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## 스킬 안내

| 스킬 | 트리거 키워드 |
|------|-------------|
| `plan` | 계획해, plan, 아이디어 |
| `plan-list` | 계획 목록, plan list |
| `next` | 뭐 할까, 다음, next |
| `implement` | 구현해, 진행해 |
| `done` | 완료, 끝, 마무리 |
| `deploy` | 배포, deploy |
| `webapp-testing` | 테스트, build check |
| `db-migration` | 마이그레이션, migration |

**키워드 발견 시 즉시 스킬 호출. 수동 방법 제안 금지.**

## 문서 위치

| 문서 | 위치 |
|------|------|
| TODO | `TODO.md` |
| 완료 이력 | `docs/DONE.md` |
| 아카이브 | `docs/archive/` |

## 완료 처리 보강 규칙

- `/done`으로 계획서를 `docs/archive/`로 이동한 뒤에는 LLM Wiki ingest를 반드시 시도한다.
- 별도 MCP 도구가 보이지 않더라도 "도구 없음"으로 종료하지 말고, 로컬 절차를 사용한다:
  - 1순위: `.agents/skills/archive-sweep/SKILL.md`의 LLM Wiki ingest 절차
  - 2순위: `D:\work\project\service\wtools\common\tools\archive-ingest-lib.ps1`의 `Invoke-LlmWikiIngest`
- `docs/wiki-schema.md`가 없어 ingest가 스킵되거나 DB API가 응답하지 않으면, archive/DONE 처리는 유지하고 스킵/실패 사유를 최종 응답에 명확히 남긴다.
