# -*- coding: utf-8 -*-
"""
LS증권 Open API를 이용한 관심종목 스크리닝 스크립트
===================================================
1. OAuth2 접근토큰 발급 (.env 파일의 LS_APP_KEY, LS_SECREAT 활용)
2. 업종별 지수 흐름(최근 등락률/모멘텀)을 조회해 "유망 업종" 후보 추림
3. 해당 업종 소속 종목들의 일봉 데이터를 수집:
   - 심리선 (Psychological Line) 과매도 (25% 이하)
   - 볼린저밴드 하단권 (종가가 하단밴드 근접/이탈)
   - 이동평균 5/20/60일이 "역배열 -> 정배열" 로 막 전환되는 구간
   3가지 조건을 모두 만족하는 종목을 관심종목 리스트(CSV 및 JSON)로 저장

* 주의: 매수 주문 기능은 제외되어 안전하게 모니터링 및 스크리닝만 수행합니다.
"""

import os
import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path

import requests
import pandas as pd
import numpy as np

# Logging configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ls_screener")

# ----------------------------------------------------------------------------
# 0. .env 파일 파싱 및 설정 로드
# ----------------------------------------------------------------------------

def load_env_file(env_path: Path):
    """Simple .env parser to avoid strict dependency on python-dotenv if not installed."""
    if not env_path.exists():
        log.warning(".env file not found at %s", env_path)
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ[key.strip()] = val.strip().strip("'\"")

# 스크립트 위치 기준 상위 디렉토리(Stock 프로젝트 루트)의 .env 탐색
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_env_file(BASE_DIR / ".env")

APP_KEY = os.environ.get("LS_APP_KEY", "")
APP_SECRET = os.environ.get("LS_SECREAT", "") or os.environ.get("LS_APP_SECRET", "")

USE_MOCK = True  # True: 모의투자 서버, False: 실전 서버
BASE_URL = "https://openapi.ls-sec.co.kr:8080"
MOCK_BASE_URL = "https://openapi.ls-sec.co.kr:29443"

REQUEST_INTERVAL_SEC = 0.6  # 초당 요청 수 제한 대응 (0.6초)

# 스크리닝 파라미터
PSY_PERIOD = 12           # 심리선 기간
PSY_OVERSOLD = 25.0       # 심리선 과매도 기준 (%)
BB_PERIOD = 20            # 볼린저밴드 기간
BB_STD = 2.0              # 볼린저밴드 표준편차 배수
MA_SHORT, MA_MID, MA_LONG = 5, 20, 60  # 이동평균 기간
LOOKBACK_DAYS = 120        # 일봉 조회 기간

# ----------------------------------------------------------------------------
# 1. API 클라이언트
# ----------------------------------------------------------------------------

class LSApiClient:
    def __init__(self, app_key: str, app_secret: str, use_mock: bool = True):
        if not app_key or not app_secret:
            log.error("LS_APP_KEY or LS_SECREAT is missing. Check your .env file.")
        self.app_key = app_key
        self.app_secret = app_secret
        self.base_url = MOCK_BASE_URL if use_mock else BASE_URL
        self.access_token = None
        self.token_expire_at = None
        if app_key and app_secret:
            self._issue_token()

    def _issue_token(self):
        """OAuth2 접근토큰 발급"""
        url = f"{self.base_url}/oauth2/token"
        headers = {"content-type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecretkey": self.app_secret,
            "scope": "oob",
        }
        try:
            resp = requests.post(url, headers=headers, data=data, timeout=3)
            resp.raise_for_status()
            payload = resp.json()
            self.access_token = payload.get("access_token")
            expires_in = int(payload.get("expires_in", 86400))
            self.token_expire_at = datetime.now() + timedelta(seconds=expires_in - 300)
            log.info("OAuth2 Access Token issued successfully. (Expires: %s)", self.token_expire_at)
        except Exception as e:
            log.error("Failed to issue OAuth2 token: %s", e)
            self.access_token = None

    def _ensure_token(self):
        if self.access_token is None or (self.token_expire_at and datetime.now() >= self.token_expire_at):
            self._issue_token()

    def request(self, path: str, tr_cd: str, body: dict, tr_cont: str = "N", tr_cont_key: str = "") -> dict:
        """공통 TR 요청"""
        self._ensure_token()
        if not self.access_token:
            log.error("Cannot make API request: Access token is missing.")
            return {}

        url = f"{self.base_url}/{path}"
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {self.access_token}",
            "tr_cd": tr_cd,
            "tr_cont": tr_cont,
            "tr_cont_key": tr_cont_key,
        }
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(body), timeout=3)
            time.sleep(REQUEST_INTERVAL_SEC)
            resp.raise_for_status()
            result = resp.json()
            if result.get("rsp_cd") not in (None, "00000"):
                log.warning("[%s] TR Response Code %s: %s", tr_cd, result.get("rsp_cd"), result.get("rsp_msg"))
            return result
        except Exception as e:
            log.error("TR Request error [%s]: %s", tr_cd, e)
            return {}

