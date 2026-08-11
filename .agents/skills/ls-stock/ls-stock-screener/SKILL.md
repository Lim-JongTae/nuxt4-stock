---
name: ls-stock-screener
description: LS증권 Open API를 사용하여 유망 업종을 추출하고, 심리선 과매도(25% 이하), 볼린저밴드 하단권, 이동평균선 정배열 전환, 거래량 증가(120% 이상), MACD 오실레이터 반전, RSI 과매도(30 이하) 탈출 6가지 조건이 충족된 관심종목을 관심종목 리스트(CSV/JSON)로 스크리닝하여 저장합니다. 매수 주문 기능은 제외되어 안전하게 모니터링할 수 있습니다. "종목 추천", "기술적 스크리너", "LS증권 종목 분석", "심리선 볼린저 이평선 거래량 MACD RSI 스크리닝" 요청 시 사용하세요.
---

# LS증권 기술적 지표 기반 관심종목 스크리너 (LS Stock Screener)

이 스킬은 **LS증권 Open API**를 활용하여 유망 업종 후보를 추리고, 소속 종목들의 일봉 기술적 지표(심리선, 볼린저밴드, 이동평균선 전환, 거래량 증가, MACD 반전, RSI 과매도 탈출)를 계산하여 조건에 부합하는 종목을 관심종목 리스트로 생성합니다.

> [!IMPORTANT]
> **매수 주문(CSPAT00601) 기능은 포함되어 있지 않으며**, 오직 모니터링 및 스크리닝(관심종목 CSV/JSON 추출) 목적으로 작동합니다.

---

## 1. 주요 기능 및 스크리닝 로직

1. **OAuth2 토큰 자동 발급**:
   - 프로젝트 루트의 `.env` 파일에 지정된 `LS_APP_KEY` 및 `LS_SECREAT`를 탐색하여 토큰을 발급받습니다.
2. **유망 업종 추출**:
   - LS증권 업종별 등락률/모멘텀 상위 TR(`t1857`)을 조회하여 상위 유망 업종 5개 선정.
3. **6가지 핵심 기술적 지표 스크리닝**:
   - **심리선 (Psychological Line)**: 12일 기준 상승 일수 비율 **25% 이하 (과매도 구간)**
   - **볼린저밴드 (Bollinger Band)**: 20일, 2표준편차 기준 **종가가 하단 밴드 근접/이탈** (하단 102% 이내)
   - **이동평균선 전환 (Moving Average Turnaround)**: 최근 10거래일 내 5/20/60일선 **역배열(MA5 < MA20 < MA60) 험 후 현재 정배열(MA5 > MA20 > MA60)로 막 전환**
   - **MACD 오실레이터 반전 및 상승 다이버전스 (MACD Reversal & Bullish Divergence)**: MACD 선이 시그널선을 상향 돌파하거나 오실레이터가 음수에서 양수로 전환되는 순간 및 주가 저점 대비 지표 저점이 높아지는 **상승 다이버전스 유무 판단**
   - **RSI 과매도 탈출 (RSI Exit Oversold)**: RSI(14일)가 30 이하 침체 구간 진입 후 30선을 상향 돌파하는 시점
   - **거래량 증가 (Volume Increase)**: 전일 대비 거래량 **120% 이상 증가 (매수 수급 유입 확인)**
4. **결과 저장**:
   - 프로젝트 루트 디렉토리에 `watchlist.csv` 및 `watchlist.json`으로 실시간 덮어쓰기 저장.
   - `report/csv/` 폴더에 날짜 및 조회 시각 기준 타임스탬프 파일명(`YYYY-MM-DD_HHmmss.csv`)으로 히스토리 CSV 추가 저장.

---

## 2. 스크립트 실행 방법

스크리너 파이썬 스크립트는 번들된 `scripts/ls_screener.py`를 실행하여 직접 수행할 수 있습니다:

```bash
python skills/ls-stock-screener/scripts/ls_screener.py
```

### 실행 환경 요구 조건

- Python 3.8+
- 패키지: `requests`, `pandas`, `numpy`
- `.env` 파일 설정:
  ```env
  LS_APP_KEY=발급받은_App_Key
  LS_SECREAT=발급받은_App_Secret
  ```

---

## 3. 출력 데이터 구조 (`watchlist.csv` / `watchlist.json`)

| 필드명             | 타입    | 설명                          |
| ------------------ | ------- | ----------------------------- |
| `industry`         | String  | 소속 유망 업종명              |
| `shcode`           | String  | 단축 종목 코드 (예: `005930`) |
| `name`             | String  | 종목명                        |
| `close`            | Number  | 현재 종가                     |
| `psy`              | Number  | 심리선 지수 (%)               |
| `bb_lower`         | Number  | 볼린저밴드 하단값             |
| `ma5`              | Number  | 5일 이동평균선                |
| `ma20`             | Number  | 20일 이동평균선               |
| `ma60`             | Number  | 60일 이동평균선               |
| `macd_hist`        | Number  | MACD 오실레이터 히스토그램 값 |
| `rsi`              | Number  | RSI 상대강도지수 (14일)       |
| `volume_ratio`     | Number  | 전일 대비 거래량 비율 (%)     |
| `bullish_divergence`| Boolean | MACD/RSI 상승 다이버전스 발생 유무 |
| `is_fully_matched` | Boolean | 6가지 핵심 기술적 조건(심리선+볼린저+이평선+MACD+RSI+거래량) **6/6 전체 충족 여부** (`true`: 6가지 모두 완전 충족, `false`: 일부 조건만 충족) |
| `updated_at`       | String  | 스크리닝 실행 일시            |

---

## 4. UI 연동 (`index.html`)

`index.html` 웹 대시보드에 스크리너 상태 카드 및 관심종목 렌더링 컴포넌트가 연동되어 있어, 스크리닝 결과가 실시간 시각화됩니다.
