---
name: toss-capture
description: 토스증권에서 종목을 검색하여 차트를 캡쳐합니다.
---

# Capture

토스증권에서 종목을 검색하여 차트를 캡쳐합니다.

## When to use this skill

- 주식 정보 분석을 위해 차트 이미지가 필요할 때

## How to use it

- Playwright MCP(`browser_subagent`)를 사용하여 토스증권 상세 페이지에 접속합니다.
- 접속 URL: `https://www.tossinvest.com/stocks/[종목ID]/order`
- **중요**: 차트와 데이터가 완전히 로드될 때까지 최소 3000ms 이상 대기(`wait`)한 후 캡쳐를 진행합니다.
- 전체 화면 또는 차트 영역을 캡쳐하여 `report/images/YYYY-MM-DD/[종목명].png` 에 저장합니다.
- 저장 시 파일명은 한글 종목명(예: 엔비디아.png)을 권장합니다.