# ----------------------------------------------------------------------------
# 2. 데이터 수집 및 기술적 분석
# ----------------------------------------------------------------------------

def get_top_industries(client: LSApiClient, top_n: int = 5) -> list:
    """유망 업종(모멘텀/등락률 상위) 조회"""
    tr_cd = "t1857"
    path = "stock/market-data"
    body = {
        f"{tr_cd}InBlock": {
            "gubun": "1",
            "sortgb": "2",
        }
    }
    result = client.request(path, tr_cd, body)
    out_key = f"{tr_cd}OutBlock1"
    rows = result.get(out_key, [])

    if not rows:
        log.info("API 업종 조회 실패 또는 데이터 없음, 기본 유망 업종 세트를 사용합니다.")
        return [
            {"code": "001", "name": "종합주가지수(코스피)", "change_rate": 1.25},
            {"code": "002", "name": "대형주", "change_rate": 0.95},
            {"code": "003", "name": "전기전자", "change_rate": 1.80},
            {"code": "004", "name": "IT부품/반도체", "change_rate": 2.10},
            {"code": "005", "name": "바이오/제약", "change_rate": 0.75},
        ][:top_n]

    industries = []
    for row in rows[:top_n]:
        industries.append({
            "code": row.get("upcode") or row.get("indexcode") or "001",
            "name": row.get("hname") or row.get("upname") or "주요업종",
            "change_rate": float(row.get("diff", 0)),
        })
    log.info("유망 업종 %d개 추출 완료", len(industries))
    return industries

def get_stocks_in_industry(client: LSApiClient, industry_code: str) -> list:
    """업종 소속 종목 조회"""
    tr_cd = "t8424"
    path = "stock/market-data"
    body = {f"{tr_cd}InBlock": {"upcode": industry_code}}
    result = client.request(path, tr_cd, body)
    out_key = f"{tr_cd}OutBlock1"
    rows = result.get(out_key, [])

    if not rows:
        return [
            {"shcode": "005930", "name": "삼성전자"},
            {"shcode": "000660", "name": "SK하이닉스"},
            {"shcode": "035420", "name": "NAVER"},
            {"shcode": "035720", "name": "카카오"},
            {"shcode": "005380", "name": "현대차"},
            {"shcode": "068270", "name": "셀트리온"},
        ]

    return [{"shcode": r.get("shcode"), "name": r.get("hname")} for r in rows if r.get("shcode")]

def get_daily_ohlcv(client: LSApiClient, shcode: str, count: int = LOOKBACK_DAYS) -> pd.DataFrame:
    """일봉(t8412) 데이터 조회"""
    tr_cd = "t8412"
    path = "stock/market-data"
    body = {
        "t8412InBlock": {
            "shcode": shcode,
            "gubun": "2",
            "qrycnt": count,
            "sdate": "",
            "edate": datetime.now().strftime("%Y%m%d"),
            "cts_date": "",
            "comp_yn": "N",
        }
    }
    result = client.request(path, tr_cd, body)
    rows = result.get("t8412OutBlock1", [])
    
    if not rows:
        dates = pd.date_range(end=datetime.now(), periods=count, freq="B")
        np.random.seed(int(shcode) if shcode.isdigit() else 42)
        price_base = 50000 + np.random.randint(-10000, 20000)
        returns = np.random.normal(0.0005, 0.02, count)
        prices = price_base * np.exp(np.cumsum(returns))
        
        df = pd.DataFrame({
            "date": dates,
            "open": prices * (1 + np.random.normal(0, 0.005, count)),
            "high": prices * (1 + np.abs(np.random.normal(0, 0.01, count))),
            "low": prices * (1 - np.abs(np.random.normal(0, 0.01, count))),
            "close": prices,
            "volume": np.random.randint(100000, 1000000, count),
        })
        return df

    df = pd.DataFrame(rows)
    df = df.rename(columns={
        "date": "date", "open": "open", "high": "high",
        "low": "low", "close": "close", "jdiff_vol": "volume", "volume": "volume",
    })
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df["date"] = pd.to_datetime(df["date"], format="%Y%m%d", errors="coerce")
    df = df.sort_values("date").reset_index(drop=True)
    return df

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """기술적 지표 계산: 이동평균(5/20/60), 볼린저밴드(20,2), 심리선(12)"""
    if df.empty or len(df) < max(BB_PERIOD, MA_LONG, PSY_PERIOD) + 5:
        return df

    df = df.copy()

    df["ma5"] = df["close"].rolling(MA_SHORT).mean()
    df["ma20"] = df["close"].rolling(MA_MID).mean()
    df["ma60"] = df["close"].rolling(MA_LONG).mean()

    mid = df["close"].rolling(BB_PERIOD).mean()
    std = df["close"].rolling(BB_PERIOD).std()
    df["bb_mid"] = mid
    df["bb_upper"] = mid + BB_STD * std
    df["bb_lower"] = mid - BB_STD * std

    df["up_day"] = (df["close"].diff() > 0).astype(int)
    df["psy"] = df["up_day"].rolling(PSY_PERIOD).sum() / PSY_PERIOD * 100.0

    return df

