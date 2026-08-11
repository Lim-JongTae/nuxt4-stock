# Walkthrough - LS증권 관심종목 스크리너 스킬 및 index.html 연동 결과

`skill-creator` 방식을 준수하여 LS증권 Open API 기반 **유망 업종 모멘텀 추출 및 3대 기술적 지표 조건 관심종목 스크리너 Agent Skill (`ls-stock-screener`)**을 생성하고, 이를 `index.html` 웹 대시보드에 완벽히 연동하였습니다.

---

## 1. 생성 및 업데이트된 구성 요소

### 1) Agent Skill: `ls-stock-screener`
- **[SKILL.md](file:///C:/Users/LimJongTae/Downloads/ai_temp/Project/Stock/skills/ls-stock-screener/SKILL.md)**:
  - YAML frontmatter (name: `ls-stock-screener`, description)
  - 기술적 지표 3대 조건 산출 설명 및 스크립트 사용 가이드
- **[ls_screener.py](file:///C:/Users/LimJongTae/Downloads/ai_temp/Project/Stock/skills/ls-stock-screener/scripts/ls_screener.py)**:
  - `.env` 파일의 `LS_APP_KEY`, `LS_SECREAT`를 자동으로 읽어와 OAuth2 접근 토큰 발급
  - 업종별 지수 모멘텀 조회 (`t1857`) 후 유망 업종 5개선정
  - 소속 종목별 일봉 데이터(`t8412`) 수집 및 기술적 지표 계산:
    1. **심리선 (12일)**: 과매도 구간 (**25% 이하**)
    2. **볼린저밴드 (20일, 2SD)**: 종가가 하단 밴드 근접/이탈 (102% 이내)
    3. **이동평균선 (5/20/60일)**: 최근 역배열 경험 후 현재 정배열막 전환
  - 조건을 충족하는 종목을 `watchlist.csv` 및 `watchlist.json`으로 저장
  - **매수 주문(CSPAT00601) 기능 완전 배제 (안전 모니터링 모드)**

### 2) 웹 UI 연동: `index.html`
- **[index.html](file:///C:/Users/LimJongTae/Downloads/ai_temp/Project/Stock/index.html)**:
  - **"유망 업종 & 기술적 지표 관심종목 자동 스크리너"** 대시보드 섹션 추가
  - 3대 스크리닝 기준 카드 (심리선 과매도, 볼린저 하단, 이평선 정배열 전환) 배치
  - 포착된 관심종목 리스트 표/카드 UI 제공 (`watchlist.json` 및 `watchlist.csv` 연동)
  - `refreshScreenerData()` 동적 데이터 로더 탑재

---

## 2. 기술적 검증 결과

- 파이썬 스크립트 실행 환경 (`pandas`, `numpy`, `requests`) 준비 완료
- 스크립트 실행 시 `.env` 자동 로드 및 OAuth2 토큰 처리 / API 응답 실패 시 폴백 메커니즘 동작 검증
- `watchlist.csv` 및 `watchlist.json` 파이프라인 생성 검증

---

## 3. 스킬 실행 방법

터미널이나 에이전트 명령어로 아래 스크립트를 직접 실행할 수 있습니다:

```bash
python skills/ls-stock-screener/scripts/ls_screener.py
```
