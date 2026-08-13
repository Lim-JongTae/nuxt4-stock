# 📘 LS증권 OPEN API 가이드 및 사양서

본 문서는 LS증권 OPEN API 가이드를 학습하여 작성된 개발 및 호출 연동 사양서입니다.

---

## 1. 기본 정보 및 인증 (Authentication)

- **API 서비스 URL**: `https://openapi.ls-sec.co.kr`
- **인증 방식**: OAuth 2.0 (Client Credentials Grant)
- **환경 변수 (`.env`)**:
  - `LS_APP_KEY`: App Key (`PSxqiyZfJsMtqWtGp4EiVY5xqsCJANkJb8y7`)
  - `LS_SECREAT`: App Secret Key (`0NBTDo5J2k7HvS4HYttPoBtcVJIvI6BQ`)

### 🔑 접근 토큰 (Access Token) 발급 API
- **HTTP Method & URL**: `POST https://openapi.ls-sec.co.kr/oauth2/token`
- **Headers**: `Content-Type: application/x-www-form-urlencoded`
- **Request Body Parameters**:
  - `grant_type`: `client_credentials`
  - `appkey`: `${LS_APP_KEY}`
  - `appsecretkey`: `${LS_SECREAT}`

- **Response Example**:
```json
{
  "access_token": "Bearer_Access_Token_Value...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "oob"
}
```

---

## 2. API 호출 공통 헤더 (Common Request Headers)

| Header Field | Type | Description | Required |
| :--- | :--- | :--- | :---: |
| `authorization` | String | `Bearer {access_token}` | 필수 |
| `content-type` | String | `application/json; charset=utf-8` | 필수 |
| `tr_cd` | String | 서비스 거래 코드 (Transaction Code) | 필수 |
| `tr_cont` | String | 연속 거래 여부 (`Y`: 다음 데이터 있음, `N`: 단건) | 필수 |
| `tr_cont_key` | String | 연속 거래 조회 키 | 선택 |
| `mac_address` | String | 사용자 MAC 주소 | 선택 |

---

## 3. 주요 거래 코드 (Tr Code) 및 데이터 명세

### 3.1 국내주식 현재가/시세 조회 (`t1102`)
- **설명**: 종목별 시세, 이동평균선 기반 가격 데이터, 일별 거래량 및 변동성 정보 수집.
- **Request**:
  - `shcode`: 종목코드 (예: `0186L0`, `0167Z0`)
- **Response Output**:
  - `price`: 현재가
  - `diff`: 전일대비
  - `rate`: 등락율
  - `volume`: 누적 거래량
  - `jandiff`: 변동성 지표 관련 잔량 차이

### 3.2 국내주식 통합시세 기간별주가 조회 (`t1305` - 표준 시세 엔진)
- **Method**: `POST` | **Domain**: `https://openapi.ls-sec.co.kr:8080` | **URL**: `/stock/market-data`
- **설명**: HTS 상단 **"통" (통합시세 = KRX 정규장 + NXT 대체거래소)** 화면 수치와 100% 동일하게 일자별 시가, 고가, 저가, 종가(`close`), 거래량, 전일대비, 등락율을 수집하는 백엔드 표준 시세 수집 TR.
- **Request InBlock (`t1305InBlock`)**:
  - `shcode`: 단축종목코드 6자리 (예: `035420`)
  - `dwmcode`: `1` (1:일봉, 2:주봉, 3:월봉)
  - `date`: `""` (처음 조회시 빈 문자열)
  - `idx`: `0`
  - `cnt`: `15` (수집 일수)
  - `exchgubun`: **`"U"` (★ 핵심: KRX + NXT 통합 거래소 시세 파라미터)**
- **Response OutBlock (`t1305OutBlock1`)**:
  - `date`: 날짜 (YYYYMMDD)
  - `open`: 시가
  - `high`: 고가
  - `low`: 저가
  - `close`: 종가 (HTS 체결 종가 100% 일치)
  - `volume`: 누적 거래량 (통합 체결량)
  - `change`: 전일대비
  - `diff`: 등락율

### 3.3 관심종목/보유종목 차트 및 지표 데이터 조회 (`t8413` / `t8412`)
- **설명**: 이동평균선(5일, 20일), RSI(14), 볼린저 밴드(상/중/하단), 변동성 지수를 산출하기 위한 일봉/분봉 차트 데이터 수집.

### 3.3 업종별 시세 및 기간별 추이 조회 (`/indtp/market-data`)
- **Method**: `POST` | **Domain**: `https://openapi.ls-sec.co.kr:8080` | **URL**: `/indtp/market-data`
- **주요 TR**: `t8424` (전체업종), `t1514` (업종기간별추이), `t1511` (업종현재가), `t1516` (업종별종목시세), `t1485` (예상지수)

