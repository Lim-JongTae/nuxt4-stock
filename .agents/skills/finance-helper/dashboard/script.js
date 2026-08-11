document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('date-selector');
    
    if (typeof REPORTS_HISTORY !== 'undefined' && REPORTS_HISTORY.length > 0) {
        // 셀렉트 박스 옵션 동적으로 채우기
        REPORTS_HISTORY.forEach((report, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = report.date.replace(/-/g, '. ');
            selector.appendChild(option);
        });

        // 가장 최신 데이터(배열의 마지막)를 기본값으로 설정
        const latestIndex = REPORTS_HISTORY.length - 1;
        selector.value = latestIndex;
        renderDashboard(REPORTS_HISTORY[latestIndex]);

        // 날짜 선택 이벤트 리스너
        selector.addEventListener('change', (e) => {
            const selectedIndex = e.target.value;
            renderDashboard(REPORTS_HISTORY[selectedIndex]);
            
            // 변경 시 간단한 애니메이션 효과
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                card.style.animation = 'none';
                card.offsetHeight; // 트리거 리플로우
                card.style.animation = 'fadeInUp 0.5s ease-out backwards';
            });
        });
    } else {
        console.error('REPORTS_HISTORY를 찾을 수 없습니다.');
        document.querySelector('header').innerHTML += `<p style="color: #fb7185; margin-top: 1rem;">보고서 데이터를 찾을 수 없습니다. data.js 파일이 정상적으로 로드되었는지 확인해 주세요.</p>`;
    }
});

function renderDashboard(data) {
    // 헤더 개요 업데이트
    document.getElementById('report-overview').textContent = data.overview;

    // 보유 종목 렌더링
    const holdingsList = document.querySelector('#holdings-list');
    holdingsList.innerHTML = '';
    
    if (data.holdings.length > 0) {
        data.holdings.forEach(stock => {
            const isUp = stock.return.startsWith('+');
            const stockItem = `
                <div class="stock-item">
                    <div class="stock-info">
                        <div class="name">${stock.name}</div>
                        <div class="price">평단: ${stock.avgPrice} / 현재: ${stock.currentPrice}</div>
                    </div>
                    <div class="stock-status">
                        <div class="return ${isUp ? 'up' : 'down'}">${stock.return}</div>
                        <span class="badge ${stock.advice.includes('HOLD') ? 'hold' : 'buy'}">${stock.advice}</span>
                    </div>
                    <div class="reason-text">
                        ${stock.reason.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                    </div>
                    ${stock.image ? `
                    <div class="chart-container">
                        <img src="../${stock.image}" alt="${stock.name} 차트" class="stock-chart" onclick="window.open(this.src)">
                        <div class="chart-label">실시간 차트 분석 (Toss)</div>
                    </div>` : ''}
                </div>
            `;
            holdingsList.innerHTML += stockItem;
        });
    } else {
        holdingsList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">보유 종목 데이터가 없습니다.</p>';
    }

    // 관심 종목 렌더링
    const watchlistList = document.querySelector('#watchlist-list');
    watchlistList.innerHTML = '';
    
    if (data.watchlist.length > 0) {
        data.watchlist.forEach(stock => {
            const stockItem = `
                <div class="stock-item">
                    <div class="stock-info">
                        <div class="name">${stock.name}</div>
                        <div class="price">현재가: ${stock.currentPrice} / 전망: ${stock.outlook}</div>
                    </div>
                    <div class="stock-status">
                        <span class="badge buy">${stock.advice}</span>
                    </div>
                    <div class="reason-text">
                        ${stock.reason.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
                    </div>
                    ${stock.image ? `
                    <div class="chart-container">
                        <img src="../${stock.image}" alt="${stock.name} 차트" class="stock-chart" onclick="window.open(this.src)">
                        <div class="chart-label">실시간 차트 분석 (Toss)</div>
                    </div>` : ''}
                </div>
            `;
            watchlistList.innerHTML += stockItem;
        });
    } else {
        watchlistList.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem;">관심 종목 데이터가 없습니다.</p>';
    }

    // 종합 조언 렌더링
    const adviceText = document.querySelector('.advice-text');
    adviceText.innerHTML = `
        <p style="margin-bottom: 1rem;"><strong>📌 매수 추천:</strong> ${data.strategy.buy}</p>
        <p style="margin-bottom: 1rem;"><strong>⚠️ 매도 고려:</strong> ${data.strategy.sellConsider}</p>
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            ${data.strategy.summary.replace(/현대차|로봇|AI 반도체|마이크로소프트|앤비디아|삼성전자|SK하이닉스/g, '<strong>$&</strong>')}
        </div>
    `;
}
