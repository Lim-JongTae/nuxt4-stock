# Finance Helper 📈

맞춤형 주식 분석 및 리포팅 시스템입니다. 
주요 종목의 데이터를 분석하고, 최신 차트를 캡처하여 프리미엄 대시보드 형태로 제공합니다.

[![Finance Helper 프로젝트 소개 영상](https://img.youtube.com/vi/24RQgvNhTaE/0.jpg)](https://youtu.be/24RQgvNhTaE)

> 📺 [유튜브에서 프로젝트 소개 영상 보기](https://youtu.be/24RQgvNhTaE)

## 🚀 시작하기

이 프로젝트를 자신의 환경에 맞게 설정하려면 다음 단계를 따르세요:

1. **설정 파일 복사**:
   ```bash
   cp 종목.sample.md 종목.md
   cp dashboard/data.sample.js dashboard/data.js
   ```

2. **종목 관리**:
   `종목.md` 파일을 열어 자신의 보유 종목과 관심 종목 정보(종목명, 평단가, 종목ID)를 입력합니다.

3. **리포트 생성**:
   준비된 AI 에이전트(Antigravity 등)에게 리포트 생성을 요청합니다.

## ✨ 주요 기능

- **자동 주식 리포트 생성**: `report` 스킬을 사용하여 보유 종목 및 관심 종목의 투자 의견, 기술적 분석 정보를 포함한 JSON 리포트를 생성합니다.
- **실시간 차트 캡처**: `toss-capture` 스킬을 통해 토스증권의 실시간 차트를 자동으로 캡처하여 리포트에 통합합니다.
- **데이터 자동 동기화**: `sync-dashboard` 스킬을 사용하여 생성된 리포트 데이터를 대시보드 데이터(`data.js`)로 즉시 동기화합니다.
- **프리미엄 정적 대시보드**: 별도의 서버 설치 없이 웹 브라우저에서 즉시 확인할 수 있는 정적 HTML 대시보드를 제공합니다.
- **보안 및 효율성**: `data.js`를 이용한 데이터 내부화로 CORS 문제 없이 로컬 환경에서 완벽하게 동작합니다.

## 📂 프로젝트 구조

```text
financehelper/
├── dashboard/          # 대시보드 웹 소스 코드
│   ├── index.html     # 대시보드 메인 페이지
│   ├── style.css      # 프리미엄 디자인 스타일시트
│   ├── script.js      # 대시보드 렌더링 로직
│   └── data.js        # 대시보드용 데이터 (자동 업데이트됨)
├── report/             # 생성된 리포트 및 이미지 (Git 관리 제외)
│   ├── YYYY-MM-DD.json
│   └── images/
├── .agent/             # AI 에이전트 전용 스킬 및 설정
├── .gitignore          # 리포트 등 개인 데이터 제외 설정
├── 종목.md             # 보유/관심 종목 리스트 관리
└── README.md           # 프로젝트 가이드 (현재 파일)
```

## 🚀 사용법

### 1. 종목 관리
`종목.md` 파일에 보유 종목과 관심 종목을 업데이트합니다. (최초 실행 시 `종목.sample.md`를 복사하여 생성하세요.)

### 2. 리포트 생성
AI 에이전트에게 리포트 생성을 요청합니다. 에이전트는 자동으로 다음 작업을 수행합니다:
1. 주식 정보 분석 및 `report/YYYY-MM-DD.json` 생성
2. 종목별 토스증권 차트 캡처 및 이미지 저장
3. `dashboard/data.js` 파일 업데이트

### 3. 대시보드 확인
`dashboard/index.html` 파일을 웹 브라우저로 엽니다. (더블 클릭)
> [!TIP]
> 본 프로젝트는 정적 페이지로 구성되어 있어 별도의 웹 서버 실행이 필요하지 않습니다.

## 🛠 기술 스택

- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), JavaScript (ES6+)
- **Analysis**: Google Deepmind Advanced Agentic Coding
- **Data Source**: Toss Securities (Chart Capture)

---
© 2026 Finance Helper - Crafted for Investors
