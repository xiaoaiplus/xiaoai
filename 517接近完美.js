// ==UserScript==
// @name         电竞今日比赛数据采集器518
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  获取电竞网站的今日比赛数据，实时显示队伍名称和赔率
// @author       Trae AI
// @match        https://imes-0hloh.takatakz.xyz/esportsitev2/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('电竞今日比赛数据采集器已启动');

    // 存储收集到的数据
    let collectedData = {
        matches: [],
        lastUpdate: null
    };

    // 自动下注状态
    let autoBetActive = false;
    let autoBetInterval = null;

    // 默认设置
    let userSettings = {
        refreshInterval: 20, // 默认20秒刷新一次赔率
        oddsMin: 1.5, // 默认最小赔率
        oddsMax: 3.0, // 默认最大赔率
        betHighWinRate: true, // 默认下注胜率高的一方
        betLowWinRate: false, // 默认不下注胜率低的一方（打勾后开启反向下注）
        prioritizeLiveMatches: true, // 默认优先下注进行中的赛事（此设置始终为true且不可关闭）
        betUpcomingMatches: false, // 默认不下注即将开始的赛事
        betAmount: 10, // 默认下注金额
        autoBetInterval: 30 // 自动下注间隔（秒）
    };

    // 创建投注记录弹窗
    function createBetRecordsPopup() {
        // 检查是否已存在弹窗
        let betRecordsPopup = document.getElementById('bet-records-popup');
        if (betRecordsPopup) return betRecordsPopup;

        // 创建弹窗
        betRecordsPopup = document.createElement('div');
        betRecordsPopup.id = 'bet-records-popup';

        // 添加连接线样式
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            #bet-records-popup::before {
                content: '';
                position: absolute;
                top: 30px;
                left: -5px;
                width: 10px;
                height: 40px;
                background-color: #2e7d32;
                border-radius: 5px 0 0 5px;
                z-index: 9998;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            #bet-records-popup.visible::before {
                opacity: 1;
            }
        `;
        document.head.appendChild(styleElement);
        betRecordsPopup.style.cssText = `
            position: fixed;
            top: 20px;
            left: -420px; /* 初始状态隐藏在左侧 */
            width: 420px;
            max-height: 600px;
            background-color: rgba(255, 255, 255, 0.95);
            color: #333333;
            z-index: 9999; /* 比主界面低一点，确保主界面在上层 */
            border-radius: 12px;
            padding: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            overflow: hidden;
            box-shadow: 0 0 25px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            border: 1px solid rgba(200, 200, 200, 0.8);
            border-left: 3px solid #2e7d32; /* 左侧边框颜色与主界面标题颜色一致 */
            backdrop-filter: blur(8px);
            display: flex;
            flex-direction: column;
        `;

        // 添加标题
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px;
            background: linear-gradient(to right, #f0f0f0, #e0e0e0);
            border-bottom: 1px solid #dddddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            border-radius: 8px 8px 0 0;
            position: relative;
        `;
        header.innerHTML = '<h4 style="margin: 0; color: #2e7d32; text-shadow: 0 0 5px rgba(46,125,50,0.2);">投注记录</h4>';
        betRecordsPopup.appendChild(header);

        // 投注记录弹窗不需要最小化按钮和刷新按钮，只使用主界面的控制

        // 添加投注记录内容容器
        const recordsContent = document.createElement('div');
        recordsContent.id = 'bet-records-container';
        recordsContent.style.cssText = `
            max-height: 500px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #bbbbbb #f0f0f0;
            padding: 10px;
            background-color: rgba(240, 240, 240, 0.6);
            border-radius: 8px;
            border: 1px solid rgba(200, 200, 200, 0.4);
            flex: 1;
        `;
        betRecordsPopup.appendChild(recordsContent);

        // 添加自定义滚动条样式
        const style = document.createElement('style');
        style.textContent = `
            #bet-records-container::-webkit-scrollbar {
                width: 6px;
            }
            #bet-records-container::-webkit-scrollbar-track {
                background: #f0f0f0;
                border-radius: 4px;
            }
            #bet-records-container::-webkit-scrollbar-thumb {
                background-color: #bbbbbb;
                border-radius: 4px;
                border: 1px solid #dddddd;
            }
            #bet-records-container::-webkit-scrollbar-thumb:hover {
                background-color: #999999;
            }
            .bet-record-item {
                margin-bottom: 10px;
                padding: 10px;
                background-color: rgba(255, 255, 255, 0.8);
                border-radius: 8px;
                border-left: 3px solid #e65100;
                animation: fadeIn 0.3s ease;
                transition: all 0.2s ease;
            }
            .bet-record-item:hover {
                transform: translateX(2px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .bet-record-team {
                font-weight: bold;
                margin-bottom: 5px;
                color: #333333;
            }
            .bet-record-info {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #666666;
            }
            .bet-record-status {
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                background-color: rgba(240, 240, 240, 0.8);
            }
            .bet-record-status.pending {
                background-color: rgba(255, 152, 0, 0.2);
                color: #e65100;
            }
            .bet-record-status.win {
                background-color: rgba(76, 175, 80, 0.2);
                color: #2e7d32;
            }
            .bet-record-status.lose {
                background-color: rgba(244, 67, 54, 0.2);
                color: #d32f2f;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(betRecordsPopup);

        // 初始化显示投注记录
        updateBetRecordsInPopup();

        return betRecordsPopup;
    }

    // 在弹窗中更新投注记录
    function updateBetRecordsInPopup() {
        const recordsContainer = document.getElementById('bet-records-container');
        if (!recordsContainer) return;

        let html = '';

        if (betRecords.length === 0) {
            html = '<div style="text-align: center; padding: 20px; color: #999;">暂无投注记录</div>';
        } else {
            // 显示投注记录
            betRecords.forEach(record => {
                // 格式化时间
                const recordTime = new Date(record.time);
                const formattedTime = `${recordTime.getMonth() + 1}/${recordTime.getDate()} ${recordTime.getHours()}:${String(recordTime.getMinutes()).padStart(2, '0')}`;

                // 确定状态样式
                let statusClass = 'pending';
                if (record.status === '赢') {
                    statusClass = 'win';
                } else if (record.status === '输') {
                    statusClass = 'lose';
                }

                html += `
                <div class="bet-record-item" data-id="${record.id}">
                    <div class="bet-record-team">${record.teamName} vs ${record.opponentName}</div>
                    <div class="bet-record-info">
                        <span>赔率: ${record.odds}</span>
                        <span>金额: ${record.amount}</span>
                        <span>类型: ${record.matchType}</span>
                        <span>时间: ${formattedTime}</span>
                    </div>
                    <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span class="bet-record-status ${statusClass}">${record.status}</span>
                        <div>
                            <button class="record-btn win-btn" data-id="${record.id}" style="background-color: rgba(76, 175, 80, 0.7); color: white; border: none; border-radius: 3px; padding: 2px 5px; margin-right: 5px; cursor: pointer; font-size: 11px;">赢</button>
                            <button class="record-btn lose-btn" data-id="${record.id}" style="background-color: rgba(244, 67, 54, 0.7); color: white; border: none; border-radius: 3px; padding: 2px 5px; cursor: pointer; font-size: 11px;">输</button>
                        </div>
                    </div>
                </div>
                `;
            });
        }

        recordsContainer.innerHTML = html;

        // 添加按钮事件监听
        const winButtons = recordsContainer.querySelectorAll('.win-btn');
        const loseButtons = recordsContainer.querySelectorAll('.lose-btn');

        winButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = parseInt(this.getAttribute('data-id'));
                updateBetRecordStatus(recordId, '赢');
            });
        });

        loseButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const recordId = parseInt(this.getAttribute('data-id'));
                updateBetRecordStatus(recordId, '输');
            });
        });
    }

    // 更新投注记录状态
    function updateBetRecordStatus(recordId, status) {
        const recordIndex = betRecords.findIndex(record => record.id === recordId);
        if (recordIndex !== -1) {
            betRecords[recordIndex].status = status;
            saveBetRecords();
            updateBetRecordsInPopup();
            showNotification(`投注记录已标记为${status}`, 'success');
        }
    }

    // 删除投注记录功能已移除

    // 创建比赛数据弹窗
    function createMatchesPopup() {
        // 检查是否已存在弹窗
        let matchesPopup = document.getElementById('matches-popup');
        if (matchesPopup) return matchesPopup;

        // 创建弹窗
        matchesPopup = document.createElement('div');
        matchesPopup.id = 'matches-popup';
        matchesPopup.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 420px;
            max-height: 600px;
            background-color: rgba(255, 255, 255, 0.95);
            color: #333333;
            z-index: 10000;
            border-radius: 12px;
            padding: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            overflow: hidden;
            box-shadow: 0 0 25px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            border: 1px solid rgba(200, 200, 200, 0.8);
            backdrop-filter: blur(8px);
            animation: slideIn 0.5s ease-out;
            display: flex;
            flex-direction: column;
        `;

        // 添加标题
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px;
            background: linear-gradient(to right, #f0f0f0, #e0e0e0);
            border-bottom: 1px solid #dddddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            border-radius: 8px 8px 0 0;
        `;
        header.innerHTML = '<h4 style="margin: 0; color: #2e7d32; text-shadow: 0 0 5px rgba(46,125,50,0.2);">今日比赛数据</h4>';
        matchesPopup.appendChild(header);

        // 添加最小化按钮
        const minimizeBtn = document.createElement('button');
        minimizeBtn.textContent = '-';
        minimizeBtn.title = '最小化';
        minimizeBtn.style.cssText = `
            background-color: rgba(63, 81, 181, 0.7);
            color: white;
            border: none;
            border-radius: 5px;
            width: 24px;
            height: 24px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.2s ease;
            box-shadow: 0 0 5px rgba(63, 81, 181, 0.2);
        `;
        minimizeBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(63, 81, 181, 0.9)';
            this.style.transform = 'scale(1.05)';
        };
        minimizeBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(63, 81, 181, 0.7)';
            this.style.transform = 'scale(1)';
        };

        // 创建一个变量来跟踪弹窗状态
        let isMinimized = false;

        minimizeBtn.onclick = function() {
            if (!isMinimized) {
                // 最小化弹窗
                const contentContainer = document.getElementById('today-matches-container');
                const updateTimeDisplay = document.getElementById('last-update-time');
                if (contentContainer) contentContainer.style.display = 'none';
                if (updateTimeDisplay) updateTimeDisplay.style.display = 'none';
                matchesPopup.style.width = '180px';
                matchesPopup.style.maxHeight = 'auto';
                minimizeBtn.textContent = '+';
                minimizeBtn.title = '展开';
                isMinimized = true;
            } else {
                // 展开弹窗
                const contentContainer = document.getElementById('today-matches-container');
                const updateTimeDisplay = document.getElementById('last-update-time');
                if (contentContainer) contentContainer.style.display = 'block';
                if (updateTimeDisplay) updateTimeDisplay.style.display = 'block';
                matchesPopup.style.width = '420px';
                matchesPopup.style.maxHeight = '600px';
                minimizeBtn.textContent = '-';
                minimizeBtn.title = '最小化';
                isMinimized = false;
            }
        };
        header.appendChild(minimizeBtn);

        // 手动刷新按钮已移除，使用自动刷新功能

        // 添加投注记录按钮
        const betRecordsBtn = document.createElement('button');
        betRecordsBtn.id = 'toggle-bet-records-button';
        betRecordsBtn.textContent = '+';
        betRecordsBtn.title = '显示投注记录';
        betRecordsBtn.style.cssText = `
            background-color: rgba(230, 81, 0, 0.7);
            color: white;
            border: none;
            border-radius: 5px;
            width: 24px;
            height: 24px;
            line-height: 20px;
            text-align: center;
            margin-right: 10px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.2s ease;
            box-shadow: 0 0 5px rgba(230, 81, 0, 0.2);
        `;

        // 投注记录按钮的鼠标悬停效果
        betRecordsBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(230, 81, 0, 0.9)';
            this.style.transform = 'scale(1.05)';
        };
        betRecordsBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(230, 81, 0, 0.7)';
            this.style.transform = 'scale(1)';
        };

        // 投注记录按钮的点击事件 - 控制投注记录弹窗的显示/隐藏
        let betRecordsVisible = false;
        betRecordsBtn.onclick = function() {
            const betRecordsPopup = document.getElementById('bet-records-popup');
            if (!betRecordsPopup) return;

            if (!betRecordsVisible) {
                // 显示投注记录弹窗 - 从左侧滑出
                betRecordsPopup.style.left = '445px'; // 放在主界面右侧，稍微重叠一点
                betRecordsPopup.classList.add('visible'); // 添加visible类以显示连接线
                betRecordsBtn.textContent = '-';
                betRecordsBtn.title = '隐藏投注记录';
                betRecordsVisible = true;
            } else {
                // 隐藏投注记录弹窗 - 滑回左侧
                betRecordsPopup.style.left = '-420px';
                betRecordsPopup.classList.remove('visible'); // 移除visible类以隐藏连接线
                betRecordsBtn.textContent = '+';
                betRecordsBtn.title = '显示投注记录';
                betRecordsVisible = false;
            }
        };
        header.appendChild(betRecordsBtn);

        // 添加自动下注按钮
        const autoBetBtn = document.createElement('button');
        autoBetBtn.textContent = '自动下注';
        autoBetBtn.title = '根据设置自动选择比赛下注';
        autoBetBtn.id = 'auto-bet-button';
        autoBetBtn.style.cssText = `
            background-color: rgba(230, 81, 0, 0.7);
            color: white;
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            margin-right: 10px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            box-shadow: 0 0 5px rgba(230, 81, 0, 0.2);
        `;
        autoBetBtn.onmouseover = function() {
            const baseColor = autoBetActive ? 'rgba(76, 175, 80, 0.9)' : 'rgba(230, 81, 0, 0.9)';
            this.style.backgroundColor = baseColor;
            this.style.transform = 'scale(1.05)';
        };
        autoBetBtn.onmouseout = function() {
            const baseColor = autoBetActive ? 'rgba(76, 175, 80, 0.7)' : 'rgba(230, 81, 0, 0.7)';
            this.style.backgroundColor = baseColor;
            this.style.transform = 'scale(1)';
        };
        autoBetBtn.onclick = function() {
            if (!autoBetActive) {
                // 启动自动下注
                autoBetActive = true;
                this.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // 绿色
                this.textContent = '停止下注';
                this.title = '停止自动下注';

                // 立即执行一次下注
                placeBetOnMatch();

                // 设置定时器定期执行下注
                autoBetInterval = setInterval(() => {
                    placeBetOnMatch();
                }, userSettings.autoBetInterval * 1000);

                showNotification('自动下注已启动，将每' + userSettings.autoBetInterval + '秒尝试下注一次', 'success');
            } else {
                // 停止自动下注
                autoBetActive = false;
                this.style.backgroundColor = 'rgba(230, 81, 0, 0.7)'; // 橙色
                this.textContent = '自动下注';
                this.title = '根据设置自动选择比赛下注';

                // 清除定时器
                if (autoBetInterval) {
                    clearInterval(autoBetInterval);
                    autoBetInterval = null;
                }

                showNotification('自动下注已停止', 'info');
            }
        };
        header.appendChild(autoBetBtn);

        // 添加设置按钮
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '⚙️';
        settingsBtn.title = '设置';
        settingsBtn.style.cssText = `
            background-color: rgba(76, 175, 80, 0.7);
            color: white;
            border: none;
            border-radius: 5px;
            width: 24px;
            height: 24px;
            line-height: 20px;
            margin-right: 10px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            box-shadow: 0 0 5px rgba(76, 175, 80, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        settingsBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
            this.style.transform = 'scale(1.05)';
        };
        settingsBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';
            this.style.transform = 'scale(1)';
        };
        settingsBtn.onclick = function() {
            showSettingsPanel();
        };
        header.appendChild(settingsBtn);

        // 添加最后更新时间显示
        const updateTimeDisplay = document.createElement('div');
        updateTimeDisplay.id = 'last-update-time';
        updateTimeDisplay.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-bottom: 10px;
            text-align: right;
        `;
        matchesPopup.appendChild(updateTimeDisplay);

        // 添加比赛内容容器
        const matchesContent = document.createElement('div');
        matchesContent.id = 'today-matches-container';
        matchesContent.style.cssText = `
            max-height: 500px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #bbbbbb #f0f0f0;
            padding: 10px;
            background-color: rgba(240, 240, 240, 0.6);
            border-radius: 8px;
            border: 1px solid rgba(200, 200, 200, 0.4);
            flex: 1;
        `;
        matchesPopup.appendChild(matchesContent);

        // 添加自定义滚动条样式和动画
        const style = document.createElement('style');
        style.textContent = `
            #today-matches-container::-webkit-scrollbar {
                width: 6px;
            }
            #today-matches-container::-webkit-scrollbar-track {
                background: #f0f0f0;
                border-radius: 4px;
            }
            #today-matches-container::-webkit-scrollbar-thumb {
                background-color: #bbbbbb;
                border-radius: 4px;
                border: 1px solid #dddddd;
            }
            #today-matches-container::-webkit-scrollbar-thumb:hover {
                background-color: #999999;
            }
            @keyframes slideIn {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            .match-item {
                margin-bottom: 10px;
                padding: 10px;
                background-color: rgba(255, 255, 255, 0.8);
                border-radius: 8px;
                border-left: 3px solid #1976d2;
                animation: fadeIn 0.3s ease;
                transition: all 0.2s ease;
            }
            .match-item:hover {
                transform: translateX(2px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .match-teams {
                font-weight: bold;
                margin-bottom: 5px;
                color: #333333;
            }
            .match-info {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #666666;
            }
            .match-odds {
                margin-top: 5px;
                display: flex;
                justify-content: space-between;
            }
            .team-odd {
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                background-color: rgba(240, 240, 240, 0.8);
            }
            .match-item.live {
                border-left: 3px solid #f44336;
            }
            .match-item.upcoming {
                border-left: 3px solid #ff9800;
            }
            .live-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                background-color: #f44336;
                border-radius: 50%;
                margin-right: 5px;
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(matchesPopup);
        return matchesPopup;
    }

    // 在弹窗中更新今日比赛数据和投注记录
    function updateTodayMatchesInPopup() {
        const matchesContainer = document.getElementById('today-matches-container');
        const updateTimeDisplay = document.getElementById('last-update-time');
        if (!matchesContainer || !updateTimeDisplay) return;

        // 更新最后更新时间
        const now = new Date();
        updateTimeDisplay.textContent = `最后更新: ${now.toLocaleTimeString()}`;
        collectedData.lastUpdate = now;

        // 同时更新投注记录
        updateBetRecordsInPopup();

        // 获取今天的日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 筛选今日比赛
        const todayMatches = collectedData.matches.filter(match => {
            const matchDate = new Date(match.startTime || match.time || Date.now());
            matchDate.setHours(0, 0, 0, 0);
            return matchDate.getTime() === today.getTime();
        });

        // 去除重复的比赛赛事
        const uniqueMatches = [];
        const matchMap = new Map();

        todayMatches.forEach(match => {
            if (match.teams && match.teams.length >= 2) {
                // 使用队伍名称作为唯一标识 - 按字母顺序排序队伍名称
                const teamNames = [match.teams[0].name, match.teams[1].name].sort();
                const matchKey = `${teamNames[0]}-vs-${teamNames[1]}`;

                // 如果已存在相同队伍的比赛，更新赔率信息
                if (matchMap.has(matchKey)) {
                    const existingMatch = matchMap.get(matchKey);
                    // 更新赔率信息（如果有新的赔率）
                    if (match.odds) {
                        existingMatch.odds = {...existingMatch.odds, ...match.odds};
                    }
                    // 更新状态（优先使用更新的状态）
                    if (match.status) {
                        existingMatch.status = match.status;
                    }
                    // 更新开始时间（如果有更准确的时间）
                    if (match.startTime) {
                        existingMatch.startTime = match.startTime;
                    }
                    console.log(`更新显示中的比赛: ${matchKey}`);
                } else {
                    // 添加新的比赛
                    matchMap.set(matchKey, match);
                    uniqueMatches.push(match);
                    console.log(`添加显示中的比赛: ${matchKey}`);
                }
            } else {
                // 如果没有队伍信息，直接添加
                uniqueMatches.push(match);
            }
        });

        let html = '';

        if (uniqueMatches.length > 0) {
            // 按照比赛状态和开始时间排序
            // 优先显示进行中的比赛，然后是即将开始的，最后是未开始的
            uniqueMatches.sort((a, b) => {
                // 首先按状态排序
                const statusOrder = {
                    '进行中': 0,
                    '即将开始': 1,
                    '未开始': 2,
                    '已结束': 3
                };

                const statusA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 2; // 默认为未开始
                const statusB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 2;

                if (statusA !== statusB) {
                    return statusA - statusB;
                }

                // 状态相同时，按开始时间排序
                const timeA = new Date(a.startTime || a.time || Date.now()).getTime();
                const timeB = new Date(b.startTime || b.time || Date.now()).getTime();
                return timeA - timeB;
            });

            // 生成比赛列表HTML
            uniqueMatches.forEach((match, index) => {
                // 获取队伍信息
                const team1 = match.teams && match.teams.length > 0 ? match.teams[0].name : '未知队伍1';
                const team2 = match.teams && match.teams.length > 1 ? match.teams[1].name : '未知队伍2';

                // 获取赔率信息
                let odds1 = '未知';
                let odds2 = '未知';

                if (match.odds) {
                    if (match.teams && match.teams.length > 0) {
                        odds1 = match.odds[match.teams[0].id] || match.odds['team1-' + index] || '未知';
                        odds2 = match.odds[match.teams[1].id] || match.odds['team2-' + index] || '未知';
                    } else {
                        // 尝试从对象中获取第一个和第二个值
                        const oddsValues = Object.values(match.odds);
                        if (oddsValues.length > 0) odds1 = oddsValues[0];
                        if (oddsValues.length > 1) odds2 = oddsValues[1];
                    }
                }

                // 格式化时间
                const matchTime = new Date(match.startTime || match.time || Date.now());
                const timeStr = matchTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                // 获取比赛状态
                const status = match.status || '未开始';
                const isLive = status === '进行中';
                const isUpcoming = status === '即将开始';

                // 根据状态设置颜色
                let statusColor = '#777777'; // 默认颜色（未开始）
                if (isLive) statusColor = '#f44336'; // 进行中 - 红色
                if (isUpcoming) statusColor = '#ff9800'; // 即将开始 - 橙色
                if (status === '已结束') statusColor = '#999999'; // 已结束 - 灰色

                // 构建比赛项HTML
                let statusIndicator = '';
                let itemClass = '';

                if (isLive) {
                    // 进行中 - 红色脉冲指示器
                    statusIndicator = '<span class="live-indicator"></span>';
                    itemClass = 'live';
                } else if (isUpcoming) {
                    // 即将开始 - 橙色时钟图标
                    statusIndicator = '<span style="color: #ff9800; margin-right: 5px;">⏱️</span>';
                    itemClass = 'upcoming';
                } else if (status === '未开始') {
                    // 未开始 - 日历图标
                    statusIndicator = '<span style="color: #777777; margin-right: 5px;">📅</span>';
                }

                html += `
                    <div class="match-item ${itemClass}" data-match-id="${match.id}">
                        <div class="match-teams">${statusIndicator}${team1} vs ${team2}</div>
                        <div class="match-info">
                            <span>时间: ${timeStr}</span>
                            <span style="color: ${statusColor};">状态: ${status}</span>
                        </div>
                        <div class="match-odds">
                            <span class="team-odd" style="color: #e65100;">${team1}: ${typeof odds1 === 'number' ? odds1.toFixed(2) : odds1}</span>
                            <span class="team-odd" style="color: #1976d2;">${team2}: ${typeof odds2 === 'number' ? odds2.toFixed(2) : odds2}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            html = '<div style="color: #666666; font-style: italic; text-align: center; padding: 15px; background-color: rgba(240,240,240,0.8); border-radius: 8px;">暂无今日比赛数据</div>';
        }

        matchesContainer.innerHTML = html;

        // 添加点击事件，点击比赛项可以查看详情
        const matchItems = matchesContainer.querySelectorAll('.match-item');
        matchItems.forEach(item => {
            item.addEventListener('click', function() {
                const matchId = this.dataset.matchId;
                const match = uniqueMatches.find(m => m.id === matchId);
                if (match) {
                    // 显示比赛详情
                    showMatchDetail(match);
                }
            });
        });
    }

    // 显示设置面板
    function showSettingsPanel() {
        // 检查是否已存在设置面板
        let settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            settingsPanel.style.display = 'block';
            return;
        }

        // 创建设置面板
        settingsPanel = document.createElement('div');
        settingsPanel.id = 'settings-panel';
        settingsPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(255, 255, 255, 0.95);
            color: #333333;
            z-index: 10002;
            border-radius: 12px;
            padding: 20px;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-width: 350px;
            max-width: 450px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(200, 200, 200, 0.8);
            backdrop-filter: blur(8px);
        `;

        // 添加标题和关闭按钮
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #dddddd;
        `;
        header.innerHTML = '<h3 style="margin: 0; color: #2e7d32;">设置</h3>';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.cssText = `
            background-color: rgba(211, 47, 47, 0.7);
            color: white;
            border: none;
            border-radius: 5px;
            width: 24px;
            height: 24px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        `;
        closeBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(211, 47, 47, 0.9)';
            this.style.transform = 'scale(1.05)';
        };
        closeBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(211, 47, 47, 0.7)';
            this.style.transform = 'scale(1)';
        };
        closeBtn.onclick = function() {
            settingsPanel.style.display = 'none';
        };
        header.appendChild(closeBtn);
        settingsPanel.appendChild(header);

        // 添加设置内容
        const content = document.createElement('div');

        // 赔率刷新速度设置
        const refreshIntervalSetting = document.createElement('div');
        refreshIntervalSetting.style.cssText = `
            margin-bottom: 20px;
            background-color: rgba(240, 240, 240, 0.6);
            padding: 15px;
            border-radius: 8px;
        `;

        const refreshLabel = document.createElement('div');
        refreshLabel.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-weight: bold;
        `;
        refreshLabel.innerHTML = `
            <span>赔率刷新速度</span>
            <span id="refresh-interval-value">${userSettings.refreshInterval}秒</span>
        `;
        refreshIntervalSetting.appendChild(refreshLabel);

        // 添加滑块控件
        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        `;

        const minLabel = document.createElement('span');
        minLabel.textContent = '2秒';
        minLabel.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-right: 10px;
        `;
        sliderContainer.appendChild(minLabel);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '2';
        slider.max = '60';
        slider.step = '1';
        slider.value = userSettings.refreshInterval;
        slider.style.cssText = `
            flex: 1;
            height: 5px;
            -webkit-appearance: none;
            appearance: none;
            background: linear-gradient(to right, #4caf50, #1976d2);
            outline: none;
            border-radius: 5px;
        `;

        // 添加滑块样式
        const sliderStyle = document.createElement('style');
        sliderStyle.textContent = `
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: #2e7d32;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 0 5px rgba(46, 125, 50, 0.3);
            }
            input[type=range]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                background: #1b5e20;
            }
            input[type=range]::-moz-range-thumb {
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: #2e7d32;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 0 5px rgba(46, 125, 50, 0.3);
            }
            input[type=range]::-moz-range-thumb:hover {
                transform: scale(1.2);
                background: #1b5e20;
            }
        `;
        document.head.appendChild(sliderStyle);

        // 更新显示的值
        slider.oninput = function() {
            document.getElementById('refresh-interval-value').textContent = this.value + '秒';
        };
        sliderContainer.appendChild(slider);

        const maxLabel = document.createElement('span');
        maxLabel.textContent = '60秒';
        maxLabel.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-left: 10px;
        `;
        sliderContainer.appendChild(maxLabel);

        refreshIntervalSetting.appendChild(sliderContainer);

        // 添加说明文本
        const description = document.createElement('div');
        description.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-top: 5px;
            font-style: italic;
        `;
        description.textContent = '设置赔率数据刷新的时间间隔，较短的间隔可以获取更实时的数据，但可能增加网络请求。';
        refreshIntervalSetting.appendChild(description);

        content.appendChild(refreshIntervalSetting);

        // 下注赔率区间设置
        const oddsRangeSetting = document.createElement('div');
        oddsRangeSetting.style.cssText = `
            margin-bottom: 20px;
            background-color: rgba(240, 240, 240, 0.6);
            padding: 15px;
            border-radius: 8px;
        `;

        const oddsRangeLabel = document.createElement('div');
        oddsRangeLabel.style.cssText = `
            margin-bottom: 10px;
            font-weight: bold;
        `;
        oddsRangeLabel.textContent = '下注赔率区间';
        oddsRangeSetting.appendChild(oddsRangeLabel);

        // 最小赔率输入
        const minOddsContainer = document.createElement('div');
        minOddsContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        `;

        const minOddsLabel = document.createElement('span');
        minOddsLabel.textContent = '最小赔率:';
        minOddsLabel.style.cssText = `
            width: 80px;
            font-size: 13px;
        `;
        minOddsContainer.appendChild(minOddsLabel);

        const minOddsInput = document.createElement('input');
        minOddsInput.type = 'number';
        minOddsInput.id = 'min-odds-input';
        minOddsInput.min = '1.01';
        minOddsInput.max = '10';
        minOddsInput.step = '0.1';
        minOddsInput.value = userSettings.oddsMin;
        minOddsInput.style.cssText = `
            flex: 1;
            padding: 5px 10px;
            border: 1px solid #cccccc;
            border-radius: 4px;
            font-size: 13px;
        `;
        minOddsContainer.appendChild(minOddsInput);
        oddsRangeSetting.appendChild(minOddsContainer);

        // 最大赔率输入
        const maxOddsContainer = document.createElement('div');
        maxOddsContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        `;

        const maxOddsLabel = document.createElement('span');
        maxOddsLabel.textContent = '最大赔率:';
        maxOddsLabel.style.cssText = `
            width: 80px;
            font-size: 13px;
        `;
        maxOddsContainer.appendChild(maxOddsLabel);

        const maxOddsInput = document.createElement('input');
        maxOddsInput.type = 'number';
        maxOddsInput.id = 'max-odds-input';
        maxOddsInput.min = '1.01';
        maxOddsInput.max = '20';
        maxOddsInput.step = '0.1';
        maxOddsInput.value = userSettings.oddsMax;
        maxOddsInput.style.cssText = `
            flex: 1;
            padding: 5px 10px;
            border: 1px solid #cccccc;
            border-radius: 4px;
            font-size: 13px;
        `;
        maxOddsContainer.appendChild(maxOddsInput);
        oddsRangeSetting.appendChild(maxOddsContainer);

        // 添加说明文本
        const oddsDescription = document.createElement('div');
        oddsDescription.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-top: 5px;
            font-style: italic;
        `;
        oddsDescription.textContent = '设置自动下注时的赔率范围，只有在此范围内的赔率才会被下注。';
        oddsRangeSetting.appendChild(oddsDescription);

        content.appendChild(oddsRangeSetting);

        // 下注金额设置
        const betAmountSetting = document.createElement('div');
        betAmountSetting.style.cssText = `
            margin-bottom: 20px;
            background-color: rgba(240, 240, 240, 0.6);
            padding: 15px;
            border-radius: 8px;
        `;

        const betAmountLabel = document.createElement('div');
        betAmountLabel.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        `;

        const betAmountTextLabel = document.createElement('span');
        betAmountTextLabel.textContent = '下注金额:';
        betAmountTextLabel.style.cssText = `
            width: 80px;
            font-size: 13px;
            font-weight: bold;
        `;
        betAmountLabel.appendChild(betAmountTextLabel);

        const betAmountInput = document.createElement('input');
        betAmountInput.type = 'number';
        betAmountInput.id = 'bet-amount-input';
        betAmountInput.min = '1';
        betAmountInput.step = '1';
        betAmountInput.value = userSettings.betAmount;
        betAmountInput.style.cssText = `
            flex: 1;
            padding: 5px 10px;
            border: 1px solid #cccccc;
            border-radius: 4px;
            font-size: 13px;
        `;
        betAmountLabel.appendChild(betAmountInput);
        betAmountSetting.appendChild(betAmountLabel);

        // 添加说明文本
        const betAmountDescription = document.createElement('div');
        betAmountDescription.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-top: 5px;
            font-style: italic;
        `;
        betAmountDescription.textContent = '设置自动下注时的下注金额。';
        betAmountSetting.appendChild(betAmountDescription);

        // 添加自动下注间隔设置
        const autoBetIntervalLabel = document.createElement('div');
        autoBetIntervalLabel.style.cssText = `
            display: flex;
            align-items: center;
            margin-top: 15px;
            margin-bottom: 10px;
        `;

        const autoBetIntervalTextLabel = document.createElement('span');
        autoBetIntervalTextLabel.textContent = '下注间隔(秒):';
        autoBetIntervalTextLabel.style.cssText = `
            width: 100px;
            font-size: 13px;
            font-weight: bold;
        `;
        autoBetIntervalLabel.appendChild(autoBetIntervalTextLabel);

        const autoBetIntervalInput = document.createElement('input');
        autoBetIntervalInput.type = 'number';
        autoBetIntervalInput.id = 'auto-bet-interval-input';
        autoBetIntervalInput.min = '5';
        autoBetIntervalInput.max = '300';
        autoBetIntervalInput.step = '1';
        autoBetIntervalInput.value = userSettings.autoBetInterval;
        autoBetIntervalInput.style.cssText = `
            flex: 1;
            padding: 5px 10px;
            border: 1px solid #cccccc;
            border-radius: 4px;
            font-size: 13px;
        `;
        autoBetIntervalLabel.appendChild(autoBetIntervalInput);
        betAmountSetting.appendChild(autoBetIntervalLabel);

        // 添加自动下注间隔说明文本
        const autoBetIntervalDescription = document.createElement('div');
        autoBetIntervalDescription.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-top: 5px;
            font-style: italic;
        `;
        autoBetIntervalDescription.textContent = '设置自动下注模式下，两次下注之间的间隔时间（秒）。';
        betAmountSetting.appendChild(autoBetIntervalDescription);

        content.appendChild(betAmountSetting);

        // 下注偏好设置
        const betPreferenceSetting = document.createElement('div');
        betPreferenceSetting.style.cssText = `
            margin-bottom: 20px;
            background-color: rgba(240, 240, 240, 0.6);
            padding: 15px;
            border-radius: 8px;
        `;

        const betPreferenceLabel = document.createElement('div');
        betPreferenceLabel.style.cssText = `
            margin-bottom: 10px;
            font-weight: bold;
        `;
        betPreferenceLabel.textContent = '下注偏好设置';
        betPreferenceSetting.appendChild(betPreferenceLabel);

        // 隐藏胜率高的一方选项，默认始终为true
        const highWinRateCheckbox = document.createElement('input');
        highWinRateCheckbox.type = 'checkbox';
        highWinRateCheckbox.id = 'high-win-rate-checkbox';
        highWinRateCheckbox.checked = true; // 始终为true
        highWinRateCheckbox.style.display = 'none'; // 隐藏此元素
        betPreferenceSetting.appendChild(highWinRateCheckbox);

        // 胜率低的一方选项（反向下注）
        const lowWinRateContainer = document.createElement('div');
        lowWinRateContainer.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        `;

        const lowWinRateCheckbox = document.createElement('input');
        lowWinRateCheckbox.type = 'checkbox';
        lowWinRateCheckbox.id = 'low-win-rate-checkbox';
        lowWinRateCheckbox.checked = userSettings.betLowWinRate;
        lowWinRateCheckbox.style.cssText = `
            margin-right: 10px;
            width: 16px;
            height: 16px;
        `;
        lowWinRateContainer.appendChild(lowWinRateCheckbox);

        const lowWinRateLabel = document.createElement('label');
        lowWinRateLabel.htmlFor = 'low-win-rate-checkbox';
        lowWinRateLabel.textContent = '开启反向下注（下注胜率低的一方）';
        lowWinRateLabel.style.cssText = `
            font-size: 13px;
            cursor: pointer;
        `;
        lowWinRateContainer.appendChild(lowWinRateLabel);
        betPreferenceSetting.appendChild(lowWinRateContainer);

        // 优先下注进行中的赛事 - 默认开启且不可关闭
        const prioritizeLiveInfo = document.createElement('div');
        prioritizeLiveInfo.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            font-size: 13px;
            color: #2e7d32;
        `;

        const prioritizeLiveIcon = document.createElement('span');
        prioritizeLiveIcon.innerHTML = '✓';
        prioritizeLiveIcon.style.cssText = `
            margin-right: 10px;
            font-weight: bold;
        `;
        prioritizeLiveInfo.appendChild(prioritizeLiveIcon);

        const prioritizeLiveText = document.createElement('span');
        prioritizeLiveText.textContent = '优先下注进行中的赛事（默认开启）';
        prioritizeLiveInfo.appendChild(prioritizeLiveText);
        betPreferenceSetting.appendChild(prioritizeLiveInfo);

        // 提前下注即将开始的赛事
        const betUpcomingContainer = document.createElement('div');
        betUpcomingContainer.style.cssText = `
            display: flex;
            align-items: center;
        `;

        const betUpcomingCheckbox = document.createElement('input');
        betUpcomingCheckbox.type = 'checkbox';
        betUpcomingCheckbox.id = 'bet-upcoming-checkbox';
        betUpcomingCheckbox.checked = userSettings.betUpcomingMatches;
        betUpcomingCheckbox.style.cssText = `
            margin-right: 10px;
            width: 16px;
            height: 16px;
        `;
        betUpcomingContainer.appendChild(betUpcomingCheckbox);

        const betUpcomingLabel = document.createElement('label');
        betUpcomingLabel.htmlFor = 'bet-upcoming-checkbox';
        betUpcomingLabel.textContent = '提前下注即将开始的赛事';
        betUpcomingLabel.style.cssText = `
            font-size: 13px;
            cursor: pointer;
        `;
        betUpcomingContainer.appendChild(betUpcomingLabel);
        betPreferenceSetting.appendChild(betUpcomingContainer);

        // 添加说明文本
        const betPreferenceDescription = document.createElement('div');
        betPreferenceDescription.style.cssText = `
            font-size: 11px;
            color: #666666;
            margin-top: 10px;
            font-style: italic;
        `;
        betPreferenceDescription.textContent = '默认下注胜率高的一方，勾选反向下注选项后将下注胜率低的一方。系统默认优先下注进行中的赛事，可以设置是否提前下注即将开始的赛事。';
        betPreferenceSetting.appendChild(betPreferenceDescription);

        content.appendChild(betPreferenceSetting);

        // 添加保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存设置';
        saveBtn.style.cssText = `
            background-color: #2e7d32;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s ease;
            display: block;
            margin: 0 auto;
            box-shadow: 0 0 10px rgba(46, 125, 50, 0.2);
        `;
        saveBtn.onmouseover = function() {
            this.style.backgroundColor = '#1b5e20';
            this.style.transform = 'scale(1.05)';
        };
        saveBtn.onmouseout = function() {
            this.style.backgroundColor = '#2e7d32';
            this.style.transform = 'scale(1)';
        };
        saveBtn.onclick = function() {
            // 保存设置
            userSettings.refreshInterval = parseInt(slider.value);

            // 保存下注赔率区间设置
            userSettings.oddsMin = parseFloat(document.getElementById('min-odds-input').value);
            userSettings.oddsMax = parseFloat(document.getElementById('max-odds-input').value);

            // 保存下注金额设置
            userSettings.betAmount = parseInt(document.getElementById('bet-amount-input').value);

            // 保存下注偏好设置
            userSettings.betHighWinRate = true; // 始终为true，默认下注胜率高的一方
            userSettings.betLowWinRate = document.getElementById('low-win-rate-checkbox').checked; // 是否开启反向下注
            userSettings.prioritizeLiveMatches = true; // 始终为true，默认优先下注进行中的赛事且不可关闭
            userSettings.betUpcomingMatches = document.getElementById('bet-upcoming-checkbox').checked;

            // 保存自动下注间隔设置
            userSettings.autoBetInterval = parseInt(document.getElementById('auto-bet-interval-input').value) || 30;

            saveSettings();

            // 应用新设置
            applySettings();

            // 显示保存成功提示
            const notification = document.createElement('div');
            notification.textContent = '设置已保存';
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(46, 125, 50, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                font-size: 14px;
                z-index: 10003;
                animation: fadeInOut 2s ease forwards;
            `;
            document.body.appendChild(notification);

            // 2秒后移除提示
            setTimeout(function() {
                document.body.removeChild(notification);
            }, 2000);

            // 关闭设置面板
            settingsPanel.style.display = 'none';
        };
        content.appendChild(saveBtn);

        settingsPanel.appendChild(content);
        document.body.appendChild(settingsPanel);
    }

    // 保存设置到本地存储
    function saveSettings() {
        try {
            GM_setValue('userSettings', JSON.stringify(userSettings));
            console.log('设置已保存');
        } catch (e) {
            console.error('保存设置失败:', e);
        }
    }

    // 加载保存的设置
    function loadSettings() {
        try {
            const savedSettings = GM_getValue('userSettings');
            if (savedSettings) {
                userSettings = JSON.parse(savedSettings);
                console.log('已加载保存的设置');
            }
        } catch (e) {
            console.error('加载保存设置失败:', e);
        }
    }

    // 应用设置
    function applySettings() {
        // 重新设置自动刷新
        setupAutoRefresh();
    }

    // 获取比赛胜率数据
    async function getMatchWinRate(team1, team2) {
        console.log(`尝试获取比赛胜率: ${team1} vs ${team2}`);

        try {
            // 查找胜率按钮并点击 - 使用用户提供的选择器 .statBtn
            const statBtns = document.querySelectorAll('div.statBtn');
            let clicked = false;

            // 首先尝试找到与当前队伍相关的胜率按钮
            if (statBtns.length > 0) {
                console.log(`找到 ${statBtns.length} 个胜率按钮，尝试匹配队伍`);

                let matchedBtn = null;
                for (const btn of statBtns) {
                    // 查找按钮所在的比赛行或容器
                    const matchRow = btn.closest('.marketRow, .teamInfoGrp, .matchRow, .matchItem');
                    if (!matchRow) continue;

                    // 检查容器文本是否包含两个队伍名称
                    const rowText = matchRow.textContent || '';
                    if (rowText.includes(team1) && rowText.includes(team2)) {
                        console.log(`找到匹配的胜率按钮: ${rowText}`);
                        matchedBtn = btn;
                        break;
                    }
                }

                // 如果找到匹配的按钮，点击它
                if (matchedBtn) {
                    console.log('点击匹配的胜率按钮');
                    matchedBtn.click();
                    clicked = true;
                } else {
                    // 如果没有找到匹配的按钮，点击第一个（回退方案）
                    console.log('未找到匹配的胜率按钮，点击第一个');
                    statBtns[0].click();
                    clicked = true;
                }
            } else {
                // 如果找不到 .statBtn，回退到原来的方法
                const statIcons = document.querySelectorAll('i.icon-stat');

                for (const icon of statIcons) {
                    // 查找与当前队伍相关的图标
                    const parentElement = icon.closest('.marketRow, .teamInfoGrp');
                    if (!parentElement) continue;

                    const teamText = parentElement.textContent;
                    if (teamText.includes(team1) && teamText.includes(team2)) {
                        console.log('找到匹配的胜率图标，点击进入胜率页面');
                        icon.click();
                        clicked = true;
                        break;
                    }
                }
            }

            if (!clicked) {
                console.log('未找到匹配的胜率图标或按钮');
                return { team1Rate: '未知', team2Rate: '未知', team1Percentage: 0, team2Percentage: 0 };
            }

            // 等待胜率数据加载 - 增加等待时间确保数据加载完成
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 查找胜率数据 - 使用用户提供的选择器
            let statsInfo = document.querySelector('div.statsInfo');
            if (!statsInfo) {
                console.log('未找到胜率数据，尝试再次等待');
                // 再等待一段时间再次尝试
                await new Promise(resolve => setTimeout(resolve, 1000));
                statsInfo = document.querySelector('div.statsInfo');
                if (!statsInfo) {
                    console.log('再次尝试后仍未找到胜率数据');
                    return { team1Rate: '未知', team2Rate: '未知', team1Percentage: 0, team2Percentage: 0 };
                }
                console.log('第二次尝试找到胜率数据');
            }

            console.log('找到胜率数据容器，HTML结构:', statsInfo.outerHTML);

            // 查找队伍名称标签，确定哪个胜率对应哪个队伍
            const teamLabels = document.querySelectorAll('.statsTeam, .teamName, .teamLabel');
            let team1Index = 0; // 默认第一个胜率对应team1
            let team2Index = 1; // 默认第二个胜率对应team2

            console.log(`查找队伍标签，需匹配: ${team1} 和 ${team2}`);
            if (teamLabels.length >= 2) {
                teamLabels.forEach((label, index) => {
                    const labelText = label.textContent.trim();
                    console.log(`队伍标签 ${index}: ${labelText}`);

                    // 检查标签文本是否包含队伍名称
                    if (labelText.includes(team1)) {
                        console.log(`找到队伍1标签: ${labelText}`);
                        team1Index = index % 2; // 确保索引为0或1
                    } else if (labelText.includes(team2)) {
                        console.log(`找到队伍2标签: ${labelText}`);
                        team2Index = index % 2; // 确保索引为0或1
                    }
                });
            } else {
                console.log('未找到队伍标签，使用默认顺序');
            }

            // 提取胜率数据 - 使用用户提供的选择器
            const statsPcts = statsInfo.querySelectorAll('.statsPct');
            const statsProgs = statsInfo.querySelectorAll('.statsProg');
            const statsCategory = statsInfo.querySelector('.statsCategory');

            if (statsPcts.length >= 2) {
                // 根据队伍索引获取对应的胜率数据
                const team1Rate = statsPcts[team1Index].textContent.trim();
                const team2Rate = statsPcts[team2Index].textContent.trim();

                console.log(`根据队伍索引分配胜率: team1(${team1})索引=${team1Index}, team2(${team2})索引=${team2Index}`);
                console.log(`分配的胜率: ${team1}=${team1Rate}, ${team2}=${team2Rate}`);

                // 提取百分比数值（用于进度条）
                let team1Percentage = 0;
                let team2Percentage = 0;

                // 尝试从文本中提取百分比数值
                const team1Match = team1Rate.match(/([\d\.]+)%?/);
                const team2Match = team2Rate.match(/([\d\.]+)%?/);

                if (team1Match && team1Match[1]) {
                    team1Percentage = parseFloat(team1Match[1]);
                }

                if (team2Match && team2Match[1]) {
                    team2Percentage = parseFloat(team2Match[1]);
                }

                // 如果无法从文本提取，尝试从进度条宽度提取
                if ((team1Percentage === 0 || team2Percentage === 0) && statsProgs.length >= 2) {
                    const team1ProgStyle = statsProgs[team1Index].getAttribute('style') || '';
                    const team2ProgStyle = statsProgs[team2Index].getAttribute('style') || '';

                    const team1WidthMatch = team1ProgStyle.match(/width:\s*([\d\.]+)%/);
                    const team2WidthMatch = team2ProgStyle.match(/width:\s*([\d\.]+)%/);

                    if (team1WidthMatch && team1WidthMatch[1] && team1Percentage === 0) {
                        team1Percentage = parseFloat(team1WidthMatch[1]);
                    }

                    if (team2WidthMatch && team2WidthMatch[1] && team2Percentage === 0) {
                        team2Percentage = parseFloat(team2WidthMatch[1]);
                    }
                }

                // 如果仍然无法获取百分比，尝试直接从DOM元素的类和样式中获取
                if (team1Percentage === 0 && statsProgs.length > team1Index) {
                    // 检查是否有higher/lower类
                    if (statsProgs[team1Index].classList.contains('higher')) {
                        team1Percentage = 60; // 默认值
                    } else if (statsProgs[team1Index].classList.contains('lower')) {
                        team1Percentage = 40; // 默认值
                    }
                }

                if (team2Percentage === 0 && statsProgs.length > team2Index) {
                    // 检查是否有higher/lower类
                    if (statsProgs[team2Index].classList.contains('higher')) {
                        team2Percentage = 60; // 默认值
                    } else if (statsProgs[team2Index].classList.contains('lower')) {
                        team2Percentage = 40; // 默认值
                    }
                }

                console.log(`获取到胜率数据: ${team1}=${team1Rate}(${team1Percentage}%), ${team2}=${team2Rate}(${team2Percentage}%)`);
                return { team1Rate, team2Rate, team1Percentage, team2Percentage };
            } else {
                // 尝试直接从statsInfo中提取数据
                const statsText = statsInfo.textContent.trim();
                const statsHtml = statsInfo.innerHTML;
                console.log('尝试从statsInfo中提取数据:', statsText);
                console.log('statsInfo HTML:', statsHtml);

                // 首先尝试使用用户提供的示例数据格式 - 这是最精确的匹配
                // 示例: <div class="statsInfo"><div class="statsPct">60%</div><div class="statsBar"><div class="statsProg lower" style="width: 60%;"></div></div><div class="statsCategory">胜率</div><div class="statsBar"><div class="statsProg higher" style="width: 80%;"></div></div><div class="statsPct">80%</div></div>
                const userFormatMatch = statsHtml.match(/statsPct[^>]*>([^<]+)<\/div[^>]*>[\s\S]*?statsProg[^>]*\s+(?:lower|higher)?\s*"?\s*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsCategory[^>]*>([^<]+)<\/div[^>]*>[\s\S]*?statsProg[^>]*\s+(?:lower|higher)?\s*"?\s*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsPct[^>]*>([^<]+)<\/div/);

                if (userFormatMatch && userFormatMatch.length >= 5) {
                    // 从HTML中提取的原始数据
                    const firstRate = userFormatMatch[1].trim();
                    const firstPercentage = parseFloat(userFormatMatch[2]);
                    const category = userFormatMatch[3].trim(); // 应该是"胜率"
                    const secondPercentage = parseFloat(userFormatMatch[4]);
                    const secondRate = userFormatMatch[5].trim();

                    // 根据队伍索引分配胜率数据
                    const team1Rate = team1Index === 0 ? firstRate : secondRate;
                    const team2Rate = team2Index === 1 ? secondRate : firstRate;
                    const team1Percentage = team1Index === 0 ? firstPercentage : secondPercentage;
                    const team2Percentage = team2Index === 1 ? secondPercentage : firstPercentage;

                    console.log(`从用户格式HTML中提取到胜率数据: ${team1}=${team1Rate}(${team1Percentage}%), ${team2}=${team2Rate}(${team2Percentage}%), 类别=${category}`);
                    return { team1Rate, team2Rate, team1Percentage, team2Percentage };
                }

                // 尝试匹配胜率数据 - 更通用的模式
                const rateMatches = statsHtml.match(/statsPct[^>]*>([^<]+)<\/div[^>]*>[\s\S]*?statsProg[^>]*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsCategory[^>]*>([^<]+)<\/div[^>]*>[\s\S]*?statsProg[^>]*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsPct[^>]*>([^<]+)<\/div/);

                if (rateMatches && rateMatches.length >= 5) {
                    // 从HTML中提取的原始数据
                    const firstRate = rateMatches[1].trim();
                    const firstPercentage = parseFloat(rateMatches[2]);
                    const category = rateMatches[3].trim(); // 应该是"胜率"
                    const secondPercentage = parseFloat(rateMatches[4]);
                    const secondRate = rateMatches[5].trim();

                    // 根据队伍索引分配胜率数据
                    const team1Rate = team1Index === 0 ? firstRate : secondRate;
                    const team2Rate = team2Index === 1 ? secondRate : firstRate;
                    const team1Percentage = team1Index === 0 ? firstPercentage : secondPercentage;
                    const team2Percentage = team2Index === 1 ? secondPercentage : firstPercentage;

                    console.log(`从HTML中提取到胜率数据: ${team1}=${team1Rate}(${team1Percentage}%), ${team2}=${team2Rate}(${team2Percentage}%), 类别=${category}`);
                    return { team1Rate, team2Rate, team1Percentage, team2Percentage };
                }

                // 如果上面的方法都失败了，尝试更简单的匹配
                const simpleMatch = statsHtml.match(/statsPct[^>]*>([^<]+)<\/div[^>]*>[\s\S]*?statsProg[^>]*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsProg[^>]*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsPct[^>]*>([^<]+)<\/div/);

                if (simpleMatch && simpleMatch.length >= 4) {
                    // 从HTML中提取的原始数据
                    const firstRate = simpleMatch[1].trim();
                    const firstPercentage = parseFloat(simpleMatch[2]);
                    const secondPercentage = parseFloat(simpleMatch[3]);
                    const secondRate = simpleMatch[4].trim();

                    // 根据队伍索引分配胜率数据
                    const team1Rate = team1Index === 0 ? firstRate : secondRate;
                    const team2Rate = team2Index === 1 ? secondRate : firstRate;
                    const team1Percentage = team1Index === 0 ? firstPercentage : secondPercentage;
                    const team2Percentage = team2Index === 1 ? secondPercentage : firstPercentage;

                    console.log(`从简化HTML中提取到胜率数据: ${team1}=${team1Rate}(${team1Percentage}%), ${team2}=${team2Rate}(${team2Percentage}%)`);
                    return { team1Rate, team2Rate, team1Percentage, team2Percentage };
                }

                // 如果所有方法都失败，尝试直接从DOM结构中提取
                const allPcts = statsInfo.querySelectorAll('.statsPct');
                const allProgs = statsInfo.querySelectorAll('.statsProg');

                if (allPcts.length >= 2 && allProgs.length >= 2) {
                    // 根据队伍索引获取对应的元素
                    const firstPct = allPcts[0];
                    const secondPct = allPcts[allPcts.length - 1];
                    const firstProg = allProgs[0];
                    const secondProg = allProgs[allProgs.length - 1];

                    // 根据队伍索引分配元素
                    const team1PctEl = team1Index === 0 ? firstPct : secondPct;
                    const team2PctEl = team2Index === 1 ? secondPct : firstPct;
                    const team1ProgEl = team1Index === 0 ? firstProg : secondProg;
                    const team2ProgEl = team2Index === 1 ? secondProg : firstProg;

                    // 从分配的元素中获取数据
                    const team1Rate = team1PctEl.textContent.trim();
                    const team2Rate = team2PctEl.textContent.trim();

                    let team1Percentage = 0;
                    let team2Percentage = 0;

                    // 尝试从文本中提取百分比
                    const percentRegex = /([\d\.]+)%?/;
                    const team1Match = team1Rate.match(percentRegex);
                    const team2Match = team2Rate.match(percentRegex);

                    if (team1Match && team1Match[1]) {
                        team1Percentage = parseFloat(team1Match[1]);
                    }

                    if (team2Match && team2Match[1]) {
                        team2Percentage = parseFloat(team2Match[1]);
                    }

                    // 如果无法从文本提取，尝试从样式中提取
                    if (team1Percentage === 0) {
                        const style = team1ProgEl.getAttribute('style');
                        if (style) {
                            const widthMatch = style.match(/width:\s*([\d\.]+)%/);
                            if (widthMatch && widthMatch[1]) {
                                team1Percentage = parseFloat(widthMatch[1]);
                            }
                        }
                    }

                    if (team2Percentage === 0) {
                        const style = team2ProgEl.getAttribute('style');
                        if (style) {
                            const widthMatch = style.match(/width:\s*([\d\.]+)%/);
                            if (widthMatch && widthMatch[1]) {
                                team2Percentage = parseFloat(widthMatch[1]);
                            }
                        }
                    }

                    console.log(`从DOM元素中提取到胜率数据: ${team1}=${team1Rate}(${team1Percentage}%), ${team2}=${team2Rate}(${team2Percentage}%)`);
                    return { team1Rate, team2Rate, team1Percentage, team2Percentage };
                }

                // 最后的备用方法：尝试直接匹配用户提供的示例格式
                // 示例: <div class="statsInfo element-picker-highlight"><div class="statsPct">60%</div><div class="statsBar"><div class="statsProg lower" style="width: 60%;"></div></div><div class="statsCategory">胜率</div><div class="statsBar"><div class="statsProg higher" style="width: 80%;"></div></div><div class="statsPct">80%</div></div>

                // 尝试直接匹配百分比数字
                const directPercentMatches = statsHtml.match(/statsPct[^>]*>(\d+)%<\/div[^>]*>[\s\S]*?statsPct[^>]*>(\d+)%<\/div/);
                if (directPercentMatches && directPercentMatches.length >= 3) {
                    // 从HTML中提取的原始数据
                    const firstPercentage = parseFloat(directPercentMatches[1]);
                    const secondPercentage = parseFloat(directPercentMatches[2]);

                    // 根据队伍索引分配胜率数据
                    const team1Percentage = team1Index === 0 ? firstPercentage : secondPercentage;
                    const team2Percentage = team2Index === 1 ? secondPercentage : firstPercentage;
                    const team1Rate = team1Percentage + '%';
                    const team2Rate = team2Percentage + '%';

                    console.log(`从直接百分比匹配中提取到胜率数据: ${team1}=${team1Rate}, ${team2}=${team2Rate}`);
                    return { team1Rate, team2Rate, team1Percentage, team2Percentage };
                }

                // 尝试匹配宽度样式
                const directWidthMatches = statsHtml.match(/statsProg[^>]*style="[^"]*width:\s*([\d\.]+)%[^>]*>[\s\S]*?statsProg[^>]*style="[^"]*width:\s*([\d\.]+)%/);
                if (directWidthMatches && directWidthMatches.length >= 3) {
                    // 从HTML中提取的原始数据
                    const firstPercentage = parseFloat(directWidthMatches[1]);
                    const secondPercentage = parseFloat(directWidthMatches[2]);

                    // 根据队伍索引分配胜率数据
                    const team1Percentage = team1Index === 0 ? firstPercentage : secondPercentage;
                    const team2Percentage = team2Index === 1 ? secondPercentage : firstPercentage;
                    const team1Rate = team1Percentage + '%';
                    const team2Rate = team2Percentage + '%';

                    console.log(`从直接宽度匹配中提取到胜率数据: ${team1}=${team1Rate}, ${team2}=${team2Rate}`);
                    return { team1Rate, team2Rate, team1Percentage, team2Percentage };
                }

                console.log('所有胜率数据提取方法都失败');
                return { team1Rate: '未知', team2Rate: '未知', team1Percentage: 0, team2Percentage: 0 };
            }
        } catch (error) {
            console.error('获取胜率数据时出错:', error);
            return { team1Rate: '未知', team2Rate: '未知', team1Percentage: 0, team2Percentage: 0 };
        }
    }

    // 显示比赛详情
    function showMatchDetail(match) {
        // 创建详情弹窗
        const detailPopup = document.createElement('div');
        detailPopup.className = 'match-detail-popup';
        // 生成唯一ID
        const popupId = 'match-detail-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        detailPopup.id = popupId;
        detailPopup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(255, 255, 255, 0.95);
            color: #333333;
            z-index: 10001;
            border-radius: 12px;
            padding: 20px;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-width: 350px;
            max-width: 500px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(200, 200, 200, 0.8);
            backdrop-filter: blur(8px);
        `;

        // 获取队伍信息
        const team1 = match.teams && match.teams.length > 0 ? match.teams[0].name : '未知队伍1';
        const team2 = match.teams && match.teams.length > 1 ? match.teams[1].name : '未知队伍2';

        // 获取赔率信息
        let odds1 = '未知';
        let odds2 = '未知';

        if (match.odds) {
            if (match.teams && match.teams.length > 0) {
                odds1 = match.odds[match.teams[0].id] || match.odds['team1-0'] || '未知';
                odds2 = match.odds[match.teams[1].id] || match.odds['team2-0'] || '未知';
            } else {
                // 尝试从对象中获取第一个和第二个值
                const oddsValues = Object.values(match.odds);
                if (oddsValues.length > 0) odds1 = oddsValues[0];
                if (oddsValues.length > 1) odds2 = oddsValues[1];
            }
        }

        // 格式化时间
        const matchTime = new Date(match.startTime || match.time || Date.now());
        const timeStr = matchTime.toLocaleString();

        // 获取比赛状态
        const status = match.status || '未开始';
        const isLive = status === '进行中';
        const isUpcoming = status === '即将开始';

        // 根据状态设置颜色和指示器
        let statusColor = '#777777'; // 默认颜色（未开始）
        let statusIndicator = '';

        if (isLive) {
            statusColor = '#f44336'; // 进行中 - 红色
            statusIndicator = '<span class="live-indicator"></span>';
        } else if (isUpcoming) {
            statusColor = '#ff9800'; // 即将开始 - 橙色
            statusIndicator = '<span style="color: #ff9800; margin-right: 5px;">⏱️</span>';
        } else if (status === '未开始') {
            statusIndicator = '<span style="color: #777777; margin-right: 5px;">📅</span>';
        }

        // 构建详情HTML
        let detailHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #2e7d32;">比赛详情</h3>
                <button id="close-btn-${popupId}" class="detail-close-btn" style="
                    background-color: rgba(211, 47, 47, 0.7);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    width: 24px;
                    height: 24px;
                    line-height: 20px;
                    text-align: center;
                    cursor: pointer;
                    font-size: 12px;
                ">X</button>
            </div>
            <div style="background-color: rgba(240, 240, 240, 0.6); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; text-align: center;">
                    ${statusIndicator}
                    ${team1} vs ${team2}
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>比赛时间:</span>
                    <span>${timeStr}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>比赛状态:</span>
                    <span style="color: ${statusColor};">${status}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>赔率:</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span class="team-odd" style="color: #e65100;">${team1}: ${typeof odds1 === 'number' ? odds1.toFixed(2) : odds1}</span>
                    <span class="team-odd" style="color: #1976d2;">${team2}: ${typeof odds2 === 'number' ? odds2.toFixed(2) : odds2}</span>
                </div>
                <div id="win-rate-container-${popupId}" style="margin-top: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>比赛胜率:</span>
                        <span id="win-rate-status-${popupId}" style="font-size: 12px; color: #666;">加载中...</span>
                    </div>
                    <div id="win-rate-data-${popupId}" style="display: block;">
                        <div class="statsInfo" style="margin-top: 10px; background-color: rgba(240, 240, 240, 0.4); border-radius: 6px; padding: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <div id="team1-rate-${popupId}" class="statsPct" style="font-weight: bold; color: #e65100; width: 50px; text-align: center;">加载中...</div>
                                <div style="flex-grow: 1; padding: 0 10px;">
                                    <div class="statsBar" style="height: 10px; background-color: rgba(200, 200, 200, 0.3); border-radius: 5px; overflow: hidden; position: relative;">
                                        <div id="team1-prog-${popupId}" class="statsProg higher" style="position: absolute; left: 0; top: 0; height: 100%; background-color: rgba(230, 81, 0, 0.7); width: 0%; border-radius: 5px; transition: width 0.5s ease-in-out;"></div>
                                    </div>
                                </div>
                                <div style="width: 80px; text-align: center; font-size: 12px;">${team1}</div>
                            </div>

                            <div class="statsCategory" style="text-align: center; margin: 8px 0; font-weight: bold; color: #555;">胜率</div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="width: 80px; text-align: center; font-size: 12px;">${team2}</div>
                                <div style="flex-grow: 1; padding: 0 10px;">
                                    <div class="statsBar" style="height: 10px; background-color: rgba(200, 200, 200, 0.3); border-radius: 5px; overflow: hidden; position: relative;">
                                        <div id="team2-prog-${popupId}" class="statsProg lower" style="position: absolute; right: 0; top: 0; height: 100%; background-color: rgba(25, 118, 210, 0.7); width: 0%; border-radius: 5px; transition: width 0.5s ease-in-out;"></div>
                                    </div>
                                </div>
                                <div id="team2-rate-${popupId}" class="statsPct" style="font-weight: bold; color: #1976d2; width: 50px; text-align: center;">加载中...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加比赛类型信息（如果有）
        if (match.type) {
            detailHTML += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>比赛类型:</span>
                    <span>${match.type}</span>
                </div>
            `;
        }

        // 添加比赛ID信息
        detailHTML += `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>比赛ID:</span>
                <span>${match.id}</span>
            </div>
        `;

        detailPopup.innerHTML = detailHTML;
        document.body.appendChild(detailPopup);

        // 添加关闭按钮事件
        const closeBtn = document.getElementById(`close-btn-${popupId}`);
        if (closeBtn) {
            closeBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = 'rgba(211, 47, 47, 0.9)';
                this.style.transform = 'scale(1.05)';
            });
            closeBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = 'rgba(211, 47, 47, 0.7)';
                this.style.transform = 'scale(1)';
            });
            closeBtn.addEventListener('click', function() {
                const popup = document.getElementById(popupId);
                if (popup) {
                    document.body.removeChild(popup);
                }
            });
        }

        // 自动获取胜率数据
        const winRateStatus = document.getElementById(`win-rate-status-${popupId}`);

        // 立即获取胜率数据
        (async function() {
            try {
                // 获取胜率数据
                const { team1Rate, team2Rate, team1Percentage, team2Percentage } = await getMatchWinRate(team1, team2);

                // 更新胜率显示
                const team1RateEl = document.getElementById(`team1-rate-${popupId}`);
                const team2RateEl = document.getElementById(`team2-rate-${popupId}`);
                const team1ProgEl = document.getElementById(`team1-prog-${popupId}`);
                const team2ProgEl = document.getElementById(`team2-prog-${popupId}`);

                if (team1RateEl) team1RateEl.textContent = team1Rate;
                if (team2RateEl) team2RateEl.textContent = team2Rate;

                // 更新进度条
                if (team1ProgEl) {
                    // 延迟一点以便看到动画效果
                    setTimeout(() => {
                        team1ProgEl.style.width = `${team1Percentage}%`;
                        // 根据百分比设置颜色
                        if (team1Percentage >= 50) {
                            team1ProgEl.style.backgroundColor = 'rgba(76, 175, 80, 0.8)'; // 绿色 - 高胜率
                            team1ProgEl.classList.add('higher');
                            team1ProgEl.classList.remove('lower');
                        } else {
                            team1ProgEl.style.backgroundColor = 'rgba(255, 152, 0, 0.8)'; // 橙色 - 低胜率
                            team1ProgEl.classList.add('lower');
                            team1ProgEl.classList.remove('higher');
                        }
                    }, 100);
                }

                if (team2ProgEl) {
                    setTimeout(() => {
                        team2ProgEl.style.width = `${team2Percentage}%`;
                        // 根据百分比设置颜色
                        if (team2Percentage >= 50) {
                            team2ProgEl.style.backgroundColor = 'rgba(76, 175, 80, 0.8)'; // 绿色 - 高胜率
                            team2ProgEl.classList.add('higher');
                            team2ProgEl.classList.remove('lower');
                        } else {
                            team2ProgEl.style.backgroundColor = 'rgba(255, 152, 0, 0.8)'; // 橙色 - 低胜率
                            team2ProgEl.classList.add('lower');
                            team2ProgEl.classList.remove('higher');
                        }
                    }, 100);
                }

                // 更新状态显示
                if (winRateStatus) {
                    winRateStatus.textContent = '已更新';
                    winRateStatus.style.color = '#4caf50';

                    // 添加刷新按钮
                    const refreshBtn = document.createElement('button');
                    refreshBtn.textContent = '刷新';
                    refreshBtn.style.cssText = `
                        background-color: rgba(76, 175, 80, 0.7);
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 2px 8px;
                        font-size: 12px;
                        cursor: pointer;
                        margin-left: 8px;
                    `;
                    refreshBtn.onmouseover = function() {
                        this.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
                        this.style.transform = 'scale(1.05)';
                    };
                    refreshBtn.onmouseout = function() {
                        this.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';
                        this.style.transform = 'scale(1)';
                    };
                    refreshBtn.onclick = async function() {
                        // 更改状态为加载中
                        winRateStatus.textContent = '加载中...';
                        winRateStatus.style.color = '#666';
                        this.disabled = true;
                        this.style.opacity = '0.7';

                        try {
                            // 重新获取胜率数据
                            const { team1Rate, team2Rate, team1Percentage, team2Percentage } = await getMatchWinRate(team1, team2);

                            // 更新胜率显示
                            if (team1RateEl) team1RateEl.textContent = team1Rate;
                            if (team2RateEl) team2RateEl.textContent = team2Rate;

                            // 更新进度条
                            if (team1ProgEl) {
                                team1ProgEl.style.width = `${team1Percentage}%`;
                                if (team1Percentage >= 50) {
                                    team1ProgEl.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
                                    team1ProgEl.classList.add('higher');
                                    team1ProgEl.classList.remove('lower');
                                } else {
                                    team1ProgEl.style.backgroundColor = 'rgba(255, 152, 0, 0.8)';
                                    team1ProgEl.classList.add('lower');
                                    team1ProgEl.classList.remove('higher');
                                }
                            }

                            if (team2ProgEl) {
                                team2ProgEl.style.width = `${team2Percentage}%`;
                                if (team2Percentage >= 50) {
                                    team2ProgEl.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
                                    team2ProgEl.classList.add('higher');
                                    team2ProgEl.classList.remove('lower');
                                } else {
                                    team2ProgEl.style.backgroundColor = 'rgba(255, 152, 0, 0.8)';
                                    team2ProgEl.classList.add('lower');
                                    team2ProgEl.classList.remove('higher');
                                }
                            }

                            // 更新状态显示
                            winRateStatus.textContent = '已更新';
                            winRateStatus.style.color = '#4caf50';
                        } catch (error) {
                            console.error('刷新胜率时出错:', error);
                            winRateStatus.textContent = '获取失败';
                            winRateStatus.style.color = '#f44336';
                        } finally {
                            // 恢复按钮状态
                            this.disabled = false;
                            this.style.opacity = '1';
                        }
                    };

                    // 替换状态文本为刷新按钮
                    winRateStatus.parentNode.appendChild(refreshBtn);
                }
            } catch (error) {
                console.error('获取胜率时出错:', error);
                if (winRateStatus) {
                    winRateStatus.textContent = '获取失败';
                    winRateStatus.style.color = '#f44336';
                }
            }
        })();
    }

    // 从DOM元素中提取比赛信息
    function extractMatchesFromDOM() {
        console.log('开始从DOM元素中提取比赛信息...');

        // 清空之前收集的数据
        collectedData.matches = [];

        // 从DOM元素中提取比赛信息
        const teamInfoElements = document.querySelectorAll('div.teamInfoGrp');
        const marketRowElements = document.querySelectorAll('div.marketRow');
        const matchHeaderElements = document.querySelectorAll('div.matchHeader');
        const leagueNameElements = document.querySelectorAll('div.leagueName'); // 比赛类型/联赛名称元素

        // 获取比赛状态元素
        const matchTimerElements = document.querySelectorAll('div.matchTimer'); // 进行中的比赛
        const matchStatusElements = document.querySelectorAll('div.matchStatus:not(.mSDateTime)'); // 即将开始的比赛
        const matchDateTimeElements = document.querySelectorAll('div.matchStatus.mSDateTime'); // 未开始的比赛

        console.log('从DOM元素中提取比赛信息');
        console.log(`找到 ${teamInfoElements.length} 个队伍信息元素, ${marketRowElements.length} 个赔率行元素`);
        console.log(`找到 ${matchTimerElements.length} 个进行中比赛, ${matchStatusElements.length} 个即将开始比赛, ${matchDateTimeElements.length} 个未开始比赛`);
        console.log(`找到 ${leagueNameElements.length} 个比赛类型/联赛名称元素`);

        // 尝试更多选择器来查找比赛信息
        const allOddsElements = document.querySelectorAll('div[class*="odds"], span[class*="odds"], div[data-odds], span[data-odds]');
        console.log(`找到 ${allOddsElements.length} 个可能的赔率元素`);

        // 尝试查找所有可能包含队伍名称的元素
        const allTeamElements = document.querySelectorAll('div[class*="team"], span[class*="team"], div.teamName, span.teamName');
        console.log(`找到 ${allTeamElements.length} 个可能的队伍名称元素`);

        // 收集所有比赛类型
        const leagueNames = Array.from(leagueNameElements).map(el => el.textContent.trim());
        console.log('比赛类型列表:', leagueNames);

        if (teamInfoElements.length > 0 || marketRowElements.length > 0) {
            console.log('从DOM元素中提取比赛信息');

            // 处理队伍信息元素
            teamInfoElements.forEach((element, index) => {
                const text = element.textContent.trim();
                // 尝试提取队伍名称和赔率（支持中文和英文）
                const teamMatch = text.match(/([一-龥\w\s]+)(\d+\.\d+)([一-龥\w\s]+)(\d+\.\d+)/);

                if (teamMatch) {
                    const team1 = teamMatch[1].trim();
                    const odds1 = parseFloat(teamMatch[2]);
                    const team2 = teamMatch[3].trim();
                    const odds2 = parseFloat(teamMatch[4]);

                    // 获取比赛类型
                    let matchType = '未知比赛';

                    // 尝试找到最近的比赛类型元素
                    // 1. 首先查找元素的父元素链，直到找到包含比赛类型的元素
                    let parentEl = element.parentElement;
                    let found = false;

                    // 向上查找最多5层父元素
                    for (let i = 0; i < 5 && parentEl && !found; i++) {
                        // 在父元素中查找比赛类型元素
                        const leagueEl = parentEl.querySelector('div.leagueName');
                        if (leagueEl) {
                            matchType = leagueEl.textContent.trim();
                            found = true;
                            console.log(`找到比赛类型: ${matchType} (通过父元素查找)`);
                            break;
                        }
                        parentEl = parentEl.parentElement;
                    }

                    // 2. 如果没找到，尝试使用索引匹配
                    if (!found) {
                        if (leagueNameElements.length > 0 && index < leagueNameElements.length) {
                            matchType = leagueNameElements[index].textContent.trim();
                            console.log(`找到比赛类型: ${matchType} (通过索引匹配)`);
                        }
                        // 如果没有找到，尝试从 matchHeaderElements 获取
                        else if (matchHeaderElements.length > 0 && index < matchHeaderElements.length) {
                            matchType = matchHeaderElements[index].textContent.trim();
                            console.log(`找到比赛类型: ${matchType} (通过matchHeader匹配)`);
                        }
                    }

                    // 确定比赛状态
                    let matchStatus = '未开始';
                    let matchStartTime = new Date();

                    // 检查是否有对应的状态元素
                    if (index < matchTimerElements.length) {
                        // 进行中的比赛
                        matchStatus = '进行中';
                        matchStartTime = new Date(); // 当前时间
                    } else if (index < matchStatusElements.length) {
                        // 即将开始的比赛
                        matchStatus = '即将开始';
                        const statusText = matchStatusElements[index].textContent.trim();
                        const timeMatch = statusText.match(/(\d+):(\d+)/);
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            matchStartTime = new Date();
                            matchStartTime.setHours(hours, minutes, 0, 0);
                        }
                    } else if (index < matchDateTimeElements.length) {
                        // 未开始的比赛
                        matchStatus = '未开始';
                        const dateTimeText = matchDateTimeElements[index].textContent.trim();
                        const dateTimeMatch = dateTimeText.match(/(\d+)\/(\d+)\s+(\d+):(\d+)/);
                        if (dateTimeMatch) {
                            const month = parseInt(dateTimeMatch[1]) - 1; // 月份从0开始
                            const day = parseInt(dateTimeMatch[2]);
                            const hours = parseInt(dateTimeMatch[3]);
                            const minutes = parseInt(dateTimeMatch[4]);
                            matchStartTime = new Date();
                            matchStartTime.setMonth(month, day);
                            matchStartTime.setHours(hours, minutes, 0, 0);
                        }
                    }

                    // 创建唯一标识符 - 按字母顺序排序队伍名称
                    const teamNames = [team1, team2].sort();
                    const matchKey = `${teamNames[0]}-vs-${teamNames[1]}`;

                    // 创建临时比赛对象
                    const tempMatch = {
                        id: `dom-match-${matchKey}`,
                        teams: [
                            { id: `team-${team1}`, name: team1 },
                            { id: `team-${team2}`, name: team2 }
                        ],
                        odds: {},
                        status: matchStatus,
                        type: matchType,
                        startTime: matchStartTime,
                        source: 'dom-extracted'
                    };

                    // 设置赔率
                    tempMatch.odds[`team-${team1}`] = odds1;
                    tempMatch.odds[`team-${team2}`] = odds2;

                    // 添加到收集的数据中，使用去重函数
                    addMatchWithDeduplication(tempMatch);
                    console.log(`处理比赛: ${team1} vs ${team2}, 状态: ${matchStatus}`);
                }
            });

            // 处理赔率行元素
            marketRowElements.forEach((element, index) => {
                const text = element.textContent.trim();
                // 尝试提取队伍名称和赔率（支持中文和英文）
                const oddsMatch = text.match(/([一-龥\w\s]+)(\d+\.\d+)([一-龥\w\s]+)(\d+\.\d+)/);

                if (oddsMatch && teamInfoElements.length === 0) {
                    // 只有在没有teamInfoElements的情况下才处理，避免重复
                    const team1 = oddsMatch[1].trim();
                    const odds1 = parseFloat(oddsMatch[2]);
                    const team2 = oddsMatch[3].trim();
                    const odds2 = parseFloat(oddsMatch[4]);

                    // 获取比赛类型
                    let matchType = '未知比赛';

                    // 尝试找到最近的比赛类型元素
                    // 1. 首先查找元素的父元素链，直到找到包含比赛类型的元素
                    let parentEl = element.parentElement;
                    let found = false;

                    // 向上查找最多5层父元素
                    for (let i = 0; i < 5 && parentEl && !found; i++) {
                        // 在父元素中查找比赛类型元素
                        const leagueEl = parentEl.querySelector('div.leagueName');
                        if (leagueEl) {
                            matchType = leagueEl.textContent.trim();
                            found = true;
                            console.log(`找到比赛类型: ${matchType} (通过父元素查找)`);
                            break;
                        }
                        parentEl = parentEl.parentElement;
                    }

                    // 2. 如果没找到，尝试使用索引匹配
                    if (!found) {
                        if (leagueNameElements.length > 0 && index < leagueNameElements.length) {
                            matchType = leagueNameElements[index].textContent.trim();
                            console.log(`找到比赛类型: ${matchType} (通过索引匹配)`);
                        }
                        // 如果没有找到，尝试从 matchHeaderElements 获取
                        else if (matchHeaderElements.length > 0 && index < matchHeaderElements.length) {
                            matchType = matchHeaderElements[index].textContent.trim();
                            console.log(`找到比赛类型: ${matchType} (通过matchHeader匹配)`);
                        }
                    }

                    // 确定比赛状态
                    let matchStatus = '未开始';
                    let matchStartTime = new Date();

                    // 检查是否有对应的状态元素
                    if (index < matchTimerElements.length) {
                        // 进行中的比赛
                        matchStatus = '进行中';
                        matchStartTime = new Date(); // 当前时间
                    } else if (index < matchStatusElements.length) {
                        // 即将开始的比赛
                        matchStatus = '即将开始';
                        const statusText = matchStatusElements[index].textContent.trim();
                        const timeMatch = statusText.match(/(\d+):(\d+)/);
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            matchStartTime = new Date();
                            matchStartTime.setHours(hours, minutes, 0, 0);
                        }
                    } else if (index < matchDateTimeElements.length) {
                        // 未开始的比赛
                        matchStatus = '未开始';
                        const dateTimeText = matchDateTimeElements[index].textContent.trim();
                        const dateTimeMatch = dateTimeText.match(/(\d+)\/(\d+)\s+(\d+):(\d+)/);
                        if (dateTimeMatch) {
                            const month = parseInt(dateTimeMatch[1]) - 1; // 月份从0开始
                            const day = parseInt(dateTimeMatch[2]);
                            const hours = parseInt(dateTimeMatch[3]);
                            const minutes = parseInt(dateTimeMatch[4]);
                            matchStartTime = new Date();
                            matchStartTime.setMonth(month, day);
                            matchStartTime.setHours(hours, minutes, 0, 0);
                        }
                    }

                    // 创建唯一标识符 - 按字母顺序排序队伍名称
                    const teamNames = [team1, team2].sort();
                    const matchKey = `${teamNames[0]}-vs-${teamNames[1]}`;

                    // 创建临时比赛对象
                    const tempMatch = {
                        id: `dom-match-${matchKey}`,
                        teams: [
                            { id: `team-${team1}`, name: team1 },
                            { id: `team-${team2}`, name: team2 }
                        ],
                        odds: {},
                        status: matchStatus,
                        type: matchType,
                        startTime: matchStartTime,
                        source: 'dom-extracted'
                    };

                    // 设置赔率
                    tempMatch.odds[`team-${team1}`] = odds1;
                    tempMatch.odds[`team-${team2}`] = odds2;

                    // 添加到收集的数据中，使用去重函数
                    addMatchWithDeduplication(tempMatch);
                    console.log(`处理比赛: ${team1} vs ${team2}, 状态: ${matchStatus}`);
                }
            });

            // 更新弹窗中的比赛数据
            updateTodayMatchesInPopup();
        }
    }

    // 拦截WebSocket
    function interceptWebSocket() {
        const originalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            console.log('WebSocket连接已拦截:', url);
            const ws = new originalWebSocket(url, protocols);

            ws.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket数据:', data);

                    // 分析数据类型并存储
                    if (data.type === 'match' || data.matches || data.matchData) {
                        processMatchData(data);
                    }

                    // 更新弹窗中的比赛数据
                    updateTodayMatchesInPopup();
                } catch (e) {
                    console.log('非JSON WebSocket数据');
                }
            });

            return ws;
        };
    }

    // 拦截XHR请求
    function interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function() {
            const xhr = this;

            // 只关注可能包含比赛数据的请求
            if (xhr._url && (
                xhr._url.includes('match') ||
                xhr._url.includes('game') ||
                xhr._url.includes('live') ||
                xhr._url.includes('data') ||
                xhr._url.includes('event')
            )) {
                console.log('拦截XHR请求:', xhr._url);

                const originalOnReadyStateChange = xhr.onreadystatechange;
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            console.log('XHR响应数据:', data);

                            // 分析数据类型并存储
                            if (xhr._url.includes('match') || data.matches || data.matchData) {
                                processMatchData(data);
                            }

                            // 更新弹窗中的比赛数据
                            updateTodayMatchesInPopup();
                        } catch (e) {
                            console.log('非JSON XHR响应');
                        }
                    }

                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.apply(xhr, arguments);
                    }
                };
            }

            return originalSend.apply(this, arguments);
        };
    }

    // 处理比赛数据
    function processMatchData(data) {
        // 根据实际数据结构进行调整
        if (data.matches) {
            // 合并数据，避免重复
            data.matches.forEach(newMatch => {
                addMatchWithDeduplication(newMatch);
            });
        } else if (data.matchData) {
            // 合并数据，避免重复
            data.matchData.forEach(newMatch => {
                addMatchWithDeduplication(newMatch);
            });
        } else if (data.type === 'match') {
            // 避免重复添加
            addMatchWithDeduplication(data);
        }

        collectedData.lastUpdate = new Date();

        // 保存数据
        saveData();
    }

    // 添加比赛数据并去重
    function addMatchWithDeduplication(newMatch) {
        // 如果没有队伍信息，直接按ID去重
        if (!newMatch.teams || newMatch.teams.length < 2) {
            if (!collectedData.matches.some(m => m.id === newMatch.id)) {
                collectedData.matches.push(newMatch);
            }
            return;
        }

        // 使用队伍名称作为唯一标识
        const team1 = newMatch.teams[0].name;
        const team2 = newMatch.teams[1].name;

        // 创建唯一标识符 - 按字母顺序排序队伍名称，确保无论顺序如何都能匹配
        const teamNames = [team1, team2].sort();
        const matchKey = `${teamNames[0]}-vs-${teamNames[1]}`;

        // 查找是否已存在相同队伍的比赛
        const existingMatchIndex = collectedData.matches.findIndex(m => {
            if (!m.teams || m.teams.length < 2) return false;

            // 获取现有比赛的队伍名称并排序
            const existingTeamNames = [m.teams[0].name, m.teams[1].name].sort();
            const existingMatchKey = `${existingTeamNames[0]}-vs-${existingTeamNames[1]}`;

            return matchKey === existingMatchKey;
        });

        if (existingMatchIndex !== -1) {
            // 更新现有比赛的信息
            const existingMatch = collectedData.matches[existingMatchIndex];

            // 更新赔率信息（如果有新的赔率）
            if (newMatch.odds) {
                existingMatch.odds = {...existingMatch.odds, ...newMatch.odds};
            }

            // 更新状态（优先使用更新的状态）
            if (newMatch.status) {
                existingMatch.status = newMatch.status;
            }

            // 更新开始时间（如果有更准确的时间）
            if (newMatch.startTime) {
                existingMatch.startTime = newMatch.startTime;
            }

            console.log(`更新现有比赛: ${matchKey}`);
        } else {
            // 添加新的比赛
            collectedData.matches.push(newMatch);
            console.log(`添加新比赛: ${matchKey}`);
        }
    }

    // 保存数据到本地存储
    function saveData() {
        try {
            GM_setValue('todayMatchesData', JSON.stringify(collectedData));
            console.log('数据已保存');
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    }

    // 加载保存的数据
    function loadData() {
        try {
            const savedData = GM_getValue('todayMatchesData');
            if (savedData) {
                collectedData = JSON.parse(savedData);
                console.log('已加载保存的数据');
            }
        } catch (e) {
            console.error('加载保存数据失败:', e);
        }
    }

    // 定期更新比赛数据
    function setupAutoRefresh() {
        // 清除现有的定时器
        if (window.domExtractInterval) {
            clearInterval(window.domExtractInterval);
        }
        if (window.dataSaveInterval) {
            clearInterval(window.dataSaveInterval);
        }

        // 根据用户设置的刷新间隔从DOM提取比赛数据并更新投注记录
        const refreshMs = userSettings.refreshInterval * 1000;
        window.domExtractInterval = setInterval(function() {
            extractMatchesFromDOM();
            // 同时更新投注记录和比赛数据显示
            updateTodayMatchesInPopup();
            console.log(`根据设置的${userSettings.refreshInterval}秒间隔刷新数据和投注记录`);
        }, refreshMs);

        // 每5分钟保存一次数据
        window.dataSaveInterval = setInterval(function() {
            saveData();
        }, 300000);
    }

    // 自动下注功能
    async function placeBetOnMatch() {
        // 显示状态提示
        showNotification('开始自动下注...', 'info');

        // 选择符合条件的比赛
        const selection = await selectMatchForBet();
        if (!selection) {
            showNotification('没有找到符合条件的比赛下注', 'error');
            console.log('自动下注失败: 没有找到符合条件的比赛下注');
            return false;
        }

        // 确保选择对象有正确的属性
        const teamName = selection.team?.name || selection.teamName || '未知队伍';
        const opponentName = selection.opponentName || '对手';
        const odds = selection.odds || 0;

        console.log(`已选择比赛: ${teamName} vs ${opponentName}，赔率: ${odds}`);
        showNotification(`已选择比赛: ${teamName} vs ${opponentName}，赔率: ${odds}`, 'info');

        // 直接点击赔率元素
        try {
            // 检查是否有元素可以点击
            if (!selection.element) {
                console.error('没有找到可点击的赔率元素');
                showNotification('没有找到可点击的赔率元素', 'error');
                return false;
            }

            console.log('尝试点击赔率元素:', selection.element);
            console.log(`点击选择的赔率元素: ${teamName}, 赔率: ${odds}`);

            // 确保元素在视口内
            const rect = selection.element.getBoundingClientRect();
            if (rect.top < 0 || rect.left < 0 ||
                rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
                console.log('元素不在视口内，尝试滚动到元素位置');
                selection.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 高亮显示要点击的元素（调试用）
            const originalBackground = selection.element.style.backgroundColor;
            const originalBorder = selection.element.style.border;
            selection.element.style.backgroundColor = 'rgba(255, 215, 0, 0.5)';
            selection.element.style.border = '2px solid red';

            // 模拟更真实的鼠标点击事件序列
            const rect2 = selection.element.getBoundingClientRect();
            const centerX = rect2.left + rect2.width / 2;
            const centerY = rect2.top + rect2.height / 2;

            // 模拟鼠标移动到元素上
            try {
                // 移除了view: window参数，这是导致TypeError的原因
                selection.element.dispatchEvent(new MouseEvent('mouseover', {
                    bubbles: true,
                    cancelable: true,
                    clientX: centerX,
                    clientY: centerY
                }));

                // 模拟鼠标按下
                selection.element.dispatchEvent(new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: centerX,
                    clientY: centerY,
                    button: 0
                }));

                // 短暂延迟
                await new Promise(resolve => setTimeout(resolve, 50));

                // 模拟鼠标释放
                selection.element.dispatchEvent(new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    clientX: centerX,
                    clientY: centerY,
                    button: 0
                }));

                // 模拟点击
                selection.element.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    clientX: centerX,
                    clientY: centerY,
                    button: 0
                }));

                console.log('成功模拟鼠标事件序列');
            } catch (error) {
                console.error('模拟鼠标事件失败:', error.message);
                console.log('尝试使用备用点击方法');
            }

            // 使用原生点击方法
            selection.element.click();

            // 如果元素有特定的点击处理器，尝试触发它
            if (typeof selection.element.onclick === 'function') {
                selection.element.onclick();
                console.log('触发了onclick处理器');
            }

            // 恢复元素样式
            setTimeout(() => {
                selection.element.style.backgroundColor = originalBackground;
                selection.element.style.border = originalBorder;
            }, 1000);

            // 尝试多种备选点击方法
            let betSlipAppeared = false;

            // 等待注单区出现
            await new Promise(resolve => setTimeout(resolve, 800));

            // 检查注单区是否已出现
            const betSlipExists = document.querySelector('.betslip, [class*="betslip"], .bet-slip, [class*="bet-slip"], .betPanel, [class*="betPanel"], .slip, [class*="slip"], .ticket, [class*="ticket"]');
            betSlipAppeared = !!betSlipExists;

            // 如果注单区未出现，尝试备选点击方法
            if (!betSlipAppeared) {
                console.log('注单区未出现，尝试备选点击方法');

                // 方法1：点击父元素
                if (selection.element.parentElement) {
                    console.log('尝试点击父元素');
                    selection.element.parentElement.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // 检查注单区是否已出现
                const betSlipExists2 = document.querySelector('.betslip, [class*="betslip"], .bet-slip, [class*="bet-slip"], .betPanel, [class*="betPanel"], .slip, [class*="slip"], .ticket, [class*="ticket"]');
                betSlipAppeared = !!betSlipExists2;

                // 方法2：点击元素内的可点击元素
                if (!betSlipAppeared) {
                    const clickableElements = selection.element.querySelectorAll('button, [role="button"], [class*="btn"]');
                    if (clickableElements.length > 0) {
                        console.log('尝试点击元素内的可点击元素');
                        clickableElements[0].click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }

            // 等待足够时间，确保注单区出现
            await new Promise(resolve => setTimeout(resolve, 500));

            // 检查是否出现滚球暂停弹窗并关闭
            if (await closeRollingPausePopup()) {
                showNotification('检测到滚球暂停，稍等后继续...', 'warning');
                await new Promise(resolve => setTimeout(resolve, 1500));
                return placeBetOnMatch();
            }
        } catch (error) {
            console.error('点击队伍时出错:', error);
            showNotification('点击队伍时出错', 'error');
            return false;
        }

        // 设置下注金额
        try {
            if (!await setBetAmount(userSettings.betAmount)) {
                // 检查是否是因为滚球暂停导致的失败
                if (await closeRollingPausePopup()) {
                    showNotification('检测到滚球暂停，稍等后重试...', 'warning');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return placeBetOnMatch();
                }
                showNotification('设置下注金额失败', 'error');
                return false;
            }

            showNotification(`已设置下注金额: ${userSettings.betAmount}`, 'info');
            await new Promise(resolve => setTimeout(resolve, 400));
        } catch (error) {
            console.error('设置下注金额时出错:', error);
            showNotification('设置下注金额时出错', 'error');
            return false;
        }

        // 确认下注
        try {
            if (!await confirmBet()) {
                // 检查是否是因为滚球暂停导致的失败
                if (await closeRollingPausePopup()) {
                    showNotification('检测到滚球暂停，稍等后重试...', 'warning');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return placeBetOnMatch();
                }
                return false;
            }

            showNotification('下注成功!', 'success');

            // 添加投注记录
            const betRecord = {
                id: Date.now(), // 使用时间戳作为唯一ID
                time: new Date().toISOString(),
                teamName: selection.team?.name || selection.teamName || '未知队伍',
                opponentName: selection.opponentName || '对手',
                odds: selection.odds || 0,
                amount: userSettings.betAmount,
                matchType: selection.matchType || '未知',
                status: '待结算' // 初始状态为待结算
            };

            // 添加到投注记录并保存
            betRecords.unshift(betRecord); // 添加到数组开头，使最新的记录显示在前面
            saveBetRecords();

            // 关闭可能出现的成功提示框
            await closeSuccessPopup();
            return true;
        } catch (error) {
            console.error('确认下注时出错:', error);
            showNotification('确认下注时出错', 'error');
            return false;
        }
    }

    // 根据设置选择合适的比赛进行下注
    async function selectMatchForBet() {
        console.log('正在根据设置选择比赛...');

        // 获取设置
        const minOdds = userSettings.oddsMin;
        const maxOdds = userSettings.oddsMax;
        const betHighWinRate = userSettings.betHighWinRate;
        const betLowWinRate = userSettings.betLowWinRate;
        const prioritizeLiveMatches = userSettings.prioritizeLiveMatches;
        const betUpcomingMatches = userSettings.betUpcomingMatches;

        // 调试信息：输出当前设置和收集到的比赛数量
        console.log(`当前设置: 赔率范围=${minOdds}-${maxOdds}, 下注胜率高=${betHighWinRate}, 反向下注=${betLowWinRate}, 优先进行中=${prioritizeLiveMatches}, 下注即将开始=${betUpcomingMatches}`);
        console.log(`收集到的比赛数量: ${collectedData.matches.length}`);

        // 如果没有收集到比赛数据，尝试立即收集
        if (collectedData.matches.length === 0) {
            console.log('没有收集到比赛数据，尝试立即收集...');
            extractMatchesFromDOM();
            console.log(`收集后的比赛数量: ${collectedData.matches.length}`);
        }

        // 筛选符合条件的比赛
        let eligibleMatches = [];

        // 从已收集的数据中筛选
        for (const match of collectedData.matches) {
            // 检查比赛状态
            console.log(`检查比赛: ${match.teams ? match.teams.map(t => t.name).join(' vs ') : '未知'}, 状态: ${match.status}`);

            // 检查比赛状态 - 支持多种可能的状态表示
            const isLiveMatch = match.status === '进行中' || match.status === 'live';
            const isUpcomingMatch = match.status === '即将开始' || match.status === 'upcoming';
            const isNotStartedMatch = match.status === '未开始' || match.status === 'not_started';

            if (isLiveMatch) {
                if (!prioritizeLiveMatches) {
                    console.log(`  跳过: 进行中的比赛，但设置不优先进行中比赛`);
                    continue;
                }
                console.log(`  处理: 进行中的比赛`);
            } else if (isUpcomingMatch || isNotStartedMatch) {
                if (!betUpcomingMatches) {
                    console.log(`  跳过: ${isUpcomingMatch ? '即将开始' : '未开始'}的比赛，但设置不下注即将开始的比赛`);
                    continue;
                }
                console.log(`  处理: ${isUpcomingMatch ? '即将开始' : '未开始'}的比赛`);
            } else {
                console.log(`  跳过: 未知状态的比赛 - ${match.status}`);
                continue;
            }

            // 检查赔率是否在范围内 - 支持多种可能的赔率结构
            let team1Odds = 0;
            let team2Odds = 0;

            // 调试输出赔率信息
            console.log(`  赔率信息:`, match.odds);

            if (match.odds) {
                if (match.teams && match.teams.length >= 2) {
                    // 尝试使用队伍ID作为键
                    const team1Id = match.teams[0].id;
                    const team2Id = match.teams[1].id;

                    if (match.odds[team1Id] !== undefined) {
                        team1Odds = parseFloat(match.odds[team1Id]);
                    }

                    if (match.odds[team2Id] !== undefined) {
                        team2Odds = parseFloat(match.odds[team2Id]);
                    }

                    // 如果通过ID没有找到，尝试使用team1/team2键
                    if (team1Odds === 0 && match.odds.team1 !== undefined) {
                        team1Odds = parseFloat(match.odds.team1);
                    }

                    if (team2Odds === 0 && match.odds.team2 !== undefined) {
                        team2Odds = parseFloat(match.odds.team2);
                    }
                } else {
                    // 如果没有队伍信息，尝试使用team1/team2键
                    if (match.odds.team1 !== undefined) {
                        team1Odds = parseFloat(match.odds.team1);
                    }

                    if (match.odds.team2 !== undefined) {
                        team2Odds = parseFloat(match.odds.team2);
                    }
                }
            }

            console.log(`  解析后的赔率: 队伍1=${team1Odds}, 队伍2=${team2Odds}`);

            // 检查胜率 - 支持多种可能的胜率结构
            let team1WinRate = 0;
            let team2WinRate = 0;

            if (match.winRate) {
                if (match.teams && match.teams.length >= 2) {
                    // 尝试使用队伍ID作为键
                    const team1Id = match.teams[0].id;
                    const team2Id = match.teams[1].id;

                    if (match.winRate[team1Id] !== undefined) {
                        team1WinRate = parseFloat(match.winRate[team1Id]);
                    }

                    if (match.winRate[team2Id] !== undefined) {
                        team2WinRate = parseFloat(match.winRate[team2Id]);
                    }

                    // 如果通过ID没有找到，尝试使用team1/team2键
                    if (team1WinRate === 0 && match.winRate.team1 !== undefined) {
                        team1WinRate = parseFloat(match.winRate.team1);
                    }

                    if (team2WinRate === 0 && match.winRate.team2 !== undefined) {
                        team2WinRate = parseFloat(match.winRate.team2);
                    }
                } else {
                    // 如果没有队伍信息，尝试使用team1/team2键
                    if (match.winRate.team1 !== undefined) {
                        team1WinRate = parseFloat(match.winRate.team1);
                    }

                    if (match.winRate.team2 !== undefined) {
                        team2WinRate = parseFloat(match.winRate.team2);
                    }
                }
            }

            console.log(`  解析后的胜率: 队伍1=${team1WinRate}%, 队伍2=${team2WinRate}%`);

            // 如果没有胜率数据，尝试获取
            if (!team1WinRate && !team2WinRate) {
                // 这里可以添加获取胜率的逻辑，但为简化起见，我们跳过
                // 实际使用时可以考虑调用getMatchWinRate函数
            }

            // 根据胜率和赔率选择队伍
            let selectedTeam = null;
            let selectedOdds = 0;
            let opponentName = '';

            // 获取队伍名称
            let team1Name = '';
            let team2Name = '';

            if (match.teams && match.teams.length >= 2) {
                team1Name = match.teams[0].name || match.teams[0].id || '队伍1';
                team2Name = match.teams[1].name || match.teams[1].id || '队伍2';
            }

            console.log(`  队伍名称: 队伍1=${team1Name}, 队伍2=${team2Name}`);

            // 默认下注胜率高的一方，除非betLowWinRate为true（开启反向下注）
            if (betLowWinRate) {
                console.log(`  策略: 下注胜率低的一方（反向下注）`);
                // 下注胜率低的一方（反向下注）
                if (team1WinRate < team2WinRate && team1Odds >= minOdds && team1Odds <= maxOdds) {
                    selectedTeam = match.teams ? match.teams[0] : { name: team1Name };
                    selectedOdds = team1Odds;
                    opponentName = team2Name;
                    console.log(`  选择: 队伍1 (${team1Name}), 赔率=${team1Odds}, 胜率=${team1WinRate}%`);
                } else if (team2WinRate < team1WinRate && team2Odds >= minOdds && team2Odds <= maxOdds) {
                    selectedTeam = match.teams ? match.teams[1] : { name: team2Name };
                    selectedOdds = team2Odds;
                    opponentName = team1Name;
                    console.log(`  选择: 队伍2 (${team2Name}), 赔率=${team2Odds}, 胜率=${team2WinRate}%`);
                } else {
                    console.log(`  未选择: 没有符合条件的低胜率队伍或赔率不在范围内`);
                }
            } else {
                console.log(`  策略: 下注胜率高的一方`);
                // 默认下注胜率高的一方
                if (team1WinRate > team2WinRate && team1Odds >= minOdds && team1Odds <= maxOdds) {
                    selectedTeam = match.teams ? match.teams[0] : { name: team1Name };
                    selectedOdds = team1Odds;
                    opponentName = team2Name;
                    console.log(`  选择: 队伍1 (${team1Name}), 赔率=${team1Odds}, 胜率=${team1WinRate}%`);
                } else if (team2WinRate > team1WinRate && team2Odds >= minOdds && team2Odds <= maxOdds) {
                    selectedTeam = match.teams ? match.teams[1] : { name: team2Name };
                    selectedOdds = team2Odds;
                    opponentName = team1Name;
                    console.log(`  选择: 队伍2 (${team2Name}), 赔率=${team2Odds}, 胜率=${team2WinRate}%`);
                } else {
                    console.log(`  未选择: 没有符合条件的高胜率队伍或赔率不在范围内`);
                }
            }

            // 如果没有找到符合胜率条件的比赛，则考虑只按赔率选择
            if (!selectedTeam) {
                console.log(`  策略: 仅考虑赔率`);
                if (team1Odds >= minOdds && team1Odds <= maxOdds) {
                    selectedTeam = match.teams ? match.teams[0] : { name: team1Name };
                    selectedOdds = team1Odds;
                    opponentName = team2Name;
                    console.log(`  选择: 队伍1 (${team1Name}), 赔率=${team1Odds}`);
                } else if (team2Odds >= minOdds && team2Odds <= maxOdds) {
                    selectedTeam = match.teams ? match.teams[1] : { name: team2Name };
                    selectedOdds = team2Odds;
                    opponentName = team1Name;
                    console.log(`  选择: 队伍2 (${team2Name}), 赔率=${team2Odds}`);
                } else {
                    console.log(`  未选择: 赔率不在设置范围内 ${minOdds}-${maxOdds}`);
                }
            }

            if (selectedTeam) {
                // 找到符合条件的比赛
                eligibleMatches.push({
                    match: match,
                    team: selectedTeam,
                    teamName: selectedTeam.name || (match.teams && match.teams[0] ? match.teams[0].name : '未知队伍'),
                    odds: selectedOdds,
                    opponentName: opponentName,
                    status: match.status
                });
                console.log(`  添加到符合条件的比赛列表: ${selectedTeam.name || '未知队伍'} vs ${opponentName}, 赔率: ${selectedOdds}`);
            }
        }

        // 如果没有找到符合条件的比赛，返回null
        if (eligibleMatches.length === 0) {
            console.log('没有找到符合条件的比赛');

            // 输出所有比赛的详细信息，帮助诊断问题
            console.log('所有收集到的比赛详细信息:');
            collectedData.matches.forEach((match, index) => {
                console.log(`比赛 ${index+1}:`);
                console.log(`  队伍: ${match.teams ? match.teams.map(t => t.name).join(' vs ') : '未知'}`);
                console.log(`  状态: ${match.status || '未知'}`);
                console.log(`  类型: ${match.type || '未知'}`);

                // 输出赔率信息
                if (match.odds) {
                    const oddsInfo = Object.entries(match.odds)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ');
                    console.log(`  赔率: ${oddsInfo}`);
                } else {
                    console.log('  赔率: 未知');
                }

                // 输出胜率信息
                if (match.winRate) {
                    const winRateInfo = Object.entries(match.winRate)
                        .map(([key, value]) => `${key}: ${value}%`)
                        .join(', ');
                    console.log(`  胜率: ${winRateInfo}`);
                } else {
                    console.log('  胜率: 未知');
                }
            });

            // 输出用户设置
            console.log('用户设置详情:');
            console.log(`  赔率范围: ${minOdds} - ${maxOdds}`);
            console.log(`  下注高胜率: ${betHighWinRate}`);
            console.log(`  反向下注: ${betLowWinRate}`);
            console.log(`  优先进行中比赛: ${prioritizeLiveMatches}`);
            console.log(`  下注即将开始比赛: ${betUpcomingMatches}`);

            return null;
        }

        // 优先选择进行中的比赛
        if (prioritizeLiveMatches) {
            const liveMatches = eligibleMatches.filter(m => m.match.status === '进行中');
            if (liveMatches.length > 0) {
                eligibleMatches = liveMatches;
            }
        }

        // 随机选择一场比赛
        const randomIndex = Math.floor(Math.random() * eligibleMatches.length);
        const selectedMatch = eligibleMatches[randomIndex];

        // 在页面上查找对应的赔率元素
        console.log('开始查找赔率元素，目标赔率:', selectedMatch.odds);
        console.log('目标队伍名称:', selectedMatch.team.name || selectedMatch.teamName || '未知队伍');

        // 使用更精确的选择器查找赔率元素
        const oddsElements = document.querySelectorAll('.btOdds, div.odds, span.odds, [class*="btOdds"], [class*="odds"], [data-odds]');
        console.log(`找到 ${oddsElements.length} 个可能的赔率元素`);

        let matchedElement = null;
        let matchedElements = [];

        // 遍历所有赔率元素，查找与选中队伍匹配的元素
        for (const element of oddsElements) {
            // 检查元素是否可见
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || element.offsetParent === null) {
                continue; // 跳过不可见的元素
            }

            const text = element.textContent.trim();
            if (!text || !/^\d+\.\d+$/.test(text)) continue; // 确保文本是有效的赔率格式

            const odds = parseFloat(text);

            // 检查赔率是否匹配（使用更精确的匹配）
            if (Math.abs(odds - selectedMatch.odds) < 0.001) {
                // 查找包含队伍名称的父元素（向上查找最多5层）
                let parent = element;
                let foundTeamName = false;
                const teamName = selectedMatch.team.name || selectedMatch.teamName || '';

                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.textContent.includes(teamName)) {
                        foundTeamName = true;
                        break;
                    }
                    parent = parent.parentElement;
                }

                if (foundTeamName) {
                    matchedElement = element;
                    console.log('找到完全匹配的赔率元素:', element);
                    console.log('元素文本:', element.textContent);
                    console.log('元素路径:', getElementPath(element));
                    break; // 找到完全匹配的元素，立即退出循环
                }

                // 收集所有赔率匹配的元素，以备后用
                matchedElements.push(element);
            }
        }

        // 如果没有找到完全匹配的元素，但有赔率匹配的元素
        if (!matchedElement && matchedElements.length > 0) {
            // 尝试找到最可能的元素（位于视口内且可交互的）
            matchedElement = matchedElements.find(el => {
                const rect = el.getBoundingClientRect();
                return rect.top >= 0 && rect.left >= 0 &&
                       rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
            }) || matchedElements[0];

            console.log('使用赔率匹配的元素:', matchedElement);
            console.log('元素文本:', matchedElement.textContent);
            console.log('元素路径:', getElementPath(matchedElement));
        }

        // 如果仍然找不到，尝试更宽泛的搜索
        if (!matchedElement) {
            console.log('尝试更宽泛的搜索方法');
            // 查找包含队伍名称的元素
            const teamName = selectedMatch.team.name || selectedMatch.teamName || '';
            if (teamName) {
                const teamElements = Array.from(document.querySelectorAll('div, span, p')).filter(el => {
                    return el.textContent.includes(teamName) &&
                           window.getComputedStyle(el).display !== 'none' &&
                           el.offsetParent !== null;
                });

                console.log(`找到 ${teamElements.length} 个包含队伍名称的元素`);

                // 在队伍元素附近查找赔率元素
                for (const teamElement of teamElements) {
                    // 向上查找最多3层父元素
                    let parent = teamElement;
                    for (let i = 0; i < 3 && parent; i++) {
                        // 在父元素中查找赔率元素
                        const nearbyElements = parent.querySelectorAll('div, span');
                        for (const element of nearbyElements) {
                            const text = element.textContent.trim();
                            if (/^\d+\.\d+$/.test(text)) {
                                const odds = parseFloat(text);
                                if (Math.abs(odds - selectedMatch.odds) < 0.01) {
                                    matchedElement = element;
                                    console.log('在队伍元素附近找到赔率元素:', element);
                                    console.log('元素文本:', element.textContent);
                                    console.log('元素路径:', getElementPath(element));
                                    break;
                                }
                            }
                        }
                        if (matchedElement) break;
                        parent = parent.parentElement;
                    }
                    if (matchedElement) break;
                }
            }
        }

        // 调试功能：高亮显示选中的赔率元素
        if (matchedElement) {
            const originalBackground = matchedElement.style.backgroundColor;
            const originalBorder = matchedElement.style.border;
            matchedElement.style.backgroundColor = 'rgba(255, 215, 0, 0.5)';
            matchedElement.style.border = '2px solid red';
            setTimeout(() => {
                matchedElement.style.backgroundColor = originalBackground;
                matchedElement.style.border = originalBorder;
            }, 2000);
        }

        // 辅助函数：获取元素的CSS选择器路径
        function getElementPath(element) {
            if (!element) return 'null';
            let path = '';
            while (element && element.nodeType === Node.ELEMENT_NODE) {
                let selector = element.nodeName.toLowerCase();
                if (element.id) {
                    selector += '#' + element.id;
                    path = selector + (path ? ' > ' + path : '');
                    break;
                } else {
                    let sibling = element;
                    let nth = 1;
                    while (sibling = sibling.previousElementSibling) {
                        if (sibling.nodeName.toLowerCase() === selector) nth++;
                    }
                    if (nth !== 1) selector += ":nth-of-type("+nth+")";
                }
                path = selector + (path ? ' > ' + path : '');
                element = element.parentNode;
            }
            return path;
        }

        if (!matchedElement) {
            console.log('找不到匹配的赔率元素');
            return null;
        }

        // 确保返回对象中包含正确的队伍名称和对手名称
        return {
            match: selectedMatch.match,
            team: selectedMatch.team,
            odds: selectedMatch.odds,
            element: matchedElement,
            teamName: selectedMatch.teamName || selectedMatch.team.name || '未知队伍',
            opponentName: selectedMatch.opponentName || '对手'
        };
    }

    // 设置下注金额
    async function setBetAmount(amount) {
        console.log('尝试在注单区查找下注金额输入框');

        // 验证金额是否有效
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            showNotification('下注金额无效，请输入有效的金额', 'error');
            return false;
        }

        // 尝试多种可能的选择器
        let amountInput = null;

        // 方法1：优先查找注单区域中的输入框
        const betSlips = document.querySelectorAll('.betslip, [class*="betslip"], .bet-slip, [class*="bet-slip"], .betPanel, [class*="betPanel"], .slip, [class*="slip"], .ticket, [class*="ticket"]');
        console.log(`找到 ${betSlips.length} 个可能的注单区域`);

        for (const slip of betSlips) {
            // 在注单区域中查找输入框
            const inputs = slip.querySelectorAll('input[type="number"], input[type="text"], input:not([type]), input');
            if (inputs.length > 0) {
                // 优先选择有金额相关属性的输入框
                const amountRelatedInput = Array.from(inputs).find(input => {
                    const hasAmountClass = input.className.toLowerCase().includes('amount') || input.className.toLowerCase().includes('stake');
                    const hasAmountId = input.id.toLowerCase().includes('amount') || input.id.toLowerCase().includes('stake');
                    const hasAmountPlaceholder = input.placeholder && (input.placeholder.toLowerCase().includes('金额') || input.placeholder.toLowerCase().includes('stake') || input.placeholder.toLowerCase().includes('amount'));
                    return hasAmountClass || hasAmountId || hasAmountPlaceholder;
                });

                if (amountRelatedInput) {
                    amountInput = amountRelatedInput;
                    console.log('在注单区域中找到金额相关输入框');
                    break;
                } else {
                    // 如果没有找到金额相关输入框，使用第一个输入框
                    amountInput = inputs[0];
                    console.log('在注单区域中使用第一个输入框');
                    break;
                }
            }
        }

        // 方法2：使用常见的选择器
        if (!amountInput) {
            console.log('尝试使用常见选择器查找金额输入框');
            amountInput = document.querySelector('#singleBet, .btQuickA, input#singleBet, input.btQuickA, input[class*="amount"], input[class*="stake"], .amount, .stake, [class*="amount"], [class*="stake"]');
        }

        // 方法3：尝试查找任何数字输入框
        if (!amountInput) {
            console.log('尝试查找任何数字输入框');
            const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]'));

            // 查找可能的金额输入框
            amountInput = inputs.find(input => {
                // 检查输入框的属性和周围元素
                const hasAmountClass = input.className.toLowerCase().includes('amount') || input.className.toLowerCase().includes('stake');
                const hasAmountId = input.id.toLowerCase().includes('amount') || input.id.toLowerCase().includes('stake');
                const hasAmountPlaceholder = input.placeholder && (input.placeholder.toLowerCase().includes('金额') || input.placeholder.toLowerCase().includes('stake') || input.placeholder.toLowerCase().includes('amount'));
                const parentText = input.parentElement ? input.parentElement.textContent.toLowerCase() : '';
                const hasAmountParentText = parentText.includes('金额') || parentText.includes('金') || parentText.includes('额') || parentText.includes('stake') || parentText.includes('amount');

                return hasAmountClass || hasAmountId || hasAmountPlaceholder || hasAmountParentText;
            });
        }

        // 如果仍然找不到，尝试查找任何可见的输入框
        if (!amountInput) {
            console.log('尝试查找任何可见的输入框');
            const allInputs = Array.from(document.querySelectorAll('input'));

            // 过滤出可能的金额输入框（排除隐藏的、禁用的和只读的输入框）
            const visibleInputs = allInputs.filter(input => {
                const style = window.getComputedStyle(input);
                return style.display !== 'none' &&
                       style.visibility !== 'hidden' &&
                       !input.disabled &&
                       !input.readOnly;
            });

            if (visibleInputs.length > 0) {
                // 尝试找到最可能是金额输入框的元素
                amountInput = visibleInputs.find(input => {
                    // 检查输入框的类型
                    return input.type === 'number' || input.type === 'text';
                }) || visibleInputs[0]; // 如果没有找到合适的，使用第一个可见输入框
            }
        }

        // 如果找不到输入框，返回失败
        if (!amountInput) {
            showNotification('找不到下注金额输入框', 'error');
            return false;
        }

        // 设置金额
        console.log(`找到下注金额输入框，设置金额: ${amount}`);

        try {
            // 先点击输入框以激活它
            try {
                amountInput.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                amountInput.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                amountInput.click();
                await new Promise(resolve => setTimeout(resolve, 100));
                amountInput.focus();
                amountInput.click();
            } catch (mouseError) {
                console.error('模拟鼠标事件失败:', mouseError.message);
                // 如果模拟鼠标事件失败，直接使用focus和click
                amountInput.focus();
                amountInput.click();
            }

            // 先清空输入框
            amountInput.value = '';
            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 50));

            // 再次确认输入框处于激活状态
            amountInput.focus();
            amountInput.click();

            // 设置新的金额值
            amountInput.value = amount;
            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            amountInput.dispatchEvent(new Event('change', { bubbles: true }));

            // 触发回车键确认输入
            amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

            // 验证金额是否已设置
            if (!amountInput.value || amountInput.value === '0' || amountInput.value === '') {
                // 尝试直接设置value属性
                amountInput.value = amount;
                amountInput.setAttribute('value', amount);
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 最终验证
            if (!amountInput.value || amountInput.value === '0' || amountInput.value === '') {
                showNotification('下注金额设置失败，请手动输入金额', 'error');
                return false;
            }

            console.log(`金额已成功设置为: ${amountInput.value}`);
            return true;
        } catch (error) {
            console.error(`设置金额时出错: ${error.message}`);
            showNotification('设置金额时出错，请手动输入', 'error');
            return false;
        }
    }

    // 确认下注
    async function confirmBet() {
        console.log('尝试在注单区查找确认下注按钮');

        // 尝试多种可能的选择器
        let confirmButton = null;

        // 检查是否存在"接受全部赔率变动"按钮
        const acceptOddsChangeButton = document.querySelector('div.btBtn.btBtn2');
        if (acceptOddsChangeButton && acceptOddsChangeButton.textContent.includes('接受全部赔率变动')) {
            console.log('找到"接受全部赔率变动"按钮，点击接受');
            acceptOddsChangeButton.click();
            // 等待一小段时间，确保赔率变动被接受
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 方法0：优先使用用户提供的特定样式查找确认下注按钮
        console.log('尝试查找用户提供的确认下注按钮样式 div.btBtn:has(div.btExpR)');
        const userProvidedButton = document.querySelector('div.btBtn:has(div.btExpR)');
        if (userProvidedButton) {
            console.log('找到用户提供的确认下注按钮样式元素:', userProvidedButton.textContent);
            confirmButton = userProvidedButton;
        }

        // 方法1：优先在注单区域中查找确认按钮
        if (!confirmButton) {
            const betSlips = document.querySelectorAll('.betslip, [class*="betslip"], .bet-slip, [class*="bet-slip"], .betPanel, [class*="betPanel"], .slip, [class*="slip"], .ticket, [class*="ticket"]');
            console.log(`找到 ${betSlips.length} 个可能的注单区域`);

            for (const slip of betSlips) {
                // 在注单区域中查找按钮元素
                const buttons = slip.querySelectorAll('button, div[role="button"], div[class*="button"], div[class*="btn"], a[class*="button"], a[class*="btn"]');

                if (buttons.length > 0) {
                    // 优先查找包含确认、下注等文本的按钮
                    const confirmRelatedButton = Array.from(buttons).find(btn => {
                        const text = btn.textContent.toLowerCase();
                        return text.includes('确认') ||
                               text.includes('下注') ||
                               text.includes('提交') ||
                               text.includes('confirm') ||
                               text.includes('bet') ||
                               text.includes('place') ||
                               text.includes('submit');
                    });

                    if (confirmRelatedButton) {
                        confirmButton = confirmRelatedButton;
                        console.log('在注单区域中找到确认相关按钮');
                        break;
                    } else {
                        // 如果没有找到确认相关按钮，使用最后一个按钮（通常是确认按钮）
                        confirmButton = buttons[buttons.length - 1];
                        console.log('在注单区域中使用最后一个按钮');
                        break;
                    }
                }
            }
        }

        // 方法2：使用常见的选择器
        if (!confirmButton) {
            console.log('尝试使用常见选择器查找确认按钮');
            const commonSelectors = [
                'div.btBtn:not(.disabled)', 'div.btBtn.disabled',
                'div.btBtn:has(div.btExpR)',
                'div.btBtn', // 简单的btBtn类
                'div[class*="confirm"]', 'button[class*="confirm"]',
                '.btBtn', '[class*="btBtn"]',
                '.confirm', '[class*="confirm"]',
                '.submit', '[class*="submit"]',
                '.place-bet', '[class*="place-bet"]'
            ];

            for (const selector of commonSelectors) {
                try {
                    const buttons = document.querySelectorAll(selector);
                    console.log(`选择器 ${selector} 找到 ${buttons.length} 个元素`);
                    for (const button of buttons) {
                        if (button && button.textContent && (
                            button.textContent.includes('确认') ||
                            button.textContent.includes('下注') ||
                            button.textContent.includes('提交') ||
                            button.textContent.includes('确认下注') ||
                            button.textContent.includes('确定') ||
                            button.textContent.includes('确 认')
                        )) {
                            confirmButton = button;
                            console.log(`使用选择器 ${selector} 找到确认按钮: ${button.textContent}`);
                            break;
                        }
                    }
                    if (confirmButton) break;
                } catch (e) {
                    console.log(`选择器 ${selector} 不支持: ${e.message}`);
                }
            }

            // 检查按钮是否被禁用
            if (confirmButton && confirmButton.classList.contains('disabled')) {
                // 尝试移除disabled类以启用按钮
                console.log('尝试移除disabled类以启用按钮');
                confirmButton.classList.remove('disabled');
            }
        }

        // 方法3：查找可能的确认按钮
        if (!confirmButton) {
            console.log('尝试查找包含确认文本的按钮');
            // 查找包含"确认"、"下注"等文本的按钮或可点击元素
            const possibleButtons = Array.from(document.querySelectorAll('button, div[role="button"], div[class*="button"], div[class*="btn"], a[class*="button"], a[class*="btn"]'));

            confirmButton = possibleButtons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return text.includes('确认') ||
                       text.includes('下注') ||
                       text.includes('提交') ||
                       text.includes('confirm') ||
                       text.includes('bet') ||
                       text.includes('place') ||
                       text.includes('submit');
            });
        }

        // 方法4：使用用户提供的元素选择器
        if (!confirmButton) {
            console.log('尝试使用更宽松的选择器查找确认下注按钮');
            const allBtBtns = document.querySelectorAll('div.btBtn');
            console.log(`找到 ${allBtBtns.length} 个btBtn元素`);

            for (const btn of allBtBtns) {
                console.log(`检查btBtn元素: ${btn.textContent}`);
                if (btn.textContent.includes('确认下注')) {
                    confirmButton = btn;
                    console.log('找到确认下注按钮');
                    break;
                }
            }
        }

        // 如果找不到确认按钮，返回失败
        if (!confirmButton) {
            showNotification('找不到确认下注按钮', 'error');
            return false;
        }

        // 检查金额输入框是否有值
        const amountInput = document.querySelector('input[class*="amount"]');
        if (amountInput && (!amountInput.value || amountInput.value === '0' || amountInput.value === '')) {
            showNotification('请先输入下注金额', 'error');
            return false;
        }

        // 点击确认按钮
        console.log('点击确认下注按钮:', confirmButton.outerHTML);
        try {
            // 尝试多种点击方法
            // 1. 常规点击
            confirmButton.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            // 2. 模拟鼠标事件
            const rect = confirmButton.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // 模拟鼠标悬停
            confirmButton.dispatchEvent(new MouseEvent('mouseover', {
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
            }));

            await new Promise(resolve => setTimeout(resolve, 50));

            // 模拟鼠标按下
            confirmButton.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
            }));

            await new Promise(resolve => setTimeout(resolve, 50));

            // 模拟鼠标释放
            confirmButton.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
            }));

            await new Promise(resolve => setTimeout(resolve, 50));

            // 模拟点击
            confirmButton.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
            }));

            // 3. 如果有onclick属性，直接调用
            if (typeof confirmButton.onclick === 'function') {
                confirmButton.onclick();
            }

            // 4. 尝试触发任何可能的事件处理程序
            const possibleEvents = ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend'];
            for (const eventType of possibleEvents) {
                confirmButton.dispatchEvent(new Event(eventType, { bubbles: true }));
            }

            // 5. 尝试移除任何可能阻止点击的类
            if (confirmButton.classList.contains('disabled')) {
                confirmButton.classList.remove('disabled');
                confirmButton.click();
            }

            // 6. 尝试直接设置样式
            confirmButton.style.pointerEvents = 'auto';
            confirmButton.style.opacity = '1';
            confirmButton.style.cursor = 'pointer';

            // 7. 再次点击
            await new Promise(resolve => setTimeout(resolve, 100));
            confirmButton.click();
        } catch (error) {
            console.error('点击确认下注按钮时出错:', error);
        }

        // 等待一段时间，确保下注操作完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 检查是否出现滚球暂停弹窗
        if (await closeRollingPausePopup()) {
            console.log('确认下注后检测到滚球暂停弹窗，已关闭');
            showNotification('检测到滚球暂停，请稍后重试', 'warning');
            return false;
        }

        // 检查是否出现成功提示框并关闭
        await closeSuccessPopup();

        return true;
    }

    // 检测并关闭滚球暂停弹窗
    async function closeRollingPausePopup() {
        console.log('检查是否出现滚球暂停弹窗');
        try {
            // 查找滚球暂停弹窗
            const popupMsg = document.querySelector('div.popMsg.fadeShow');
            if (popupMsg && popupMsg.textContent.includes('滚球暂停')) {
                console.log('找到滚球暂停弹窗');

                // 查找关闭按钮 - 精确匹配 class="btn btnGrey"
                const closeButton = popupMsg.querySelector('div.btn.btnGrey');
                if (closeButton) {
                    console.log('点击滚球暂停弹窗的关闭按钮');
                    try {
                        // 尝试使用模拟鼠标事件点击
                        const mousedownEvent = new MouseEvent('mousedown', {
                            bubbles: true,
                            cancelable: true
                        });
                        closeButton.dispatchEvent(mousedownEvent);

                        const mouseupEvent = new MouseEvent('mouseup', {
                            bubbles: true,
                            cancelable: true
                        });
                        closeButton.dispatchEvent(mouseupEvent);

                        closeButton.click();
                    } catch (clickError) {
                        console.error(`模拟点击事件失败: ${clickError.message}，尝试直接点击`);
                        closeButton.click();
                    }

                    await new Promise(resolve => setTimeout(resolve, 300)); // 等待关闭动画完成
                    return true;
                } else {
                    // 如果找不到特定的关闭按钮，尝试点击任何按钮
                    const anyButton = popupMsg.querySelector('div.btn');
                    if (anyButton) {
                        console.log('未找到关闭按钮，尝试点击任何按钮');
                        anyButton.click();
                        await new Promise(resolve => setTimeout(resolve, 300));
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error(`关闭滚球暂停弹窗时出错: ${error.message}`);
            return false;
        }
    }

    // 关闭成功提示框
    async function closeSuccessPopup() {
        console.log('检查是否出现成功提示框或下注窗口');
        try {
            // 等待成功提示框出现
            for (let i = 0; i < 15; i++) { // 尝试15次，每次等待200ms
                // 方法1：尝试关闭成功提示框
                const successPopupSelectors = [
                    '.btBtn.btBtn3', 'div.btBtn.btBtn3', 'button.btBtn.btBtn3', '.btBtn3', '[class*="btBtn3"]',
                    '.success-popup [class*="close"]', '.success-message [class*="close"]',
                    '[class*="success"] [class*="close"]', '[class*="success"] [class*="btn"]',
                    '[class*="success-popup"]', '[class*="success-message"]'
                ];

                for (const selector of successPopupSelectors) {
                    const successPopup = document.querySelector(selector);
                    if (successPopup) {
                        console.log(`找到成功提示框，使用选择器 ${selector} 点击关闭按钮`);
                        // 模拟完整的点击事件
                        try {
                            successPopup.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                            successPopup.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                            successPopup.click();
                        } catch (mouseError) {
                            console.error('模拟鼠标事件失败:', mouseError.message);
                            // 如果模拟鼠标事件失败，直接使用click
                            successPopup.click();
                        }
                        await new Promise(resolve => setTimeout(resolve, 300)); // 等待关闭动画完成
                        break;
                    }
                }

                // 方法2：尝试关闭下注窗口
                const betPanelCloseSelectors = [
                    '.betslip [class*="close"]', '.bet-slip [class*="close"]',
                    '.betPanel [class*="close"]', '.slip [class*="close"]',
                    '[class*="betslip"] [class*="close"]', '[class*="bet-slip"] [class*="close"]',
                    '[class*="betPanel"] [class*="close"]', '[class*="slip"] [class*="close"]',
                    '.close-bet', '[class*="close-bet"]'
                ];

                for (const selector of betPanelCloseSelectors) {
                    const closeButton = document.querySelector(selector);
                    if (closeButton) {
                        console.log(`找到下注窗口关闭按钮，使用选择器 ${selector}`);
                        closeButton.click();
                        await new Promise(resolve => setTimeout(resolve, 300));
                        break;
                    }
                }

                // 方法3：尝试查找其他可能的提示框或弹窗
                const popupSelectors = [
                    'div[class*="popup"]', 'div[class*="modal"]', 'div[class*="dialog"]', 'div[class*="message"]',
                    '.popup', '.modal', '.dialog', '.message'
                ];

                for (const selector of popupSelectors) {
                    const popups = document.querySelectorAll(selector);
                    for (const popup of popups) {
                        // 检查是否可见
                        const style = window.getComputedStyle(popup);
                        if (style.display === 'none' || style.visibility === 'hidden') continue;

                        // 检查是否包含关闭按钮或确认按钮
                        const closeButtons = popup.querySelectorAll('button, div[role="button"], div[class*="close"], div[class*="confirm"], div[class*="ok"], [class*="close"], [class*="confirm"], [class*="ok"]');
                        if (closeButtons.length > 0) {
                            console.log(`找到可能的提示框，点击关闭按钮`);
                            closeButtons[0].click();
                            await new Promise(resolve => setTimeout(resolve, 300));
                            break;
                        } else {
                            // 如果没有找到明确的关闭按钮，尝试点击弹窗本身
                            console.log(`找到可能的提示框，但没有明确的关闭按钮，尝试点击弹窗本身`);
                            popup.click();
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }
            return true; // 即使没有找到弹窗也返回成功，因为可能没有弹窗出现
        } catch (error) {
            console.error(`关闭成功提示框时出错: ${error.message}`);
            return false;
        }
    }

    // 显示通知
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.textContent = message;

        // 根据类型设置不同的样式
        let bgColor = 'rgba(25, 118, 210, 0.9)'; // 默认蓝色（信息）

        if (type === 'success') {
            bgColor = 'rgba(46, 125, 50, 0.9)'; // 绿色
        } else if (type === 'error') {
            bgColor = 'rgba(211, 47, 47, 0.9)'; // 红色
        } else if (type === 'warning') {
            bgColor = 'rgba(237, 108, 2, 0.9)'; // 橙色
        }

        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: ${bgColor};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10003;
            animation: fadeInOut 2s ease forwards;
        `;

        document.body.appendChild(notification);

        // 2秒后移除通知
        setTimeout(function() {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 2000);
    }

    // 初始化函数
    // 投注记录数据结构
    let betRecords = [];

    // 加载投注记录
    function loadBetRecords() {
        try {
            const savedRecords = GM_getValue('betRecords');
            if (savedRecords) {
                betRecords = JSON.parse(savedRecords);
                console.log('已加载保存的投注记录');
            }
        } catch (e) {
            console.error('加载投注记录失败:', e);
            betRecords = [];
        }
    }

    // 保存投注记录
    function saveBetRecords() {
        try {
            GM_setValue('betRecords', JSON.stringify(betRecords));
            console.log('投注记录已保存');
        } catch (e) {
            console.error('保存投注记录失败:', e);
        }
    }

    function init() {
        // 初始化空的比赛数据
        collectedData = {
            matches: [],
            lastUpdate: new Date()
        };

        // 加载用户设置和投注记录
        loadSettings();
        loadBetRecords();

        // 不再拦截WebSocket和XHR请求，只使用DOM提取的数据
        // interceptWebSocket();
        // interceptXHR();

        // 等待DOM加载完成
        window.addEventListener('load', function() {
            // 创建投注记录弹窗和比赛数据弹窗
            createBetRecordsPopup();
            createMatchesPopup();

            // 从DOM提取初始比赛数据
            setTimeout(function() {
                extractMatchesFromDOM();
            }, 2000);

            // 设置自动刷新
            setupAutoRefresh();

            // 添加淡入淡出动画样式
            const fadeStyle = document.createElement('style');
            fadeStyle.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    10% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                }

                /* 胜率进度条样式 */
                .statsProg.higher {
                    background-color: rgba(76, 175, 80, 0.7) !important;
                }

                .statsProg.lower {
                    background-color: rgba(255, 152, 0, 0.7) !important;
                }

                /* 胜率数据容器动画 */
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                .statsInfo {
                    animation: slideInRight 0.5s ease-out forwards;
                }


                .statsProg.lower {
                    background-color: rgba(255, 152, 0, 0.7) !important;
                }

                /* 胜率数据容器动画 */
                @keyframes slideDown {
                    from { max-height: 0; opacity: 0; }
                    to { max-height: 200px; opacity: 1; }
                }

                .statsInfo {
                    overflow: hidden;
                    animation: slideDown 0.5s ease-in-out;
                }
            `;
            document.head.appendChild(fadeStyle);
        });
    }

    // 启动脚本
    init();

})();
