# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2] - 2026-02-27

### Fixed
- 메모 수정 버튼 클릭 시 crash 수정 (reminder.days undefined → null guard)
- normalizeMemo에서 migrateToMultipleReminders 호출 추가 (localStorage 캐시 메모 정규화)
- ReminderCard.formatDays 방어 코드 강화

## [0.6.1] - 2026-02-27

### Fixed
- 구버전 localStorage 캐시에 tags 필드 없는 메모 수정 시 크래시 수정 (normalizeMemo 정규화)

## [0.6.0] - 2026-02-23

### Added
- 마크다운 렌더링: marked 라이브러리 사용, 마크다운 문법 자동 감지 후 렌더링, 설정에서 토글
- 통계 대시보드: /stats 페이지, 7일 활동 막대 차트, 30일 히트맵, 태그/폴더/유형별 통계, 하단 네비게이션 추가
- 메모 잠금(PIN): PIN 설정/변경/제거, 개별 메모 잠금 토글, 잠금 해제 세션(30분), 힌트 기능
- 오디오 녹음: MediaRecorder API, WebM/MP4 녹음, 인라인 재생 플레이어, 최대 3개/5분
- 메모 표시 설정 섹션 추가 (설정 페이지)
- PIN 잠금 관리 섹션 추가 (설정 페이지)

## [0.5.0] - 2026-02-23

### Added
- 이미지 첨부: 메모에 이미지 추가 (파일 선택, 붙여넣기, 드래그앤드롭), canvas 기반 압축 (최대 800px, JPEG 75%), 라이트박스 뷰어, 카드 썸네일 표시

## [0.4.0] - 2026-02-23

### Added
- 음성 메모: Web Speech API 기반 STT로 음성 → 텍스트 변환, 메모 폼에 마이크 버튼 통합

## [0.3.0] - 2026-02-23

### Added
- AI 메모 요약: 메모 내용을 AI가 자동으로 요약
- AI 관련 메모 추천: 현재 메모와 관련된 다른 메모를 AI가 추천
- AI 스마트 검색: 자연어 기반 의미론적 메모 검색

## [0.2.0] - 2026-02-23

### Added
- 북마크 메모 병합 기능: 선택 모드에서 여러 메모를 하나로 합치기
- 태그 병합: 병합 후 모든 메모의 태그를 자동으로 합산
- 중복 URL 감지 및 병합 안내: 동일 URL 북마크 그룹 표시 및 일괄 병합 UI
- DuplicateUrlDialog 컴포넌트: 중복 URL 목록 확인, 그룹별 병합/개별 처리 지원
- 중복 URL 존재 시 헤더에 배지 및 다이얼로그 자동 표시

## [0.1.0] - 2026-02-20

### Added
- 고급 공유 기능: QR 코드 생성 및 다운로드
- 링크 지라이브 보여주기 (카드 스타일 미리보기)
- 링크 네이티브 공유 (Web Share API - 모바일 앱 공유 시트 지원)
- 네이티브 공유 미지원 환경에서는 자동 다운로드로 폴백