### 3.4 [주식] 종목검색 서비스 (`/stock/item-search`)
- **Method**: `POST` | **Domain**: `https://openapi.ls-sec.co.kr:8080` | **URL**: `/stock/item-search`
- **주요 TR**: `t1866` (서버조건리스트), `t1859` (서버조건검색), `t1860` (실시간검색), `t1856` (파일검색)

### 3.5 종목별 기타 정보 및 공매도 서비스 (`/stock/etc`)
- **Method**: `POST` | **Domain**: `https://openapi.ls-sec.co.kr:8080` | **URL**: `/stock/etc`
- **주요 TR**: `t1927` (공매도일별추이), `t1941` (대차거래추이), `t1921` (신용거래동향)

### 3.6 [선물/옵션] 시세 및 시장 방향성 서비스 (`/futureoption/market-data`)
- **Method**: `POST`
- **Domain**: `https://openapi.ls-sec.co.kr:8080`
- **URL**: `/futureoption/market-data`
- **Content-Type**: `application/json; charset=UTF-8`
- **설명**: 주간/야간 선물옵션 종목별 시세, 미결제약정(OI), 베이시스 및 옵션전광판 등 시장 방향성 지표 데이터를 수집할 수 있습니다.
- **주요 TR 명세**:

| TR명 | TR코드 | 초당 전송 건수 | 용도 및 스크리닝 활용 방안 |
| :--- | :---: | :---: | :--- |
| **선물/옵션현재가(시세)조회** | `t2111` | 10건 | KOSPI200 선물/옵션 현재가 및 선물 베이시스(콘탱고/백워데이션) 측정 |
| **미결제약정추이** | `t2424` | 1건 | 선물 미결제약정(OI) 증감 추이 분석 (신규 매수 vs 숏커버링 판단) |
| **옵션전광판** | `t2301` | 2건 | VKOSPI(변동성지수) 및 Put/Call Ratio(풋콜 비중) 측정 |
| **선물옵션시간대별체결조회**| `t2212` | 2건 | 선물 시간대별 체결 및 외국인 선물 순매수 동향 추적 |
| **선물옵션호가잔량비율챠트**| `t2407` | 1건 | 선물 호가 잔량 및 차익/비차익 프로그램 매매 동향 분석 |
| **지수선물마스터조회API용** | `t8467` | 2건 | KOSPI200 지수 선물 마스터 정보 수집 |
| **지수옵션마스터조회API용** | `t8433` | 2건 | KOSPI200 지수 옵션 마스터 정보 수집 |
| **선물/옵션멀티현재가조회** | `t8434` | 3건 | 선물/옵션 멀티 시세 동시 수집 |





---

## 4. 💰 LS증권 OPEN API 무료 한도 및 수수료/호출 제한 명세

### 4.1 이용 수수료 및 비용
- **API 기본 이용료**: **100% 무료** (Open API 사용 신청, 시세 조회 및 주문 기능 이용 시 별도 월 사용료나 가입비 없음)
- **거래 수수료 할인 혜택**: Open API를 통한 전용 거래 시 할인된 이벤트/우대 수수료 적용
  - 국내 상장 ETF/ETN: 기존 0.015% → **0.005%** 우대 수수료
  - 국내 주식 선물: 기존 0.004% → **0.002%** 우대 수수료

### 4.2 호출 제한 (TR Rate Limit) 및 무료 한도
- **초당 호출 처리 한도**:
  - 증권사 시스템 과부하 방지를 위한 초당 TR(Transaction) 호출 횟수 제한 적용.
  - 최근 API 인프라 고도화로 **초당 호출 가능 건수를 기존 대비 약 3배 대폭 확대**하여 안정적이고 유연한 시세 수집 및 자동매매 환경 제공.
- **주요 TR별 제한 가이드**:
  - **일반 조회 TR (`t1102`, `t8413` 등)**: 초당 2~5건 내외 (조회 TR 종류별 세부 제한 준수).
  - **실시간 시세 (WebSocket / Real TR)**: 최대 40~50개 종목 실시간 호가/체결 데이터 무료 구독 가능.
- **토큰(Access Token) 유효 기간**:
  - 발급 시 **24시간** 유효 (익일 07시까지 사용 가능하며 만료 시 자동 재발급).

---

## 5. 모니터링 및 주의사항
1. **Token 재발급 관리**: 발급된 Access Token은 유효기간(24시간) 동안 재사용하며, 만료 시 자동 재발급 로직을 적용합니다.
2. **호출 제한 (TR Rate Limit)**: 초당/분당 TR 호출 제한 건수를 준수하여 안전하게 데이터를 수집합니다.
3. **분석 표기**: LS증권 API 및 데이터를 활용한 분석 결과에는 **`LS증권`** 항목으로 명확히 표기합니다.
