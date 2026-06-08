---
paths:
  - "app/migrations/**"
  - "app/models/**"
  - "*/migrations/**"
  - "*/models/**"
---

# DB 마이그레이션 규칙

## 🔴 running DB 반영은 Phase DB-Direct에서 수행

마이그레이션 SQL 파일을 생성했거나 DB schema 변경이 있으면 plan에 `Phase DB-Direct`를 두고, **post-merge + root-worktree + main** 조건에서 `/merge-test` owner가 실행/확인한다.
worktree `/implement` 단계에서 running DB 직접 실행, service restart, live API 호출을 하지 않는다.

### evidence 3종

- 실행 SQL/명령 또는 자동 bootstrap/restart 경로
- 존재 확인 쿼리(DB inspect 포함)
- live API 또는 runtime 결과

### 실행 확인 체크리스트

- Phase DB-Direct가 Phase M 다음, T4/T5 앞에 있는지 확인
- T4/T5 실행 전에 DB-direct evidence 3종 확보
- SQL 파일이 수동 참조용이면 자동 bootstrap/restart 경로와 DB inspect read-back을 기록
- 구현 완료 후 `app/REQUIREMENTS.md` 업데이트
