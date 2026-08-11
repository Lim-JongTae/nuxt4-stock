# Implementation Plan - LS증권 기술적 지표 기반 관심종목 스크리너 스킬 및 대시보드 연동

LS증권 Open API와 Python 스크립트를 활용하여 유망 업종 조회 및 3가지 기술적 조건(심리선 과매도, 볼린저밴드 하단, 이동평균 역배열→정배열 전환)을 충족하는 종목을 스크리닝하여 관심종목 CSV로 저장하는 **Agent Skill**을 작성하고, 해당 기능과 결과를 `index.html` 웹 대시보드에 연동합니다.

## User Review Required

> [!IMPORTANT]
> - 매수 주문 기능은 사용자의 요청에 따라 **완전 제외**됩니다.
> - `.env` 파일의 `LS_APP_KEY` 및 `LS_SECREAT` 환경 변수를 자동으로 인식하여 토큰을 발급받습니다.

## Open Questions

> [!NOTE]
> 스크리닝 결과를 저장할 기본 파일명 및 경로는 `C:\Users\LimJongTae\Downloads\ai_temp\Project\Stock\watchlist.csv` 로 설정될 예정입니다. 필요시 `index.html`에서 이를 불러와 표시합니다.

## Proposed Changes

---

### [Skill Component]
#### [NEW] [SKILL.md](file:///C:/Users/LimJongTae/Downloads/ai_temp/Project/Stock/skills/ls-stock-screener/SKILL.md)
- Anthropic/Gemini standard skill format으로 작성.
- YAML frontmatter (name: `ls-stock-screener`, description).
- 유망 업종 조회, 일봉 데이터 수집, 3가지 기술적 조건 산출, CSV 저장 스크립트 실행 가이드.

#### [NEW] [ls_screener.py](file:///C:/Users/LimJongTae/Downloads/ai_temp/Project/Stock/skills/ls-stock-screener/scripts/ls_screener.py)
- `.env` 파싱 (`python-dotenv` 또는 커스텀 `.env` 읽기)하여 `LS_APP_KEY`, `LS_SECREAT` 로드.
- OAuth2 토큰 발급 (LS증권 API).
- 업종별 지수 흐름 조회 및 상위 5개 유망 업종 선정.
- 업종 소속 종목별 일봉 데이터(`t8412`) 수집 및 기술적 지표 계산:
  1. 심리선 (Psychological Line, 12일 기준 <= 25%)
  2. 볼린저밴드 하단 (20일, 2배수 표준편차, 종가가 하단 밴드의 102% 이내)
  3. 이동평균선 전환 (최근 10일 내 5/20/60일 역배열 경험 + 현재 정배열)
- 조건을 충족하는 종목을 CSV (`watchlist.csv`) 및 JSON (`watchlist.json`)으로 저장.
- 매수 주문 코드는 완전히 배제.

---

### [Web UI Component]
#### [MODIFY] [index.html](file:///C:/Users/LimJongTae/Downloads/ai_temp/Project/Stock/index.html)
- 대시보드에 **"LS증권 기술적 스크리너 (심리선/볼린저/이동평균)"** 카드 UI 추가.
- 스크리닝 조건 요약 카드 및 최신 관심종목 스크리닝 데이터(CSV/JSON) 표시 UI 추가.
- 실행 방법 및 스킬 사용법 안내 배치.

## Verification Plan

### Automated Tests
- 파이썬 스크립트 단독 실행 테스트: `python C:\Users\LimJongTae\Downloads\ai_temp\Project\Stock\skills\ls-stock-screener\scripts\ls_screener.py`
- `.env` 토큰 정상 발급 확인 및 데이터 스크리닝 성공 여부, `watchlist.csv` 생성 확인.

### Manual Verification
- `index.html` 페이지를 브라우저로 확인하여 추가된 스크리너 UI 및 스크리닝 결과가 시각적으로 수려하게 표시되는지 검증.