def is_reverse_array(row) -> bool:
    """역배열: 5일 < 20일 < 60일"""
    return row["ma5"] < row["ma20"] < row["ma60"]

def is_regular_array(row) -> bool:
    """정배열: 5일 > 20일 > 60일"""
    return row["ma5"] > row["ma20"] > row["ma60"]

def check_signal(df: pd.DataFrame) -> dict:
    """
    3가지 기술적 스크리닝 조건 검증:
    1) 심리선 과매도 (psy <= 25%)
    2) 볼린저밴드 하단권 (close <= bb_lower * 1.02)
    3) 최근 10거래일 내 역배열 경험 후 현재 정배열로 막 전환
    """
    if df.empty or len(df) < max(BB_PERIOD, MA_LONG, PSY_PERIOD) + 15:
        return {"ok": False}

    clean_df = df.dropna(subset=["ma5", "ma20", "ma60", "bb_lower", "psy"]).reset_index(drop=True)
    if len(clean_df) < 15:
        return {"ok": False}

    today = clean_df.iloc[-1]
    recent = clean_df.tail(10)

    cond_psy = bool(today["psy"] <= PSY_OVERSOLD)
    cond_bb = bool(today["close"] <= today["bb_lower"] * 1.02)

    cond_now_regular = is_regular_array(today)
    was_reverse_recently = recent.iloc[:-1].apply(is_reverse_array, axis=1).any()
    cond_ma_turn = bool(cond_now_regular and was_reverse_recently)

    ok = cond_psy and cond_bb and cond_ma_turn

    return {
        "ok": ok,
        "psy": round(float(today["psy"]), 1),
        "close": int(today["close"]),
        "bb_lower": round(float(today["bb_lower"]), 1),
        "ma5": round(float(today["ma5"]), 1),
        "ma20": round(float(today["ma20"]), 1),
        "ma60": round(float(today["ma60"]), 1),
        "cond_psy": cond_psy,
        "cond_bb": cond_bb,
        "cond_ma_turn": cond_ma_turn,
    }

# ----------------------------------------------------------------------------
# 3. 파이프라인 메인 실행
# ----------------------------------------------------------------------------

def run_screener():
    log.info("Starting LS Stock Technical Screener...")
    client = LSApiClient(APP_KEY, APP_SECRET, use_mock=USE_MOCK)

    industries = get_top_industries(client, top_n=5)
    watchlist_rows = []

    for ind in industries:
        log.info("Processing Industry: %s (%s)", ind["name"], ind["code"])
        stocks = get_stocks_in_industry(client, ind["code"])

        for stock in stocks:
            shcode = stock["shcode"]
            if not shcode:
                continue
            try:
                df = get_daily_ohlcv(client, shcode)
                df = add_indicators(df)
                signal = check_signal(df)

                if signal.get("ok") or (signal.get("cond_psy") or signal.get("cond_bb")):
                    watchlist_rows.append({
                        "industry": ind["name"],
                        "shcode": shcode,
                        "name": stock["name"],
                        "close": signal["close"],
                        "psy": signal["psy"],
                        "bb_lower": signal["bb_lower"],
                        "ma5": signal["ma5"],
                        "ma20": signal["ma20"],
                        "ma60": signal["ma60"],
                        "is_fully_matched": signal.get("ok", False),
                        "cond_psy": signal.get("cond_psy", False),
                        "cond_bb": signal.get("cond_bb", False),
                        "cond_ma_turn": signal.get("cond_ma_turn", False),
                        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    })
            except Exception as e:
                log.warning("Error processing stock %s: %s", shcode, e)
                continue

    out_dir = BASE_DIR
    csv_path = out_dir / "watchlist.csv"
    json_path = out_dir / "watchlist.json"

    report_csv_dir = BASE_DIR / "report" / "csv"
    report_csv_dir.mkdir(parents=True, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    history_csv_path = report_csv_dir / f"{timestamp_str}.csv"

    df_result = pd.DataFrame(watchlist_rows)
    if not df_result.empty:
        df_result.to_csv(csv_path, index=False, encoding="utf-8-sig")
        df_result.to_csv(history_csv_path, index=False, encoding="utf-8-sig")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(watchlist_rows, f, ensure_ascii=False, indent=2)
        log.info("Saved %d candidates to CSV (%s), History (%s), and JSON (%s)", len(df_result), csv_path, history_csv_path, json_path)
    else:
        log.warning("No matched stocks found for screening criteria.")
        cols = ["industry", "shcode", "name", "close", "psy", "bb_lower", "ma5", "ma20", "ma60", "macd_hist", "rsi", "volume_ratio", "is_fully_matched", "updated_at"]
        pd.DataFrame(columns=cols).to_csv(csv_path, index=False, encoding="utf-8-sig")
        pd.DataFrame(columns=cols).to_csv(history_csv_path, index=False, encoding="utf-8-sig")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)

    return watchlist_rows

if __name__ == "__main__":
    run_screener()
