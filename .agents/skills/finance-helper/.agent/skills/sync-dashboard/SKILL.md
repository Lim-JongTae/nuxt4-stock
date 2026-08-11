---
name: sync-dashboard
description: 생성된 JSON 리포트 데이터를 대시보드용 JavaScript 파일(data.js)로 동기화합니다.
---

# Sync Dashboard

생성된 JSON 리포트 데이터를 대시보드용 JavaScript 파일(`dashboard/data.js`)로 동기화합니다. 이를 통해 서버 없이도 대시보드에서 최신 데이터를 확인할 수 있습니다.

## When to use this skill

- `report/YYYY-MM-DD.json` 파일이 생성되거나 수정되었을 때
- 대시보드 데이터를 최신 리포트 기준으로 업데이트하고 싶을 때

## How to use it

1. 가장 최근에 생성된 `report/YYYY-MM-DD.json` 파일을 식별합니다.
2. 기존 `dashboard/data.js` 파일의 `const REPORTS_HISTORY = [...];` 배열 내용을 읽어옵니다.
3. 새로운 리포트 데이터가 이미 배열에 존재하는지 날짜(date)로 확인합니다.
4. 존재하지 않는다면 배열에 추가하고, 존재한다면 해당 날짜의 데이터를 업데이트합니다.
5. 최종 배열을 `const REPORTS_HISTORY = [ ... ];` 형식의 문자열로 변환하여 `dashboard/data.js` 파일에 덮어씁니다.
6. 작업 완료 후 대시보드의 데이터 히스토리에 새로운 리포트가 성공적으로 통합되었음을 보고합니다.
