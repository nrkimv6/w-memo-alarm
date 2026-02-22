# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-23

### Added
- 북마크/메모 병합 기능: 선택 모드에서 여러 메모를 하나로 합치기
- 태그 병합: 병합 시 모든 메모의 태그를 자동으로 합산
- 중복 URL 감지 및 병합 제안: 동일 URL 북마크 그룹 표시 및 일괄 병합 UI
- DuplicateUrlDialog 컴포넌트: 중복 URL 목록 확인, 그룹별 병합/개별 삭제 지원
- 중복 URL 존재 시 헤더에 배지 아이콘 자동 표시

## [0.1.0] - 2026-02-20

### Added
- 고급 공유 기능: QR 코드 생성 및 다운로드
- 이미지로 내보내기 (카드 스타일 미리보기)
- 이미지 네이티브 공유 (Web Share API - 모바일 앱 공유 시트 지원)
- 네이티브 공유 미지원 환경에서는 자동 다운로드로 폴백
