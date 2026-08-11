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

### 3.2 관심종목/보유종목 차트 및 지표 데이터 조회 (`t8413` / `t8412`)
- **설명**: 이동평균선(5일, 20일), RSI(14), 볼린저 밴드(상/중/하단), 변동성 지수를 산출하기 위한 일봉/분봉 차트 데이터 수집.

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
