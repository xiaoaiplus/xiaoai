// ==UserScript==
// @name         电竞数据采集器增强版
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  获取电竞网站的实时比赛数据，支持DOM元素选择、比赛分析和自动下单
// @author       Trae AI
// @match        https://imes-0hloh.takatakz.xyz/esportsitev2/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('电竞数据采集器增强版已启动');

    // 存储收集到的数据
    let collectedData = {
        matches: [],
        events: [],
        domElements: [],
        teamStats: {},      // 队伍统计数据
        betHistory: [],     // 下单历史
        predictions: [],    // 预测结果
        lastUpdate: null,
        logs: []           // 日志记录
    };

    // 创建日志弹窗
    function createLogPopup() {
        // 检查是否已存在日志弹窗
        let logPopup = document.getElementById('log-popup');
        if (logPopup) return logPopup;

        // 创建日志弹窗
        logPopup = document.createElement('div');
        logPopup.id = 'log-popup';
        logPopup.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 420px;
            max-height: 550px;
            background-color: rgba(0, 0, 0, 0.85);
            color: white;
            z-index: 10000;
            border-radius: 12px;
            padding: 15px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            overflow: hidden;
            box-shadow: 0 0 25px rgba(0, 0, 0, 0.7);
            transition: all 0.3s ease;
            border: 1px solid rgba(100, 100, 100, 0.4);
            backdrop-filter: blur(8px);
            animation: slideIn 0.5s ease-out;
            display: flex;
            flex-direction: column;
        `;

        // 添加日志标题
        const logHeader = document.createElement('div');
        logHeader.style.cssText = `
            padding: 12px;
            background: linear-gradient(to right, #1a1a1a, #2a2a2a);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            border-radius: 8px 8px 0 0;
        `;
        logHeader.innerHTML = '<h4 style="margin: 0; color: #00ff99; text-shadow: 0 0 5px rgba(0,255,153,0.4);">电竞数据采集器 - 系统日志</h4>';
        logPopup.appendChild(logHeader);

        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.cssText = `
            background-color: rgba(255, 0, 0, 0.7);
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
            box-shadow: 0 0 5px rgba(255, 0, 0, 0.3);
        `;
        closeBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
            this.style.transform = 'scale(1.05)';
        };
        closeBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            this.style.transform = 'scale(1)';
        };
        closeBtn.onclick = function() {
            logPopup.style.display = 'none';
        };
        logHeader.appendChild(closeBtn);

        // 创建选项卡容器
        const tabsContainer = document.createElement('div');
        tabsContainer.style.cssText = `
            display: flex;
            margin-bottom: 10px;
            border-bottom: 1px solid #444;
        `;
        logPopup.appendChild(tabsContainer);

        // 创建日志选项卡
        const logsTab = document.createElement('div');
        logsTab.textContent = '系统日志';
        logsTab.className = 'log-tab active';
        logsTab.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            background-color: rgba(0, 80, 40, 0.3);
            border-radius: 5px 5px 0 0;
            margin-right: 5px;
            font-weight: bold;
            color: #00ff99;
            border: 1px solid #444;
            border-bottom: none;
        `;
        tabsContainer.appendChild(logsTab);

        // 创建今日比赛选项卡
        const matchesTab = document.createElement('div');
        matchesTab.textContent = '今日比赛';
        matchesTab.className = 'log-tab';
        matchesTab.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            background-color: rgba(50, 50, 50, 0.3);
            border-radius: 5px 5px 0 0;
            font-weight: bold;
            color: #cccccc;
            border: 1px solid #444;
            border-bottom: none;
        `;
        tabsContainer.appendChild(matchesTab);

        // 创建内容容器
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        logPopup.appendChild(contentContainer);

        // 添加日志内容容器
        const logContent = document.createElement('div');
        logContent.id = 'logs-container';
        logContent.style.cssText = `
            max-height: 350px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #666 #333;
            padding: 10px;
            background-color: rgba(20, 20, 20, 0.6);
            border-radius: 8px;
            border: 1px solid rgba(80, 80, 80, 0.2);
            display: block;
            flex: 1;
        `;
        contentContainer.appendChild(logContent);

        // 添加今日比赛容器
        const matchesContent = document.createElement('div');
        matchesContent.id = 'today-matches-container';
        matchesContent.style.cssText = `
            max-height: 350px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #666 #333;
            padding: 10px;
            background-color: rgba(20, 20, 20, 0.6);
            border-radius: 8px;
            border: 1px solid rgba(80, 80, 80, 0.2);
            display: none;
            flex: 1;
        `;
        contentContainer.appendChild(matchesContent);

        // 添加选项卡切换功能
        logsTab.addEventListener('click', function() {
            logsTab.style.backgroundColor = 'rgba(0, 80, 40, 0.3)';
            logsTab.style.color = '#00ff99';
            matchesTab.style.backgroundColor = 'rgba(50, 50, 50, 0.3)';
            matchesTab.style.color = '#cccccc';
            logContent.style.display = 'block';
            matchesContent.style.display = 'none';
            logsTab.className = 'log-tab active';
            matchesTab.className = 'log-tab';
        });

        matchesTab.addEventListener('click', function() {
            matchesTab.style.backgroundColor = 'rgba(0, 50, 80, 0.3)';
            matchesTab.style.color = '#00ccff';
            logsTab.style.backgroundColor = 'rgba(50, 50, 50, 0.3)';
            logsTab.style.color = '#cccccc';
            logContent.style.display = 'none';
            matchesContent.style.display = 'block';
            matchesTab.className = 'log-tab active';
            logsTab.className = 'log-tab';
            updateTodayMatchesInPopup(); // 更新今日比赛数据
        });

        // 添加自定义滚动条样式和动画
        const logStyle = document.createElement('style');
        logStyle.textContent = `
            #logs-container::-webkit-scrollbar,
            #today-matches-container::-webkit-scrollbar {
                width: 6px;
            }
            #logs-container::-webkit-scrollbar-track,
            #today-matches-container::-webkit-scrollbar-track {
                background: #222;
                border-radius: 4px;
            }
            #logs-container::-webkit-scrollbar-thumb,
            #today-matches-container::-webkit-scrollbar-thumb {
                background-color: #555;
                border-radius: 4px;
                border: 1px solid #333;
            }
            #logs-container::-webkit-scrollbar-thumb:hover,
            #today-matches-container::-webkit-scrollbar-thumb:hover {
                background-color: #777;
            }
            .log-tab.active {
                position: relative;
                z-index: 1;
            }
            .log-tab.active::after {
                content: '';
                position: absolute;
                bottom: -1px;
                left: 0;
                right: 0;
                height: 1px;
                background-color: rgba(20, 20, 20, 0.6);
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
                background-color: rgba(30, 30, 40, 0.7);
                border-radius: 8px;
                border-left: 3px solid #00ccff;
                animation: fadeIn 0.3s ease;
                transition: all 0.2s ease;
            }
            .match-item:hover {
                transform: translateX(2px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            .match-teams {
                font-weight: bold;
                margin-bottom: 5px;
                color: #ffffff;
            }
            .match-info {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #aaaaaa;
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
                background-color: rgba(0, 0, 0, 0.3);
            }
        `;
        document.head.appendChild(logStyle);

        document.body.appendChild(logPopup);
        return logPopup;
    }

    // 日志输出函数
    function logToUI(message, type = 'info') {
        const logEntry = {
            message: message,
            type: type,
            timestamp: new Date()
        };

        // 添加到日志记录
        collectedData.logs.push(logEntry);

        // 限制日志数量，保留最新的50条
        if (collectedData.logs.length > 50) {
            collectedData.logs.shift();
        }

        // 输出到控制台
        console.log(`[${type.toUpperCase()}] ${message}`);

        // 确保日志弹窗存在
        createLogPopup();

        // 更新日志UI
        updateLogsUI();

        // 显示日志弹窗（如果隐藏状态）
        const logPopup = document.getElementById('log-popup');
        if (logPopup && logPopup.style.display === 'none') {
            logPopup.style.display = 'block';

            // 确保显示日志选项卡
            const logsTab = logPopup.querySelector('.log-tab.active');
            const matchesTab = logPopup.querySelector('.log-tab:not(.active)');
            const logsContainer = document.getElementById('logs-container');
            const matchesContainer = document.getElementById('today-matches-container');

            if (logsTab && matchesTab && logsContainer && matchesContainer) {
                logsTab.style.backgroundColor = 'rgba(0, 80, 40, 0.3)';
                logsTab.style.color = '#00ff99';
                matchesTab.style.backgroundColor = 'rgba(50, 50, 50, 0.3)';
                matchesTab.style.color = '#cccccc';
                logsContainer.style.display = 'block';
                matchesContainer.style.display = 'none';
                logsTab.className = 'log-tab active';
                matchesTab.className = 'log-tab';
            }
        }

        // 自动隐藏日志（除了错误和警告）
        if (type !== 'error' && type !== 'warning') {
            setTimeout(() => {
                // 检查是否有更新的错误或警告日志
                const hasRecentErrorOrWarning = collectedData.logs
                    .slice(-5) // 检查最近5条日志
                    .some(log => log.type === 'error' || log.type === 'warning');

                // 如果没有错误或警告，则隐藏日志弹窗
                if (!hasRecentErrorOrWarning && logPopup) {
                    // 添加淡出动画
                    logPopup.style.animation = 'fadeOut 0.5s forwards';
                    setTimeout(() => {
                        if (logPopup) logPopup.style.display = 'none';
                    }, 500);
                }
            }, 8000); // 8秒后自动隐藏
        }
    }

    // 在弹窗中更新今日比赛数据
    function updateTodayMatchesInPopup() {
        const matchesContainer = document.getElementById('today-matches-container');
        if (!matchesContainer) return;

        // 获取今天的日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 筛选今日比赛
        const todayMatches = collectedData.matches.filter(match => {
            const matchDate = new Date(match.startTime || match.time || Date.now());
            matchDate.setHours(0, 0, 0, 0);
            return matchDate.getTime() === today.getTime();
        });

        let html = '';

        if (todayMatches.length > 0) {
            // 按照开始时间排序
            todayMatches.sort((a, b) => {
                const timeA = new Date(a.startTime || a.time || Date.now()).getTime();
                const timeB = new Date(b.startTime || b.time || Date.now()).getTime();
                return timeA - timeB;
            });

            // 生成比赛列表HTML
            todayMatches.forEach((match, index) => {
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

                // 根据状态设置颜色
                let statusColor = '#aaaaaa';
                if (status === '进行中') statusColor = '#00ccff';
                if (status === '已结束') statusColor = '#999999';

                // 构建比赛项HTML
                html += `
                    <div class="match-item" data-match-id="${match.id}">
                        <div class="match-teams">${team1} vs ${team2}</div>
                        <div class="match-info">
                            <span>时间: ${timeStr}</span>
                            <span style="color: ${statusColor};">状态: ${status}</span>
                        </div>
                        <div class="match-odds">
                            <span class="team-odd" style="color: #ff9900;">${team1}: ${typeof odds1 === 'number' ? odds1.toFixed(2) : odds1}</span>
                            <span class="team-odd" style="color: #00ccff;">${team2}: ${typeof odds2 === 'number' ? odds2.toFixed(2) : odds2}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            html = '<div style="color: #aaaaaa; font-style: italic; text-align: center; padding: 15px; background-color: rgba(30,30,30,0.5); border-radius: 8px;">暂无今日比赛数据</div>';
        }

        matchesContainer.innerHTML = html;

        // 添加点击事件，点击比赛项可以查看详情
        const matchItems = matchesContainer.querySelectorAll('.match-item');
        matchItems.forEach(item => {
            item.addEventListener('click', function() {
                const matchId = this.dataset.matchId;
                const match = todayMatches.find(m => m.id === matchId);
                if (match) {
                    // 这里可以添加显示比赛详情的逻辑
                    console.log('查看比赛详情:', match);
                    alert(`比赛详情: ${match.teams[0].name} vs ${match.teams[1].name}\n状态: ${match.status || '未知'}`);
                }
            });
        });
    }

    // 加载保存的数据
    try {
        const savedData = GM_getValue('esportsData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            // 只恢复部分数据，避免覆盖当前会话的实时数据
            if (parsedData.teamStats) collectedData.teamStats = parsedData.teamStats;
            if (parsedData.betHistory) collectedData.betHistory = parsedData.betHistory;
            console.log('已加载保存的数据');
        }

        // 加载保存的设置
        const savedBetConfig = GM_getValue('betConfig');
        if (savedBetConfig) {
            try {
                const parsedBetConfig = JSON.parse(savedBetConfig);
                // 合并保存的设置到当前设置
                if (parsedBetConfig.enabled !== undefined) betConfig.enabled = parsedBetConfig.enabled;
                if (parsedBetConfig.minOdds !== undefined) betConfig.minOdds = parsedBetConfig.minOdds;
                if (parsedBetConfig.maxOdds !== undefined) betConfig.maxOdds = parsedBetConfig.maxOdds;
                if (parsedBetConfig.betAmount !== undefined) betConfig.betAmount = parsedBetConfig.betAmount;
                if (parsedBetConfig.confidenceThreshold !== undefined) betConfig.confidenceThreshold = parsedBetConfig.confidenceThreshold;
                if (parsedBetConfig.autoConfirm !== undefined) betConfig.autoConfirm = parsedBetConfig.autoConfirm;
                if (parsedBetConfig.riskLevel !== undefined) betConfig.riskLevel = parsedBetConfig.riskLevel;

                // 加载赔率调整设置
                if (parsedBetConfig.oddsAdjustment) {
                    if (parsedBetConfig.oddsAdjustment.enabled !== undefined) {
                        betConfig.oddsAdjustment.enabled = parsedBetConfig.oddsAdjustment.enabled;
                    }
                    if (parsedBetConfig.oddsAdjustment.thresholds && Array.isArray(parsedBetConfig.oddsAdjustment.thresholds)) {
                        betConfig.oddsAdjustment.thresholds = parsedBetConfig.oddsAdjustment.thresholds;
                    }
                }

                // 加载游戏规则设置
                if (parsedBetConfig.gameRules) {
                    if (parsedBetConfig.gameRules.minGameTime) {
                        betConfig.gameRules.minGameTime = {...betConfig.gameRules.minGameTime, ...parsedBetConfig.gameRules.minGameTime};
                    }
                    if (parsedBetConfig.gameRules.startTimeOddsLimit) {
                        betConfig.gameRules.startTimeOddsLimit = {...betConfig.gameRules.startTimeOddsLimit, ...parsedBetConfig.gameRules.startTimeOddsLimit};
                    }
                }

                console.log('已加载保存的下注设置');
            } catch (e) {
                console.error('解析保存的下注设置失败:', e);
            }
        }

        // 加载更新配置
        const savedUpdateConfig = GM_getValue('updateConfig');
        if (savedUpdateConfig) {
            try {
                const parsedUpdateConfig = JSON.parse(savedUpdateConfig);
                // 合并保存的设置到当前设置
                updateConfig = {...updateConfig, ...parsedUpdateConfig};
                console.log('已加载保存的更新设置');
            } catch (e) {
                console.error('解析保存的更新设置失败:', e);
            }
        }
    } catch (e) {
        console.error('加载保存数据失败:', e);
    }

    // 自动下单配置
    const betConfig = {
        enabled: false,           // 是否启用自动下单
        minOdds: 1.5,            // 最小赔率
        maxOdds: 3.0,            // 最大赔率
        betAmount: 10,           // 默认下注金额
        confidenceThreshold: 70, // 置信度阈值(百分比)
        autoConfirm: false,      // 自动确认下单
        riskLevel: 'medium',     // 风险等级: low, medium, high

        // 赔率调整配置
        oddsAdjustment: {
            enabled: true,        // 是否启用赔率调整
            thresholds: [
                { threshold: 2.60, betPercentage: 40 },  // 赔率超过2.60，下注额为默认的40%
                { threshold: 2.10, betPercentage: 60 }   // 赔率超过2.10，下注额为默认的60%
            ]
        },

        // 游戏特定规则配置
        gameRules: {
            // 最小开局时间限制（分钟）
            minGameTime: {
                'LOL': 30,        // 英雄联盟：30分钟才下单
                'KOG': 20,        // 王者荣耀：20分钟才下单
                'CSGO': 30,       // CS:GO：30分钟才下单
                'DOTA2': 30,      // DOTA2：30分钟才下单
                'WildRift': 0     // 激斗峡谷：0分钟才下单
            },
            // 开局时间+赔率限制
            startTimeOddsLimit: {
                'LOL': { time: 0, maxOdds: 6.00 },      // 英雄联盟：比赛时间0分的时候，赔率是6.00这个比赛不下单
                'DOTA2': { time: 0, maxOdds: 7.00 },    // DOTA2：比赛时间时间0分的时候，赔率是7.00这个比赛不下单
                'KOG': { time: 0, maxOdds: 5.00 },      // 王者荣耀：比赛时间时间0，赔率是5.00这个比赛不下单
                'CSGO': { time: 0, maxOdds: 7.00 },     // CS:GO：比赛时间时间0，赔率是7.00这个比赛不下单
                'WildRift': { time: 0, maxOdds: 5.00 }  // 激斗峡谷：比赛时间时间0，赔率是5.00这个比赛不下单
            }
        }
    };

    // 设置按钮配置
    const settingsConfig = {
        visible: false,           // 设置面板是否可见
        activeTab: 'general'      // 当前激活的设置选项卡
    };

    // 实时数据更新配置
    const updateConfig = {
        enabled: true,              // 是否启用实时数据更新
        matchInterval: 30,         // 比赛数据更新间隔(秒)
        oddsInterval: 15,          // 赔率更新间隔(秒)
        analysisInterval: 60,      // 分析更新间隔(秒)
        showNotifications: true,   // 是否显示更新通知
        highlightChanges: true,    // 是否高亮显示变化
        autoRefreshDOM: true,      // 是否自动刷新DOM元素
        lastMatchUpdate: null,     // 上次比赛数据更新时间
        lastOddsUpdate: null,      // 上次赔率更新时间
        lastAnalysisUpdate: null   // 上次分析更新时间
    };

    // 选择器模式状态
    let selectorMode = false;
    let hoveredElement = null;
    let selectedElements = [];

    // 分析状态
    let analysisActive = false;
    let lastAnalysisTime = null;

    // 创建DOM选择器工具
    function createDOMSelector() {
        // 创建选择器工具栏
        const selectorToolbar = document.createElement('div');
        selectorToolbar.id = 'dom-selector-toolbar';
        selectorToolbar.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            z-index: 10001;
            border-radius: 5px;
            padding: 10px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            display: none;
        `;

        // 添加工具栏标题
        const toolbarTitle = document.createElement('div');
        toolbarTitle.innerHTML = '<h4 style="margin: 0 0 10px 0; color: #00ff00;">DOM选择器模式</h4>';
        selectorToolbar.appendChild(toolbarTitle);

        // 添加说明文字
        const instructions = document.createElement('div');
        instructions.innerHTML = '<p style="margin: 0 0 10px 0;">鼠标悬停在元素上，点击选择要监控的元素</p>';
        selectorToolbar.appendChild(instructions);

        // 添加当前悬停元素信息
        const hoverInfo = document.createElement('div');
        hoverInfo.id = 'hover-element-info';
        hoverInfo.style.cssText = `
            margin: 5px 0;
            padding: 5px;
            background-color: rgba(50, 50, 50, 0.5);
            border-radius: 3px;
            max-width: 300px;
            word-break: break-all;
        `;
        selectorToolbar.appendChild(hoverInfo);

        // 添加完成按钮
        const doneButton = document.createElement('button');
        doneButton.textContent = '完成选择';
        doneButton.style.cssText = `
            margin-top: 10px;
            background-color: #00aa00;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 5px 10px;
            cursor: pointer;
        `;
        doneButton.onclick = function() {
            toggleSelectorMode(false);
        };
        selectorToolbar.appendChild(doneButton);

        document.body.appendChild(selectorToolbar);

        return selectorToolbar;
    }

    // 切换选择器模式
    function toggleSelectorMode(enable) {
        selectorMode = enable;
        const toolbar = document.getElementById('dom-selector-toolbar');

        if (enable) {
            toolbar.style.display = 'block';
            document.body.style.cursor = 'crosshair';
            addSelectorEventListeners();
        } else {
            toolbar.style.display = 'none';
            document.body.style.cursor = 'default';
            removeSelectorEventListeners();
            updateSelectedElementsUI();
        }
    }

    // 添加选择器事件监听
    function addSelectorEventListeners() {
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);
        document.addEventListener('click', handleElementClick);
    }

    // 移除选择器事件监听
    function removeSelectorEventListeners() {
        document.removeEventListener('mouseover', handleMouseOver);
        document.removeEventListener('mouseout', handleMouseOut);
        document.removeEventListener('click', handleElementClick);
    }

    // 处理鼠标悬停事件
    function handleMouseOver(e) {
        if (!selectorMode) return;

        e.stopPropagation();
        hoveredElement = e.target;

        // 高亮悬停元素
        hoveredElement.dataset.originalOutline = hoveredElement.style.outline;
        hoveredElement.style.outline = '2px solid #ff0000';

        // 更新悬停信息
        updateHoverInfo(hoveredElement);
    }

    // 处理鼠标移出事件
    function handleMouseOut(e) {
        if (!selectorMode || !hoveredElement) return;

        e.stopPropagation();

        // 恢复原始样式
        hoveredElement.style.outline = hoveredElement.dataset.originalOutline || '';
        hoveredElement = null;

        // 清空悬停信息
        const hoverInfo = document.getElementById('hover-element-info');
        if (hoverInfo) {
            hoverInfo.innerHTML = '';
        }
    }

    // 处理元素点击事件
    function handleElementClick(e) {
        if (!selectorMode || !hoveredElement) return;

        e.preventDefault();
        e.stopPropagation();

        // 生成元素选择器
        const selector = generateSelector(hoveredElement);

        // 检查是否已经选择了该元素
        const exists = selectedElements.some(el => el.selector === selector);
        if (!exists) {
            // 添加到已选择元素列表
            selectedElements.push({
                selector: selector,
                name: `元素 ${selectedElements.length + 1}`,
                element: hoveredElement,
                value: hoveredElement.textContent.trim(),
                timestamp: new Date()
            });

            // 添加到收集数据中
            collectedData.domElements.push({
                selector: selector,
                name: `元素 ${collectedData.domElements.length + 1}`,
                value: hoveredElement.textContent.trim(),
                timestamp: new Date()
            });

            // 提示用户已添加
            alert(`已添加元素: ${selector}`);
        } else {
            alert('该元素已被选择');
        }
    }

    // 更新悬停信息
    function updateHoverInfo(element) {
        const hoverInfo = document.getElementById('hover-element-info');
        if (!hoverInfo) return;

        const selector = generateSelector(element);
        const tagName = element.tagName.toLowerCase();
        const className = element.className ? `.${element.className.replace(/ /g, '.')}` : '';
        const id = element.id ? `#${element.id}` : '';
        const text = element.textContent.trim().substring(0, 50) + (element.textContent.trim().length > 50 ? '...' : '');

        hoverInfo.innerHTML = `
            <div><strong>元素:</strong> ${tagName}${id}${className}</div>
            <div><strong>选择器:</strong> ${selector}</div>
            <div><strong>内容:</strong> ${text}</div>
        `;
    }

    // 生成元素选择器
    function generateSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }

        let selector = element.tagName.toLowerCase();
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c);
            if (classes.length > 0) {
                selector += `.${classes.join('.')}`;
            }
        }

        // 如果选择器太通用，添加父元素信息
        if (selector === 'div' || selector === 'span' || selector === 'p') {
            const parent = element.parentElement;
            if (parent && parent !== document.body) {
                const parentSelector = generateSelector(parent);
                selector = `${parentSelector} > ${selector}`;
            }
        }

        return selector;
    }

    // 更新已选择元素的UI
    function updateSelectedElementsUI() {
        const selectedElementsContainer = document.getElementById('selected-elements-container');
        if (!selectedElementsContainer) return;

        let html = '';

        if (selectedElements.length > 0) {
            html += '<h4 style="margin: 5px 0; color: #00ff00;">已选择的元素:</h4>';
            html += '<div style="max-height: 200px; overflow-y: auto;">';

            selectedElements.forEach((item, index) => {
                // 尝试获取最新的值
                try {
                    const el = document.querySelector(item.selector);
                    if (el) {
                        item.value = el.textContent.trim();
                        item.timestamp = new Date();

                        // 更新收集数据
                        const dataItem = collectedData.domElements.find(d => d.selector === item.selector);
                        if (dataItem) {
                            dataItem.value = item.value;
                            dataItem.timestamp = item.timestamp;
                        }
                    }
                } catch (e) {
                    console.error('选择器错误:', e);
                }

                html += `<div style="margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                    <div><strong>${item.name}</strong> [${item.selector}]</div>
                    <div>值: ${item.value}</div>
                    <div>更新时间: ${item.timestamp.toLocaleTimeString()}</div>
                    <button class="remove-element-btn" data-index="${index}" style="
                        margin-top: 5px;
                        background-color: #cc0000;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        padding: 2px 5px;
                        cursor: pointer;
                        font-size: 10px;
                    ">移除</button>
                </div>`;
            });

            html += '</div>';
        } else {
            html += '<div>尚未选择任何元素</div>';
        }

        selectedElementsContainer.innerHTML = html;

        // 添加移除按钮事件
        const removeButtons = selectedElementsContainer.querySelectorAll('.remove-element-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                removeSelectedElement(index);
            });
        });
    }

    // 移除已选择的元素
    function removeSelectedElement(index) {
        if (index >= 0 && index < selectedElements.length) {
            const selector = selectedElements[index].selector;

            // 从选择列表中移除
            selectedElements.splice(index, 1);

            // 从收集数据中移除
            const dataIndex = collectedData.domElements.findIndex(d => d.selector === selector);
            if (dataIndex !== -1) {
                collectedData.domElements.splice(dataIndex, 1);
            }

            // 更新UI
            updateSelectedElementsUI();
        }
    }

    // 定期检查选择的元素
    function monitorSelectedElements() {
        selectedElements.forEach(item => {
            try {
                const el = document.querySelector(item.selector);
                if (el) {
                    const newValue = el.textContent.trim();

                    // 如果值发生变化，更新并记录
                    if (newValue !== item.value) {
                        item.value = newValue;
                        item.timestamp = new Date();

                        // 更新收集数据
                        const dataItem = collectedData.domElements.find(d => d.selector === item.selector);
                        if (dataItem) {
                            dataItem.value = newValue;
                            dataItem.timestamp = new Date();
                        }

                        console.log(`元素 [${item.selector}] 值已更新: ${newValue}`);
                    }
                }
            } catch (e) {
                console.error('监控元素错误:', e);
            }
        });

        // 更新UI
        updateSelectedElementsUI();
    }

    // 创建设置面板
    function createSettingsPanel() {
        // 如果已存在设置面板，则移除
        const existingPanel = document.getElementById('settings-panel');
        if (existingPanel) {
            document.body.removeChild(existingPanel);
        }

        // 创建设置面板
        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'settings-panel';
        settingsPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            background-color: rgba(0, 0, 0, 0.9);
            color: white;
            z-index: 10002;
            border-radius: 8px;
            padding: 0;
            font-family: Arial, sans-serif;
            font-size: 14px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.7);
            display: ${settingsConfig.visible ? 'block' : 'none'};
        `;

        // 创建设置面板标题栏
        const settingsHeader = document.createElement('div');
        settingsHeader.style.cssText = `
            padding: 15px 20px;
            background: linear-gradient(to right, #333333, #555555);
            border-bottom: 1px solid #666;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        settingsHeader.innerHTML = '<h3 style="margin: 0; color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">脚本设置</h3>';
        settingsPanel.appendChild(settingsHeader);

        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: none;
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0 5px;
        `;
        closeBtn.onclick = function() {
            settingsConfig.visible = false;
            settingsPanel.style.display = 'none';
        };
        settingsHeader.appendChild(closeBtn);

        // 创建选项卡容器
        const tabsContainer = document.createElement('div');
        tabsContainer.style.cssText = `
            display: flex;
            background-color: #333;
            border-bottom: 1px solid #444;
        `;
        settingsPanel.appendChild(tabsContainer);

        // 定义选项卡
        const tabs = [
            { id: 'general', name: '常规设置' },
            { id: 'betting', name: '下注设置' },
            { id: 'odds', name: '赔率调整' },
            { id: 'gameRules', name: '游戏规则' }
        ];

        // 创建选项卡按钮
        tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.textContent = tab.name;
            tabBtn.dataset.tabId = tab.id;
            tabBtn.style.cssText = `
                background-color: ${settingsConfig.activeTab === tab.id ? '#555' : '#333'};
                color: ${settingsConfig.activeTab === tab.id ? '#fff' : '#ccc'};
                border: none;
                padding: 12px 20px;
                cursor: pointer;
                font-size: 14px;
                flex: 1;
                transition: background-color 0.2s;
            `;
            tabBtn.onmouseover = function() {
                if (settingsConfig.activeTab !== tab.id) {
                    this.style.backgroundColor = '#444';
                }
            };
            tabBtn.onmouseout = function() {
                if (settingsConfig.activeTab !== tab.id) {
                    this.style.backgroundColor = '#333';
                }
            };
            tabBtn.onclick = function() {
                settingsConfig.activeTab = tab.id;
                updateSettingsUI();
            };
            tabsContainer.appendChild(tabBtn);
        });

        // 创建内容区域
        const contentContainer = document.createElement('div');
        contentContainer.id = 'settings-content';
        contentContainer.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            max-height: calc(80vh - 120px);
        `;
        settingsPanel.appendChild(contentContainer);

        // 添加底部按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            padding: 15px 20px;
            background-color: #333;
            border-top: 1px solid #444;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        // 添加保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存设置';
        saveBtn.style.cssText = `
            background-color: #00aa00;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
        `;
        saveBtn.onclick = function() {
            saveSettings();
            settingsConfig.visible = false;
            settingsPanel.style.display = 'none';
            logToUI('设置已保存', 'success');
        };
        buttonContainer.appendChild(saveBtn);

        // 添加取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            background-color: #aa0000;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.onclick = function() {
            settingsConfig.visible = false;
            settingsPanel.style.display = 'none';
        };
        buttonContainer.appendChild(cancelBtn);

        settingsPanel.appendChild(buttonContainer);

        // 更新设置UI内容
        updateSettingsContent();

        document.body.appendChild(settingsPanel);
        return settingsPanel;
    }

    // 更新设置面板内容
    function updateSettingsContent() {
        const contentContainer = document.getElementById('settings-content');
        if (!contentContainer) return;

        let html = '';

        // 根据当前激活的选项卡显示不同内容
        switch (settingsConfig.activeTab) {
            case 'general':
                html = `
                    <div class="settings-section">
                        <h4 style="margin-top: 0; color: #00ff00;">常规设置</h4>
                        <div class="settings-item">
                            <label for="update-enabled">启用实时数据更新</label>
                            <input type="checkbox" id="update-enabled" ${updateConfig.enabled ? 'checked' : ''}>
                        </div>
                        <div class="settings-item">
                            <label for="match-interval">比赛数据更新间隔(秒)</label>
                            <input type="number" id="match-interval" value="${updateConfig.matchInterval}" min="5" max="300">
                        </div>
                        <div class="settings-item">
                            <label for="odds-interval">赔率更新间隔(秒)</label>
                            <input type="number" id="odds-interval" value="${updateConfig.oddsInterval}" min="5" max="300">
                        </div>
                        <div class="settings-item">
                            <label for="show-notifications">显示更新通知</label>
                            <input type="checkbox" id="show-notifications" ${updateConfig.showNotifications ? 'checked' : ''}>
                        </div>
                    </div>
                `;
                break;

            case 'betting':
                html = `
                    <div class="settings-section">
                        <h4 style="margin-top: 0; color: #00ff00;">下注设置</h4>
                        <div class="settings-item">
                            <label for="bet-enabled">启用自动下单</label>
                            <input type="checkbox" id="bet-enabled" ${betConfig.enabled ? 'checked' : ''}>
                        </div>
                        <div class="settings-item">
                            <label for="min-odds">最小赔率</label>
                            <input type="number" id="min-odds" value="${betConfig.minOdds}" min="1.1" max="10" step="0.1">
                        </div>
                        <div class="settings-item">
                            <label for="max-odds">最大赔率</label>
                            <input type="number" id="max-odds" value="${betConfig.maxOdds}" min="1.1" max="20" step="0.1">
                        </div>
                        <div class="settings-item">
                            <label for="bet-amount">默认下注金额</label>
                            <input type="number" id="bet-amount" value="${betConfig.betAmount}" min="1" max="1000">
                        </div>
                        <div class="settings-item">
                            <label for="confidence-threshold">置信度阈值(%)</label>
                            <input type="number" id="confidence-threshold" value="${betConfig.confidenceThreshold}" min="50" max="100">
                        </div>
                        <div class="settings-item">
                            <label for="auto-confirm">自动确认下单</label>
                            <input type="checkbox" id="auto-confirm" ${betConfig.autoConfirm ? 'checked' : ''}>
                        </div>
                        <div class="settings-item">
                            <label for="risk-level">风险等级</label>
                            <select id="risk-level">
                                <option value="low" ${betConfig.riskLevel === 'low' ? 'selected' : ''}>低风险</option>
                                <option value="medium" ${betConfig.riskLevel === 'medium' ? 'selected' : ''}>中等风险</option>
                                <option value="high" ${betConfig.riskLevel === 'high' ? 'selected' : ''}>高风险</option>
                            </select>
                        </div>
                    </div>
                `;
                break;

            case 'odds':
                html = `
                    <div class="settings-section">
                        <h4 style="margin-top: 0; color: #00ff00;">赔率调整设置</h4>
                        <div class="settings-item">
                            <label for="odds-adjustment-enabled">启用赔率调整</label>
                            <input type="checkbox" id="odds-adjustment-enabled" ${betConfig.oddsAdjustment.enabled ? 'checked' : ''}>
                        </div>
                        <div class="settings-subsection">
                            <h5 style="color: #00ccff;">赔率阈值设置</h5>
                            <p style="color: #aaa; font-size: 12px; margin-bottom: 15px;">当赔率超过设定阈值时，下注金额将按照指定百分比进行调整</p>

                            <div class="settings-item">
                                <label for="threshold-1">赔率阈值 1</label>
                                <input type="number" id="threshold-1" value="${betConfig.oddsAdjustment.thresholds[0].threshold}" min="1.1" max="10" step="0.1">
                            </div>
                            <div class="settings-item">
                                <label for="percentage-1">下注百分比 1 (%)</label>
                                <input type="number" id="percentage-1" value="${betConfig.oddsAdjustment.thresholds[0].betPercentage}" min="1" max="100">
                            </div>

                            <div class="settings-item">
                                <label for="threshold-2">赔率阈值 2</label>
                                <input type="number" id="threshold-2" value="${betConfig.oddsAdjustment.thresholds[1].threshold}" min="1.1" max="10" step="0.1">
                            </div>
                            <div class="settings-item">
                                <label for="percentage-2">下注百分比 2 (%)</label>
                                <input type="number" id="percentage-2" value="${betConfig.oddsAdjustment.thresholds[1].betPercentage}" min="1" max="100">
                            </div>
                        </div>
                    </div>
                `;
                break;

            case 'gameRules':
                html = `
                    <div class="settings-section">
                        <h4 style="margin-top: 0; color: #00ff00;">游戏规则设置</h4>

                        <div class="settings-subsection">
                            <h5 style="color: #00ccff;">最小开局时间限制（分钟）</h5>
                            <p style="color: #aaa; font-size: 12px; margin-bottom: 15px;">只有当比赛时间超过设定值时才会下单</p>

                            <div class="settings-item">
                                <label for="min-time-lol">英雄联盟 (LOL)</label>
                                <input type="number" id="min-time-lol" value="${betConfig.gameRules.minGameTime.LOL}" min="0" max="60">
                            </div>
                            <div class="settings-item">
                                <label for="min-time-kog">王者荣耀 (KOG)</label>
                                <input type="number" id="min-time-kog" value="${betConfig.gameRules.minGameTime.KOG}" min="0" max="60">
                            </div>
                            <div class="settings-item">
                                <label for="min-time-csgo">CS:GO</label>
                                <input type="number" id="min-time-csgo" value="${betConfig.gameRules.minGameTime.CSGO}" min="0" max="60">
                            </div>
                            <div class="settings-item">
                                <label for="min-time-dota2">DOTA2</label>
                                <input type="number" id="min-time-dota2" value="${betConfig.gameRules.minGameTime.DOTA2 || 0}" min="0" max="60">
                            </div>
                            <div class="settings-item">
                                <label for="min-time-wildrift">激斗峡谷 (Wild Rift)</label>
                                <input type="number" id="min-time-wildrift" value="${betConfig.gameRules.minGameTime.WildRift}" min="0" max="60">
                            </div>
                        </div>

                        <div class="settings-subsection">
                            <h5 style="color: #00ccff;">开局时间+赔率限制</h5>
                            <p style="color: #aaa; font-size: 12px; margin-bottom: 15px;">当比赛时间为0分钟且赔率大于等于设定值时不下单</p>

                            <div class="settings-item">
                                <label for="odds-limit-lol">英雄联盟 (LOL)</label>
                                <input type="number" id="odds-limit-lol" value="${betConfig.gameRules.startTimeOddsLimit.LOL.maxOdds}" min="1.1" max="20" step="0.1">
                            </div>
                            <div class="settings-item">
                                <label for="odds-limit-dota2">DOTA2</label>
                                <input type="number" id="odds-limit-dota2" value="${betConfig.gameRules.startTimeOddsLimit.DOTA2.maxOdds}" min="1.1" max="20" step="0.1">
                            </div>
                            <div class="settings-item">
                                <label for="odds-limit-kog">王者荣耀 (KOG)</label>
                                <input type="number" id="odds-limit-kog" value="${betConfig.gameRules.startTimeOddsLimit.KOG.maxOdds}" min="1.1" max="20" step="0.1">
                            </div>
                            <div class="settings-item">
                                <label for="odds-limit-csgo">CS:GO</label>
                                <input type="number" id="odds-limit-csgo" value="${betConfig.gameRules.startTimeOddsLimit.CSGO.maxOdds}" min="1.1" max="20" step="0.1">
                            </div>
                            <div class="settings-item">
                                <label for="odds-limit-wildrift">激斗峡谷 (Wild Rift)</label>
                                <input type="number" id="odds-limit-wildrift" value="${betConfig.gameRules.startTimeOddsLimit.WildRift.maxOdds}" min="1.1" max="20" step="0.1">
                            </div>
                        </div>
                    </div>
                `;
                break;
        }

        // 添加样式
        html += `
            <style>
                .settings-section {
                    margin-bottom: 20px;
                }
                .settings-subsection {
                    margin: 15px 0;
                    padding: 15px;
                    background-color: rgba(50, 50, 50, 0.5);
                    border-radius: 5px;
                }
                .settings-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #444;
                }
                .settings-item:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                .settings-item label {
                    flex: 1;
                }
                .settings-item input[type="number"],
                .settings-item select {
                    width: 100px;
                    padding: 5px;
                    background-color: #333;
                    color: white;
                    border: 1px solid #555;
                    border-radius: 3px;
                }
                .settings-item input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                }
            </style>
        `;

        contentContainer.innerHTML = html;
    }

    // 保存设置
    function saveSettings() {
        // 保存常规设置
        if (settingsConfig.activeTab === 'general') {
            updateConfig.enabled = document.getElementById('update-enabled').checked;
            updateConfig.matchInterval = parseInt(document.getElementById('match-interval').value);
            updateConfig.oddsInterval = parseInt(document.getElementById('odds-interval').value);
            updateConfig.showNotifications = document.getElementById('show-notifications').checked;
        }

        // 保存下注设置
        else if (settingsConfig.activeTab === 'betting') {
            betConfig.enabled = document.getElementById('bet-enabled').checked;
            betConfig.minOdds = parseFloat(document.getElementById('min-odds').value);
            betConfig.maxOdds = parseFloat(document.getElementById('max-odds').value);
            betConfig.betAmount = parseInt(document.getElementById('bet-amount').value);
            betConfig.confidenceThreshold = parseInt(document.getElementById('confidence-threshold').value);
            betConfig.autoConfirm = document.getElementById('auto-confirm').checked;
            betConfig.riskLevel = document.getElementById('risk-level').value;
        }

        // 保存赔率调整设置
        else if (settingsConfig.activeTab === 'odds') {
            betConfig.oddsAdjustment.enabled = document.getElementById('odds-adjustment-enabled').checked;
            betConfig.oddsAdjustment.thresholds[0].threshold = parseFloat(document.getElementById('threshold-1').value);
            betConfig.oddsAdjustment.thresholds[0].betPercentage = parseInt(document.getElementById('percentage-1').value);
            betConfig.oddsAdjustment.thresholds[1].threshold = parseFloat(document.getElementById('threshold-2').value);
            betConfig.oddsAdjustment.thresholds[1].betPercentage = parseInt(document.getElementById('percentage-2').value);
        }

        // 保存游戏规则设置
        else if (settingsConfig.activeTab === 'gameRules') {
            // 保存最小开局时间限制
            betConfig.gameRules.minGameTime.LOL = parseInt(document.getElementById('min-time-lol').value);
            betConfig.gameRules.minGameTime.KOG = parseInt(document.getElementById('min-time-kog').value);
            betConfig.gameRules.minGameTime.CSGO = parseInt(document.getElementById('min-time-csgo').value);
            betConfig.gameRules.minGameTime.DOTA2 = parseInt(document.getElementById('min-time-dota2').value);
            betConfig.gameRules.minGameTime.WildRift = parseInt(document.getElementById('min-time-wildrift').value);

            // 保存开局时间+赔率限制
            betConfig.gameRules.startTimeOddsLimit.LOL.maxOdds = parseFloat(document.getElementById('odds-limit-lol').value);
            betConfig.gameRules.startTimeOddsLimit.DOTA2.maxOdds = parseFloat(document.getElementById('odds-limit-dota2').value);
            betConfig.gameRules.startTimeOddsLimit.KOG.maxOdds = parseFloat(document.getElementById('odds-limit-kog').value);
            betConfig.gameRules.startTimeOddsLimit.CSGO.maxOdds = parseFloat(document.getElementById('odds-limit-csgo').value);
            betConfig.gameRules.startTimeOddsLimit.WildRift.maxOdds = parseFloat(document.getElementById('odds-limit-wildrift').value);
        }

        // 保存设置到本地存储
        try {
            GM_setValue('betConfig', JSON.stringify(betConfig));
            GM_setValue('updateConfig', JSON.stringify(updateConfig));
            console.log('设置已保存到本地存储');
        } catch (e) {
            console.error('保存设置失败:', e);
        }
    }

    // 更新设置UI
    function updateSettingsUI() {
        // 如果设置面板可见，则更新内容
        if (settingsConfig.visible) {
            const existingPanel = document.getElementById('settings-panel');
            if (existingPanel) {
                // 更新选项卡状态
                const tabButtons = existingPanel.querySelectorAll('[data-tab-id]');
                tabButtons.forEach(btn => {
                    const tabId = btn.dataset.tabId;
                    btn.style.backgroundColor = settingsConfig.activeTab === tabId ? '#555' : '#333';
                    btn.style.color = settingsConfig.activeTab === tabId ? '#fff' : '#ccc';
                });

                // 更新内容
                updateSettingsContent();
            } else {
                // 如果面板不存在但应该可见，则创建它
                createSettingsPanel();
            }
        }
    }

    // 创建UI界面
    function createUI() {
        // 创建左侧比赛面板
        const matchesPanel = document.createElement('div');
        matchesPanel.id = 'matches-panel';
        matchesPanel.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 280px;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.85);
            color: white;
            z-index: 9998;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            overflow: hidden;
            border-right: 1px solid #444;
            display: block;
            box-shadow: 2px 0 10px rgba(0, 0, 0, 0.5);
            transition: all 0.3s ease;
            backdrop-filter: blur(3px);
        `;

        // 右侧下注面板已移除，保留变量以避免代码错误
        const bettingPanel = document.createElement('div');
        bettingPanel.id = 'betting-panel';
        bettingPanel.style.cssText = `
            display: none;
            position: absolute;
            width: 0;
            height: 0;
            overflow: hidden;
            visibility: hidden;
        `;

        // 创建下注容器
        const bettingContainer = document.createElement('div');
        bettingContainer.id = 'betting-container';

        bettingPanel.appendChild(bettingContainer);

        // 初始化下注显示
        updateBettingDisplay();

        // 添加自定义滚动条样式
        const bettingStyle = document.createElement('style');
        bettingStyle.textContent = `
            #betting-display-container::-webkit-scrollbar {
                width: 6px;
            }
            #betting-display-container::-webkit-scrollbar-track {
                background: #333;
            }
            #betting-display-container::-webkit-scrollbar-thumb {
                background-color: #666;
                border-radius: 3px;
            }
            #betting-display-container::-webkit-scrollbar-thumb:hover {
                background-color: #888;
            }
        `;
        document.head.appendChild(bettingStyle);

        // 添加左侧面板标题
        const matchesPanelHeader = document.createElement('div');
        matchesPanelHeader.style.cssText = `
            padding: 12px 15px;
            background: linear-gradient(to right, #6600cc, #9900cc);
            border-bottom: 1px solid #7700cc;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        `;
        matchesPanelHeader.innerHTML = '<h3 style="margin: 0; color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">今日比赛</h3>';
        matchesPanel.appendChild(matchesPanelHeader);

        // 添加设置按钮
        const settingsPanelBtn = document.createElement('button');
        settingsPanelBtn.textContent = '设置';
        settingsPanelBtn.style.cssText = `
            background-color: rgba(0, 153, 51, 0.7);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
            margin-right: 5px;
        `;
        settingsPanelBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(0, 153, 51, 0.9)';
        };
        settingsPanelBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(0, 153, 51, 0.7)';
        };
        settingsPanelBtn.onclick = function() {
            settingsConfig.visible = true;
            createSettingsPanel();
        };
        matchesPanelHeader.appendChild(settingsPanelBtn);

        // 添加刷新按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '刷新';
        refreshBtn.style.cssText = `
            background-color: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
        `;
        refreshBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        };
        refreshBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        };
        refreshBtn.onclick = function() {
            updateMatchesDisplay();
            logToUI('已刷新比赛数据', 'info');
        };
        matchesPanelHeader.appendChild(refreshBtn);

        // 添加比赛内容容器
        const matchesContainer = document.createElement('div');
        matchesContainer.id = 'matches-display-container';
        matchesContainer.style.cssText = `
            padding: 15px;
            overflow-y: auto;
            max-height: calc(100vh - 50px);
            scrollbar-width: thin;
            scrollbar-color: #666 #333;
        `;
        matchesContainer.addEventListener('mouseover', function() {
            this.style.overflowY = 'auto';
        });
        matchesContainer.addEventListener('mouseout', function() {
            this.style.overflowY = 'auto';
        });
        matchesPanel.appendChild(matchesContainer);

        // 添加自定义滚动条样式
        const style = document.createElement('style');
        style.textContent = `
            #matches-display-container::-webkit-scrollbar {
                width: 6px;
            }
            #matches-display-container::-webkit-scrollbar-track {
                background: #333;
            }
            #matches-display-container::-webkit-scrollbar-thumb {
                background-color: #666;
                border-radius: 3px;
            }
            #matches-display-container::-webkit-scrollbar-thumb:hover {
                background-color: #888;
            }
        `;
        document.head.appendChild(style);

        // 创建主控制面板
        const container = document.createElement('div');
        container.id = 'esports-data-collector';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 500px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            z-index: 9999;
            border-radius: 5px;
            padding: 10px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            overflow: auto;
            display: none;
        `;

        const header = document.createElement('div');
        header.innerHTML = '<h3 style="margin: 0 0 10px 0; color: #00ff00;">电竞数据采集器</h3>';
        header.style.cursor = 'move';
        container.appendChild(header);

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '显示/隐藏';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background-color: #00aa00;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 5px 10px;
            cursor: pointer;
        `;
        toggleBtn.onclick = function() {
            if (container.style.display === 'none') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        };

        const content = document.createElement('div');
        content.id = 'esports-data-content';
        container.appendChild(content);

        // 添加选择器按钮
        const selectorBtn = document.createElement('button');
        selectorBtn.textContent = '选择DOM元素';
        selectorBtn.style.cssText = `
            margin-top: 10px;
            background-color: #cc6600;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 5px 10px;
            cursor: pointer;
            margin-right: 5px;
        `;
        selectorBtn.onclick = function() {
            toggleSelectorMode(true);
        };
        container.appendChild(selectorBtn);

        // 添加已选择元素容器
        const selectedElementsContainer = document.createElement('div');
        selectedElementsContainer.id = 'selected-elements-container';
        selectedElementsContainer.style.cssText = `
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;
        container.appendChild(selectedElementsContainer);

        // 添加日志容器
        const logsContainer = document.createElement('div');
        logsContainer.id = 'logs-container';
        logsContainer.style.cssText = `
            margin-top: 10px;
            border-top: 1px solid #444;
            padding-top: 10px;
        `;
        logsContainer.innerHTML = '<h4 style="margin: 5px 0; color: #00ccff;">操作日志:</h4>';
        container.appendChild(logsContainer);
        // 不需要将matchesContainer添加到matchesDisplay，因为已经添加到matchesPanel中了

        document.body.appendChild(matchesPanel);
        // 不再添加bettingPanel到body

        // 添加导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出数据';
        exportBtn.style.cssText = `
            margin-top: 10px;
            background-color: #0066cc;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 5px 10px;
            cursor: pointer;
            margin-right: 5px;
        `;
        exportBtn.onclick = exportData;
        container.appendChild(exportBtn);

        // 添加设置按钮
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '脚本设置';
        settingsBtn.style.cssText = `
            margin-top: 10px;
            background-color: #009933;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 5px 10px;
            cursor: pointer;
        `;
        settingsBtn.onclick = function() {
            settingsConfig.visible = true;
            createSettingsPanel();
        };
        container.appendChild(settingsBtn);

        document.body.appendChild(toggleBtn);
        document.body.appendChild(container);

        // 实现拖动功能
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
        });

        document.addEventListener('mousemove', function(e) {
            if (isDragging) {
                container.style.left = (e.clientX - offsetX) + 'px';
                container.style.top = (e.clientY - offsetY) + 'px';
                container.style.right = 'auto';
            }
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // 输出初始日志
        logToUI('电竞数据采集器已启动', 'success');
    }

    // 更新日志UI
    function updateLogsUI() {
        // 获取日志弹窗中的日志容器
        const logsContainer = document.getElementById('logs-container');
        if (!logsContainer) return;

        let html = '';

        if (collectedData.logs && collectedData.logs.length > 0) {
            collectedData.logs.slice().reverse().forEach((log, index) => {
                // 根据日志类型设置颜色和图标
                let logColor = '#ffffff';
                let logIcon = '🔵';
                let bgColor = 'rgba(20,20,20,0.7)';
                let borderColor = '#444';
                let borderStyle = 'solid';

                switch(log.type) {
                    case 'info':
                        logColor = '#00ccff';
                        logIcon = 'ℹ️';
                        bgColor = 'rgba(0,50,80,0.3)';
                        borderColor = '#0088cc';
                        break;
                    case 'success':
                        logColor = '#00ff99';
                        logIcon = '✅';
                        bgColor = 'rgba(0,80,40,0.3)';
                        borderColor = '#00cc66';
                        break;
                    case 'warning':
                        logColor = '#ffcc00';
                        logIcon = '⚠️';
                        bgColor = 'rgba(80,60,0,0.3)';
                        borderColor = '#cc9900';
                        borderStyle = 'dashed';
                        break;
                    case 'error':
                        logColor = '#ff3333';
                        logIcon = '❌';
                        bgColor = 'rgba(80,0,0,0.3)';
                        borderColor = '#cc0000';
                        borderStyle = 'dashed';
                        break;
                }

                // 格式化时间为 HH:MM:SS
                const time = new Date(log.timestamp).toLocaleTimeString();
                // 格式化日期为 YYYY-MM-DD
                const date = new Date(log.timestamp).toLocaleDateString();

                // 计算动画延迟，使日志逐个显示
                const animDelay = index * 0.05;

                // 构建日志条目HTML - 使用更现代的设计
                html += `<div class="log-entry" style="
                    margin-bottom: 10px;
                    padding: 10px 12px;
                    border-left: 3px ${borderStyle} ${borderColor};
                    background-color: ${bgColor};
                    font-size: 12px;
                    border-radius: 8px;
                    box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                    transition: all 0.3s ease;
                    animation: fadeIn 0.4s ease-out ${animDelay}s both;
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="margin-right: 8px; font-size: 14px;">${logIcon}</span>
                            <span style="color: #dddddd; font-weight: bold; font-size: 12px;">${log.type.toUpperCase()}</span>
                        </div>
                        <span style="color: #bbbbbb; font-size: 11px;">${date} ${time}</span>
                    </div>
                    <div style="
                        color: ${logColor};
                        margin-top: 6px;
                        line-height: 1.5;
                        word-break: break-word;
                        font-size: 13px;
                        padding: 2px 0;
                        text-shadow: 0 1px 1px rgba(0,0,0,0.3);
                    ">${log.message}</div>
                </div>`;

                // 如果是第一条日志，自动滚动到顶部
                if (index === 0) {
                    setTimeout(() => {
                        logsContainer.scrollTop = 0;
                    }, 100);
                }
            });
        } else {
            html += '<div style="color: #aaaaaa; font-style: italic; text-align: center; padding: 15px; background-color: rgba(30,30,30,0.5); border-radius: 8px;">暂无日志记录</div>';
        }

        // 添加淡入动画样式
        const animStyle = document.getElementById('log-animations');
        if (!animStyle) {
            const style = document.createElement('style');
            style.id = 'log-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        logsContainer.innerHTML = html;

        // 添加鼠标悬停效果
        const logEntries = logsContainer.querySelectorAll('div[style*="border-left"]');
        logEntries.forEach(entry => {
            entry.addEventListener('mouseover', function() {
                this.style.transform = 'translateX(2px)';
                this.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            });
            entry.addEventListener('mouseout', function() {
                this.style.transform = 'translateX(0)';
                this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
            });
        });
    }

    // 更新今日比赛UI
    function updateTodayMatchesUI() {
        const matchesContainer = document.getElementById('matches-display-container');
        if (!matchesContainer) return;

        // 获取今天的日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 筛选今日比赛
        const todayMatches = collectedData.matches.filter(match => {
            const matchDate = new Date(match.startTime || match.time || Date.now());
            matchDate.setHours(0, 0, 0, 0);
            return matchDate.getTime() === today.getTime();
        });

        // 如果没有比赛数据，尝试从DOM元素中提取
        if (todayMatches.length === 0) {
            extractMatchesFromDOM();
        }

        // 更新比赛显示
        updateMatchesDisplay();
    }

    // 从DOM元素中提取比赛信息
    function extractMatchesFromDOM() {
        // 从已选择的DOM元素中提取比赛信息
        const teamInfoElements = document.querySelectorAll('div.teamInfoGrp');
        const marketRowElements = document.querySelectorAll('div.marketRow');
        const matchHeaderElements = document.querySelectorAll('div.matchHeader');

        if (teamInfoElements.length > 0 || marketRowElements.length > 0) {
            logToUI('从DOM元素中提取比赛信息', 'info');

            // 处理队伍信息元素
            teamInfoElements.forEach((element, index) => {
                const text = element.textContent.trim();
                // 尝试提取队伍名称和赔率（支持中文和英文）
                const teamMatch = text.match(/([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)/);

                if (teamMatch) {
                    const team1 = teamMatch[1].trim();
                    const odds1 = parseFloat(teamMatch[2]);
                    const team2 = teamMatch[3].trim();
                    const odds2 = parseFloat(teamMatch[4]);

                    // 获取比赛类型
                    let matchType = '未知比赛';
                    if (matchHeaderElements.length > 0 && index < matchHeaderElements.length) {
                        matchType = matchHeaderElements[index].textContent.trim();
                    }

                    // 创建临时比赛对象
                    const tempMatch = {
                        id: 'temp-match-' + index,
                        teams: [
                            { id: 'team1-' + index, name: team1 },
                            { id: 'team2-' + index, name: team2 }
                        ],
                        odds: {},
                        status: '进行中',
                        type: matchType,
                        startTime: new Date(),
                        source: 'dom-extracted'
                    };

                    // 设置赔率
                    tempMatch.odds['team1-' + index] = odds1;
                    tempMatch.odds['team2-' + index] = odds2;

                    // 添加到收集的数据中
                    if (!collectedData.matches.some(m => m.id === tempMatch.id)) {
                        collectedData.matches.push(tempMatch);
                        logToUI(`添加比赛: ${team1} vs ${team2}`, 'success');
                    }
                }
            });

            // 处理赔率行元素
            marketRowElements.forEach((element, index) => {
                const text = element.textContent.trim();
                // 尝试提取队伍名称和赔率（支持中文和英文）
                const oddsMatch = text.match(/([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)/);

                if (oddsMatch && teamInfoElements.length === 0) {
                    // 只有在没有teamInfoElements的情况下才处理，避免重复
                    const team1 = oddsMatch[1].trim();
                    const odds1 = parseFloat(oddsMatch[2]);
                    const team2 = oddsMatch[3].trim();
                    const odds2 = parseFloat(oddsMatch[4]);

                    // 获取比赛类型
                    let matchType = '未知比赛';
                    if (matchHeaderElements.length > 0 && index < matchHeaderElements.length) {
                        matchType = matchHeaderElements[index].textContent.trim();
                    }

                    // 创建临时比赛对象
                    const tempMatch = {
                        id: 'odds-match-' + index,
                        teams: [
                            { id: 'team1-odds-' + index, name: team1 },
                            { id: 'team2-odds-' + index, name: team2 }
                        ],
                        odds: {},
                        status: '进行中',
                        type: matchType,
                        startTime: new Date(),
                        source: 'odds-extracted'
                    };

                    // 设置赔率
                    tempMatch.odds['team1-odds-' + index] = odds1;
                    tempMatch.odds['team2-odds-' + index] = odds2;

                    // 添加到收集的数据中
                    if (!collectedData.matches.some(m => m.id === tempMatch.id)) {
                        collectedData.matches.push(tempMatch);
                        logToUI(`添加比赛: ${team1} vs ${team2}`, 'success');
                    }
                }
            });
        }
    }

    // 显示今日比赛信息
    function showTodayMatches() {
        // 提取最新的比赛数据
        extractMatchesFromDOM();

        // 确保左侧面板可见
        const matchesPanel = document.getElementById('matches-panel');
        if (matchesPanel) {
            matchesPanel.style.display = 'block';
        }

        // 更新比赛数据显示
        updateMatchesDisplay();
        logToUI('已更新今日比赛信息', 'info');
    }

function updateMatchesDisplay() {
        const matchesContainer = document.getElementById('matches-display-container');
        if (!matchesContainer) return;

        // 获取今天的日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 筛选今日比赛
        const todayMatches = collectedData.matches.filter(match => {
            const matchDate = new Date(match.startTime || match.time || Date.now());
            matchDate.setHours(0, 0, 0, 0);
            return matchDate.getTime() === today.getTime();
        });

        // 如果没有比赛数据，尝试从DOM元素中提取
        if (todayMatches.length === 0) {
            // 从已选择的DOM元素中提取比赛信息
            const teamInfoElements = document.querySelectorAll('div.teamInfoGrp');
            const marketRowElements = document.querySelectorAll('div.marketRow');

            if (teamInfoElements.length > 0 || marketRowElements.length > 0) {
                logToUI('从DOM元素中提取比赛信息', 'info');

                // 处理队伍信息元素
                teamInfoElements.forEach((element, index) => {
                    const text = element.textContent.trim();
                    // 尝试提取队伍名称和赔率（支持中文和英文）
                    const teamMatch = text.match(/([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)/);

                    if (teamMatch) {
                        const team1 = teamMatch[1].trim();
                        const odds1 = parseFloat(teamMatch[2]);
                        const team2 = teamMatch[3].trim();
                        const odds2 = parseFloat(teamMatch[4]);

                        // 创建临时比赛对象
                        const tempMatch = {
                            id: 'temp-match-' + index,
                            teams: [
                                { id: 'team1-' + index, name: team1 },
                                { id: 'team2-' + index, name: team2 }
                            ],
                            odds: {},
                            status: '进行中',
                            startTime: new Date(),
                            source: 'dom-extracted'
                        };

                        // 设置赔率
                        tempMatch.odds['team1-' + index] = odds1;
                        tempMatch.odds['team2-' + index] = odds2;

                        // 添加到今日比赛
                        todayMatches.push(tempMatch);

                        // 也添加到收集的数据中
                        if (!collectedData.matches.some(m => m.id === tempMatch.id)) {
                            collectedData.matches.push(tempMatch);
                        }
                    }
                });

                // 处理赔率行元素
                marketRowElements.forEach((element, index) => {
                    const text = element.textContent.trim();
                    // 尝试提取队伍名称和赔率（支持中文和英文）
                    const oddsMatch = text.match(/([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)([\u4e00-\u9fa5\w\s]+)(\d+\.\d+)/);

                    if (oddsMatch && !teamInfoElements.length) {
                        // 只有在没有teamInfoElements的情况下才处理，避免重复
                        const team1 = oddsMatch[1].trim();
                        const odds1 = parseFloat(oddsMatch[2]);
                        const team2 = oddsMatch[3].trim();
                        const odds2 = parseFloat(oddsMatch[4]);

                        // 创建临时比赛对象
                        const tempMatch = {
                            id: 'odds-match-' + index,
                            teams: [
                                { id: 'team1-odds-' + index, name: team1 },
                                { id: 'team2-odds-' + index, name: team2 }
                            ],
                            odds: {},
                            status: '进行中',
                            startTime: new Date(),
                            source: 'odds-extracted'
                        };

                        // 设置赔率
                        tempMatch.odds['team1-odds-' + index] = odds1;
                        tempMatch.odds['team2-odds-' + index] = odds2;

                        // 添加到今日比赛
                        todayMatches.push(tempMatch);

                        // 也添加到收集的数据中
                        if (!collectedData.matches.some(m => m.id === tempMatch.id)) {
                            collectedData.matches.push(tempMatch);
                        }
                    }
                });
            }
        }

        // 如果仍然没有比赛，添加一个示例比赛
        if (todayMatches.length === 0) {
            const demoMatch = {
                id: 'demo-match',
                teams: [
                    { id: 'team1-demo', name: 'The MongolZ' },
                    { id: 'team2-demo', name: 'Aurora' }
                ],
                odds: {
                    'team1-demo': 2.79,
                    'team2-demo': 1.43
                },
                status: '进行中',
                startTime: new Date(),
                source: 'demo'
            };

            todayMatches.push(demoMatch);
            logToUI('添加示例比赛数据用于展示', 'info');
        }

        // 获取JSON文件中的选择器信息
        let matchStatus = '未开始';
        let matchTime = '';
        let matchType = 'CS:GO BO3';

        // 从domElements中获取比赛状态、时间和类型信息
        if (collectedData.domElements && collectedData.domElements.length > 0) {
            collectedData.domElements.forEach(element => {
                if (element.selector === 'div.matchStatus') {
                    matchStatus = element.value || '未开始';
                } else if (element.selector === 'div.matchStatus.mSDateTime') {
                    matchTime = element.value || '';
                } else if (element.selector === 'div.matchGOMT') {
                    matchType = element.value || 'CS:GO BO3';
                }
            });
        }

        let html = '';

        if (todayMatches.length > 0) {
            // 垂直排列比赛信息
            todayMatches.forEach(match => {
                // 提取队伍名称和比分
                let team1 = match.teams && match.teams.length > 0 ? match.teams[0].name : '未知队伍1';
                let team2 = match.teams && match.teams.length > 1 ? match.teams[1].name : '未知队伍2';

                // 提取队伍名称中的数字（比分）
                let team1Score = '';
                let team2Score = '';
                let team1Name = team1;
                let team2Name = team2;

                // 正则匹配队伍名称后的数字
                const team1Match = team1.match(/(.*?)([0-9]+)$/);
                const team2Match = team2.match(/(.*?)([0-9]+)$/);

                if (team1Match) {
                    team1Name = team1Match[1].trim();
                    team1Score = team1Match[2];
                }

                if (team2Match) {
                    team2Name = team2Match[1].trim();
                    team2Score = team2Match[2];
                }

                // 格式化日期为 MM-DD HH:MM 格式
                const matchDate = match.startTime ? new Date(match.startTime) : new Date();
                const formattedDate = matchTime || `${(matchDate.getMonth()+1).toString().padStart(2, '0')}-${matchDate.getDate().toString().padStart(2, '0')} ${matchDate.getHours().toString().padStart(2, '0')}:${matchDate.getMinutes().toString().padStart(2, '0')}`;

                // 确定比赛状态
                let currentMatchStatus = match.status || matchStatus;

                // 如果有队伍有比分，则标记为进行中
                if (team1Score || team2Score) {
                    currentMatchStatus = '进行中';
                } else if (currentMatchStatus === '进行中') {
                    // 如果状态是进行中但没有比分，改为即将开始
                    currentMatchStatus = '即将开始';
                } else {
                    // 否则标记为未开赛
                    currentMatchStatus = '未开赛';
                }

                // 获取队伍赔率
                const team1Odds = match.odds && match.odds[match.teams[0].id] ? match.odds[match.teams[0].id].toFixed(2) : '?';
                const team2Odds = match.odds && match.odds[match.teams[1].id] ? match.odds[match.teams[1].id].toFixed(2) : '?';

                // 设置状态颜色
                let statusColor = '#ffffff';
                if (currentMatchStatus.includes('进行中') || currentMatchStatus.includes('live')) {
                    statusColor = '#ff9900';
                } else if (currentMatchStatus.includes('结束') || currentMatchStatus.includes('完成')) {
                    statusColor = '#aaaaaa';
                } else if (currentMatchStatus.includes('即将开始')) {
                    statusColor = '#00ff00';
                } else if (currentMatchStatus.includes('未开赛')) {
                    statusColor = '#3399ff';
                }

                // 获取比赛类型
                const currentMatchType = match.type || matchType;

                html += `<div style="
                    background-color: rgba(30,30,30,0.7);
                    border-radius: 5px;
                    padding: 12px;
                    position: relative;
                    margin-bottom: 15px;
                    border-left: 3px solid #00cc00;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="
                            width: 8px;
                            height: 8px;
                            background-color: #00cc00;
                            border-radius: 50%;
                            margin-right: 8px;
                        "></div>
                        <div style="font-size: 12px; color: #aaaaaa;">${currentMatchType}</div>
                        <div style="margin-left: auto; font-size: 12px; color: ${statusColor};">${currentMatchStatus}</div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="flex: 1; text-align: left;">
                            <div style="display: flex; align-items: center;">
                                <div style="font-weight: bold; color: #ffffff; font-size: 14px;">${team1Name}</div>
                                ${team1Score ? `<div style="font-weight: bold; color: #ffcc00; font-size: 20px; margin-left: 10px; text-shadow: 0 0 3px rgba(255,204,0,0.5);">${team1Score}</div>` : ''}
                            </div>
                            <div style="color: #00cc00; font-size: 12px; margin-top: 3px;">赔率: ${team1Odds}</div>
                        </div>
                        <div style="
                            font-weight: bold;
                            color: #ff0000;
                            font-size: 18px;
                            margin: 0 15px;
                            text-shadow: 0 0 3px rgba(255,0,0,0.5);
                        ">VS</div>
                        <div style="flex: 1; text-align: right;">
                            <div style="display: flex; align-items: center; justify-content: flex-end;">
                                ${team2Score ? `<div style="font-weight: bold; color: #ffcc00; font-size: 20px; margin-right: 10px; text-shadow: 0 0 3px rgba(255,204,0,0.5);">${team2Score}</div>` : ''}
                                <div style="font-weight: bold; color: #ffffff; font-size: 14px;">${team2Name}</div>
                            </div>
                            <div style="color: #00cc00; font-size: 12px; margin-top: 3px;">赔率: ${team2Odds}</div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                        <div style="color: #aaaaaa;">${formattedDate}</div>
                        <div>
                            <button class="analyze-match-btn" data-match-id="${match.id}" style="
                                background-color: #0066cc;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                padding: 3px 8px;
                                cursor: pointer;
                                font-size: 11px;
                                transition: background-color 0.2s;
                            ">分析</button>
                        </div>
                    </div>
                </div>`;
            });
        } else {
            html += '<div style="text-align: center; color: #aaaaaa; padding: 20px;">今日暂无比赛</div>';
        }

        matchesContainer.innerHTML = html;

        // 添加分析按钮事件
        const analyzeButtons = matchesContainer.querySelectorAll('.analyze-match-btn');
        analyzeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const matchId = this.getAttribute('data-match-id');
                const match = collectedData.matches.find(m => m.id === matchId);
                if (match) {
                    analyzeMatch(match);
                    logToUI(`开始分析比赛: ${match.teams ? match.teams.map(t => t.name).join(' vs ') : '未知比赛'}`);
                }
            });
        });

        // 添加按钮悬停效果
        analyzeButtons.forEach(btn => {
            btn.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#0055aa';
            });
            btn.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#0066cc';
            });
        });
    }

    // 更新UI显示
    function updateUI() {
        const content = document.getElementById('esports-data-content');
        if (!content) return;

        let html = `<div style="margin-bottom: 10px;">最后更新: ${new Date().toLocaleTimeString()}</div>`;

        // 添加分析控制按钮
        html += `
        <div style="margin: 10px 0; display: flex; justify-content: space-between;">
            <button id="analyze-matches-btn" style="
                background-color: ${analysisActive ? '#00aa00' : '#0066cc'};
                color: white;
                border: none;
                border-radius: 3px;
                padding: 5px 10px;
                cursor: pointer;
                flex: 1;
                margin-right: 5px;
            ">${analysisActive ? '分析中...' : '分析比赛'}</button>

            <button id="toggle-betting-btn" style="
                background-color: ${betConfig.enabled ? '#cc6600' : '#cc6600'};
                color: white;
                border: none;
                border-radius: 3px;
                padding: 5px 10px;
                cursor: pointer;
                flex: 1;
                margin-left: 5px;
            ">${betConfig.enabled ? '自动下单: 开' : '自动下单: 关'}</button>
        </div>
        `;

        // 更新已选择的DOM元素
        updateSelectedElementsUI();

        content.innerHTML = html;

        // 添加按钮事件监听
        const analyzeBtn = document.getElementById('analyze-matches-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', function() {
                if (!analysisActive) {
                    analysisActive = true;
                    analyzeMatches();
                }
            });
        }

        const toggleBettingBtn = document.getElementById('toggle-betting-btn');
        if (toggleBettingBtn) {
            toggleBettingBtn.addEventListener('click', function() {
                betConfig.enabled = !betConfig.enabled;
                updateUI();
            });
        }
    }

    // 显示局数选择对话框
    function showRoundSelectionDialog(match, prediction, teamId) {
        // 创建对话框
        const roundDialog = document.createElement('div');
        roundDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.9);
            color: white;
            z-index: 10002;
            border-radius: 5px;
            padding: 20px;
            font-family: Arial, sans-serif;
            min-width: 300px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        `;

        // 生成局数选择按钮
        let roundButtons = '';
        for (let i = 1; i <= 5; i++) {
            roundButtons += `
                <button class="round-select-btn" data-round="${i}" style="
                    background-color: #333;
                    color: white;
                    border: 1px solid #555;
                    border-radius: 3px;
                    padding: 8px 15px;
                    margin: 5px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">${i}</button>
            `;
        }

        roundDialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #00ff00; text-align: center;">选择下注局数</h3>
            <div style="margin-bottom: 15px;">
                <div><strong>比赛:</strong> ${prediction.teams[0]} VS ${prediction.teams[1]}</div>
                <div><strong>选择:</strong> ${prediction.prediction}</div>
            </div>
            <div style="margin-bottom: 15px; text-align: center;">
                <div style="margin-bottom: 10px;">请选择要下注的局数:</div>
                <div style="display: flex; flex-wrap: wrap; justify-content: center;">
                    ${roundButtons}
                </div>
            </div>
            <div style="text-align: right;">
                <button id="cancel-round-select-btn" style="
                    background-color: #aa0000;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 8px 15px;
                    cursor: pointer;
                ">取消</button>
            </div>
        `;

        document.body.appendChild(roundDialog);

        // 添加局数选择按钮事件
        const roundBtns = roundDialog.querySelectorAll('.round-select-btn');
        roundBtns.forEach(btn => {
            btn.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#555';
            });
            btn.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#333';
            });
            btn.addEventListener('click', function() {
                const roundNumber = parseInt(this.getAttribute('data-round'));

                // 创建下单记录
                const betRecord = {
                    betId: `${match.id}-round-${roundNumber}`,
                    matchId: match.id,
                    matchRound: `第${roundNumber}局`,
                    roundNumber: roundNumber,
                    teams: prediction.teams,
                    selectedTeam: prediction.prediction,
                    selectedTeamId: teamId,
                    odds: prediction.odds,
                    amount: betConfig.betAmount,
                    potentialWin: Math.round(betConfig.betAmount * prediction.odds * 100) / 100,
                    confidence: prediction.confidence,
                    status: 'pending',
                    placedAt: new Date(),
                    result: null
                };

                // 移除对话框
                document.body.removeChild(roundDialog);

                // 显示确认对话框
                showBetConfirmation(betRecord);
            });
        });

        // 添加取消按钮事件
        const cancelBtn = document.getElementById('cancel-round-select-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                document.body.removeChild(roundDialog);
            });
        }
    }

    // 导出数据为JSON文件
    function exportData() {
        const dataStr = JSON.stringify(collectedData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `esports_data_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
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
                    } else if (data.type === 'event' || data.events) {
                        processEventData(data);
                    }

                    // 更新UI
                    updateUI();
                } catch (e) {
                    console.log('非JSON WebSocket数据:', event.data);
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
                            } else if (xhr._url.includes('event') || data.events) {
                                processEventData(data);
                            }

                            // 更新UI
                            updateUI();
                        } catch (e) {
                            console.log('非JSON XHR响应:', xhr.responseText.substring(0, 200) + '...');
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
            collectedData.matches = data.matches;
        } else if (data.matchData) {
            collectedData.matches = data.matchData;
        } else if (data.type === 'match') {
            // 避免重复添加
            const exists = collectedData.matches.some(m => m.id === data.id);
            if (!exists) {
                collectedData.matches.push(data);
            }
        }

        collectedData.lastUpdate = new Date();

        // 保存数据
        saveData();

        // 如果分析功能已激活，自动分析新数据
        if (analysisActive) {
            analyzeMatches();
        }
    }

    // 保存数据到本地存储
    function saveData() {
        try {
            // 只保存重要的长期数据，不保存临时会话数据
            const dataToSave = {
                teamStats: collectedData.teamStats,
                betHistory: collectedData.betHistory
            };
            GM_setValue('esportsData', JSON.stringify(dataToSave));
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    }

    // 分析比赛数据
    function analyzeMatches() {
        if (!collectedData.matches || collectedData.matches.length === 0) {
            console.log('没有可分析的比赛数据');
            analysisActive = false;
            updateUI();
            return;
        }

        console.log('开始分析比赛数据...');
        lastAnalysisTime = new Date();

        // 清空之前的预测
        collectedData.predictions = [];

        // 遍历所有比赛
        collectedData.matches.forEach(match => {
            // 确保比赛有必要的数据
            if (!match.teams || match.teams.length < 2) return;

            const team1 = match.teams[0];
            const team2 = match.teams[1];

            // 获取或创建队伍统计数据
            if (!collectedData.teamStats[team1.id]) {
                collectedData.teamStats[team1.id] = {
                    name: team1.name,
                    wins: 0,
                    losses: 0,
                    totalMatches: 0,
                    avgScore: 0,
                    recentForm: [], // 最近表现，1=胜，0=负
                    headToHead: {}, // 对阵特定队伍的战绩
                    lastMatchTime: null, // 上次比赛时间
                    streakCount: 0, // 连胜/连败计数
                    streakType: null // 'win' 或 'loss'
                };
            }

            if (!collectedData.teamStats[team2.id]) {
                collectedData.teamStats[team2.id] = {
                    name: team2.name,
                    wins: 0,
                    losses: 0,
                    totalMatches: 0,
                    avgScore: 0,
                    recentForm: [], // 最近表现，1=胜，0=负
                    headToHead: {}, // 对阵特定队伍的战绩
                    lastMatchTime: null, // 上次比赛时间
                    streakCount: 0, // 连胜/连败计数
                    streakType: null // 'win' 或 'loss'
                };
            }

            // 分析比赛状态
            const matchStatus = match.status || 'upcoming';

            // 如果比赛已结束，更新队伍统计
            if (matchStatus === 'completed' && match.result) {
                updateTeamStats(match);
            }

            // 对即将开始的比赛进行预测
            if (matchStatus === 'upcoming' || matchStatus === 'live') {
                const prediction = predictMatch(match);
                if (prediction) {
                    // 添加风险评估
                    const riskAssessment = assessRisk(match, prediction);
                    prediction.riskLevel = riskAssessment.level;
                    prediction.riskFactors = riskAssessment.factors;

                    collectedData.predictions.push(prediction);

                    // 如果启用了自动下单且满足条件，执行下单
                    if (betConfig.enabled &&
                        prediction.confidence >= betConfig.confidenceThreshold &&
                        prediction.odds >= betConfig.minOdds &&
                        prediction.odds <= betConfig.maxOdds &&
                        (betConfig.riskLevel === 'high' ||
                         (betConfig.riskLevel === 'medium' && prediction.riskLevel !== 'high') ||
                         (betConfig.riskLevel === 'low' && prediction.riskLevel === 'low'))) {
                        placeBet(match, prediction);
                    }
                }
            }
        });

        // 对预测结果进行排序，置信度高的排在前面
        collectedData.predictions.sort((a, b) => b.confidence - a.confidence);

        // 更新UI
        analysisActive = false;
        updateUI();
        console.log('比赛分析完成，生成了', collectedData.predictions.length, '个预测');
    }

    // 评估下注风险
    function assessRisk(match, prediction) {
        const riskFactors = [];
        let riskScore = 0;

        // 1. 检查数据量是否充足
        const team1Stats = collectedData.teamStats[match.teams[0].id];
        const team2Stats = collectedData.teamStats[match.teams[1].id];

        if (team1Stats.totalMatches < 5 || team2Stats.totalMatches < 5) {
            riskFactors.push('历史数据不足');
            riskScore += 30;
        }

        // 2. 检查置信度
        if (prediction.confidence < 60) {
            riskFactors.push('预测置信度低');
            riskScore += 25;
        }

        // 3. 检查赔率异常
        if (prediction.odds > 3.0) {
            riskFactors.push('赔率异常高');
            riskScore += 20;
        }

        // 4. 检查队伍状态波动
        const team1Form = team1Stats.recentForm.slice(-5);
        const team2Form = team2Stats.recentForm.slice(-5);

        if (team1Form.length >= 3) {
            const volatility1 = calculateVolatility(team1Form);
            if (volatility1 > 0.5) {
                riskFactors.push(match.teams[0].name + '表现不稳定');
                riskScore += 15;
            }
        }

        if (team2Form.length >= 3) {
            const volatility2 = calculateVolatility(team2Form);
            if (volatility2 > 0.5) {
                riskFactors.push(match.teams[1].name + '表现不稳定');
                riskScore += 15;
            }
        }

        // 5. 检查是否有连胜/连败
        if (team1Stats.streakCount >= 3 || team2Stats.streakCount >= 3) {
            const streakTeam = team1Stats.streakCount >= 3 ? match.teams[0].name : match.teams[1].name;
            const streakType = team1Stats.streakCount >= 3 ? team1Stats.streakType : team2Stats.streakType;
            riskFactors.push(`${streakTeam}正处于${streakCount}场连${streakType === 'win' ? '胜' : '负'}`);
            riskScore += 10;
        }

        // 确定风险等级
        let riskLevel;
        if (riskScore >= 50) {
            riskLevel = 'high';
        } else if (riskScore >= 25) {
            riskLevel = 'medium';
        } else {
            riskLevel = 'low';
        }

        return {
            level: riskLevel,
            factors: riskFactors,
            score: riskScore
        };
    }

    // 计算波动性 (0-1之间，越高表示越不稳定)
    function calculateVolatility(results) {
        if (results.length < 2) return 0;

        let changes = 0;
        for (let i = 1; i < results.length; i++) {
            if (results[i] !== results[i-1]) {
                changes++;
            }
        }

        return changes / (results.length - 1);
    }

    // 更新队伍统计数据
    function updateTeamStats(match) {
        if (!match.teams || match.teams.length < 2 || !match.result) return;

        const team1 = match.teams[0];
        const team2 = match.teams[1];
        const team1Stats = collectedData.teamStats[team1.id];
        const team2Stats = collectedData.teamStats[team2.id];

        // 确保统计对象存在
        if (!team1Stats || !team2Stats) return;

        // 更新胜负记录
        if (match.result.winner === team1.id) {
            team1Stats.wins++;
            team1Stats.recentForm.push(1);
            team2Stats.losses++;
            team2Stats.recentForm.push(0);
        } else if (match.result.winner === team2.id) {
            team2Stats.wins++;
            team2Stats.recentForm.push(1);
            team1Stats.losses++;
            team1Stats.recentForm.push(0);
        }

        // 更新总场次
        team1Stats.totalMatches++;
        team2Stats.totalMatches++;

        // 只保留最近10场比赛记录
        if (team1Stats.recentForm.length > 10) team1Stats.recentForm = team1Stats.recentForm.slice(-10);
        if (team2Stats.recentForm.length > 10) team2Stats.recentForm = team2Stats.recentForm.slice(-10);

        // 更新平均得分
        if (match.result.scores) {
            const team1Score = match.result.scores[team1.id] || 0;
            const team2Score = match.result.scores[team2.id] || 0;

            team1Stats.avgScore = ((team1Stats.avgScore * (team1Stats.totalMatches - 1)) + team1Score) / team1Stats.totalMatches;
            team2Stats.avgScore = ((team2Stats.avgScore * (team2Stats.totalMatches - 1)) + team2Score) / team2Stats.totalMatches;
        }

        // 保存更新后的数据
        saveData();
    }

    // 预测比赛结果
    function predictMatch(match) {
        if (!match.teams || match.teams.length < 2) return null;

        const team1 = match.teams[0];
        const team2 = match.teams[1];
        const team1Stats = collectedData.teamStats[team1.id];
        const team2Stats = collectedData.teamStats[team2.id];

        // 如果没有足够的历史数据，返回null
        if (!team1Stats || !team2Stats ||
            team1Stats.totalMatches < 3 || team2Stats.totalMatches < 3) {
            return {
                matchId: match.id,
                prediction: '数据不足',
                predictedWinner: null,
                confidence: 0,
                odds: match.odds ? (match.odds[team1.id] || 1.5) : 1.5,
                reason: '历史数据不足，无法做出可靠预测'
            };
        }

        // 计算各种因素
        const winRateTeam1 = team1Stats.wins / team1Stats.totalMatches;
        const winRateTeam2 = team2Stats.wins / team2Stats.totalMatches;

        // 计算最近表现（最近5场的胜率）
        const recentWinRateTeam1 = team1Stats.recentForm.slice(-5).reduce((sum, val) => sum + val, 0) / Math.min(5, team1Stats.recentForm.length);
        const recentWinRateTeam2 = team2Stats.recentForm.slice(-5).reduce((sum, val) => sum + val, 0) / Math.min(5, team2Stats.recentForm.length);

        // 综合评分（权重可调整）
        const team1Score = (winRateTeam1 * 0.4) + (recentWinRateTeam1 * 0.6);
        const team2Score = (winRateTeam2 * 0.4) + (recentWinRateTeam2 * 0.6);

        // 确定预测胜者
        let predictedWinner, confidence, reason;

        if (team1Score > team2Score) {
            predictedWinner = team1.id;
            confidence = Math.round((team1Score / (team1Score + team2Score)) * 100);
            reason = `${team1.name}最近表现更好(${Math.round(recentWinRateTeam1*100)}%胜率 vs ${Math.round(recentWinRateTeam2*100)}%)，总体胜率${Math.round(winRateTeam1*100)}%`;
        } else {
            predictedWinner = team2.id;
            confidence = Math.round((team2Score / (team1Score + team2Score)) * 100);
            reason = `${team2.name}最近表现更好(${Math.round(recentWinRateTeam2*100)}%胜率 vs ${Math.round(recentWinRateTeam1*100)}%)，总体胜率${Math.round(winRateTeam2*100)}%`;
        }

        // 获取赔率
        let odds = 1.5;
        if (match.odds) {
            odds = match.odds[predictedWinner] || 1.5;
        }

        return {
            matchId: match.id,
            teams: [team1.name, team2.name],
            prediction: predictedWinner === team1.id ? team1.name : team2.name,
            predictedWinner: predictedWinner,
            confidence: confidence,
            odds: odds,
            reason: reason,
            timestamp: new Date()
        };
    }

    // 执行下单
    function placeBet(match, prediction, roundNumber = 1) {
        if (!betConfig.enabled || !prediction || !prediction.predictedWinner) {
            console.log('下注条件不满足，无法下单');
            return;
        }

        console.log(`尝试对比赛 ${match.id} 第${roundNumber}局下单，预测 ${prediction.prediction} 获胜，置信度 ${prediction.confidence}%`);
        logToUI(`尝试下注: ${prediction.teams ? prediction.teams.join(' vs ') : match.teams[0].name + ' vs ' + match.teams[1].name}`, 'info');

        // 生成唯一的下注ID，包含比赛ID和局数
        const betId = `${match.id}-round-${roundNumber}`;

        // 检查是否已经对该比赛的该局下单
        const alreadyBet = (collectedData.betHistory || []).some(bet => bet.betId === betId);
        if (alreadyBet) {
            console.log(`已经对该比赛的第${roundNumber}局下单，跳过`);
            logToUI(`已经对该比赛下单，跳过`, 'warning');
            return;
        }

        // 确保teams字段存在
        const teams = prediction.teams || [
            match.teams[0].name,
            match.teams[1].name
        ];

        // 构建下单记录
        const betRecord = {
            betId: betId,
            matchId: match.id,
            match: match, // 添加完整的比赛信息，确保submitBet可以访问
            matchRound: `第${roundNumber}局`,
            roundNumber: roundNumber,
            teams: teams,
            selectedTeam: prediction.prediction,
            selectedTeamId: prediction.predictedWinner,
            odds: prediction.odds,
            amount: betConfig.betAmount,
            potentialWin: Math.round(betConfig.betAmount * prediction.odds * 100) / 100,
            confidence: prediction.confidence,
            status: 'pending',
            placedAt: new Date(),
            result: null,
            reasoning: prediction.reason || ''
        };

        // 确保betHistory数组存在
        if (!collectedData.betHistory) {
            collectedData.betHistory = [];
        }

        // 添加到下单历史
        collectedData.betHistory.push(betRecord);

        // 保存数据
        saveData();

        // 如果启用了自动确认，直接提交下单
        if (betConfig.autoConfirm) {
            console.log('自动确认已启用，直接提交下单');
            logToUI('自动确认已启用，直接提交下单', 'info');
            submitBet(betRecord);
        } else {
            // 否则显示确认对话框
            console.log('显示下单确认对话框');
            logToUI('请确认下单', 'info');
            showBetConfirmation(betRecord);
        }

        // 更新UI
        updateUI();
        // 更新下注显示
        updateBettingDisplay();
        
        return betRecord; // 返回下注记录，方便调用者使用
    }

    // 更新下注显示
    function updateBettingDisplay() {
        const container = document.getElementById('betting-display-container');
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        // 如果没有下注记录，显示提示信息
        if (!collectedData.betHistory || collectedData.betHistory.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #888;">
                    <div style="font-size: 16px; margin-bottom: 10px;">暂无下注记录</div>
                    <div style="font-size: 12px;">您可以在比赛分析中选择手动下单或开启自动下单</div>
                </div>
            `;
            return;
        }

        // 添加卡片容器样式
        const cardContainerStyle = document.createElement('style');
        cardContainerStyle.textContent = `
            .bet-card-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            .bet-card {
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
                transition: all 0.3s ease;
            }
            .bet-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            }
            .bet-card-header {
                padding: 10px 15px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .bet-card-body {
                padding: 15px;
            }
            .bet-card-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 13px;
            }
            .bet-card-divider {
                height: 1px;
                background: rgba(255, 255, 255, 0.1);
                margin: 10px 0;
            }
            .bet-card-footer {
                padding: 8px 15px;
                font-size: 11px;
                color: #aaa;
                text-align: right;
                background: rgba(0, 0, 0, 0.2);
            }
            .bet-amount {
                font-weight: bold;
                color: #ffcc00;
            }
            .bet-odds {
                font-weight: bold;
                color: #00ccff;
            }
            .bet-income {
                font-weight: bold;
                color: #ff9900;
            }
            .bet-team {
                font-weight: bold;
            }
            .bet-status-badge {
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
            }
            .bet-round-badge {
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                background: rgba(0, 0, 0, 0.3);
                margin-left: 5px;
            }
        `;
        document.head.appendChild(cardContainerStyle);

        // 创建卡片容器
        const cardContainer = document.createElement('div');
        cardContainer.className = 'bet-card-container';
        container.appendChild(cardContainer);

        // 创建下注记录卡片
        collectedData.betHistory.forEach((bet, index) => {
            // 根据状态设置卡片样式
            let headerBgColor, statusBadgeBg, statusText, cardBorderColor;

            switch(bet.status) {
                case 'pending':
                case 'placed':
                    // 未分出胜负 - 白色卡片
                    headerBgColor = 'linear-gradient(to right, #444444, #666666)';
                    statusBadgeBg = 'rgba(255, 255, 255, 0.2)';
                    statusText = '进行中';
                    cardBorderColor = '#777';
                    break;
                case 'won':
                    // 胜利 - 红色卡片
                    headerBgColor = 'linear-gradient(to right, #990000, #cc0000)';
                    statusBadgeBg = 'rgba(255, 0, 0, 0.7)';
                    statusText = '已赢取';
                    cardBorderColor = '#cc0000';
                    break;
                case 'lost':
                    // 失败 - 绿色卡片
                    headerBgColor = 'linear-gradient(to right, #006600, #009900)';
                    statusBadgeBg = 'rgba(0, 153, 0, 0.7)';
                    statusText = '已输';
                    cardBorderColor = '#00aa00';
                    break;
                case 'cancelled':
                    headerBgColor = 'linear-gradient(to right, #333333, #555555)';
                    statusBadgeBg = 'rgba(150, 150, 150, 0.7)';
                    statusText = '已取消';
                    cardBorderColor = '#555';
                    break;
                case 'failed':
                    headerBgColor = 'linear-gradient(to right, #660000, #880000)';
                    statusBadgeBg = 'rgba(200, 0, 0, 0.7)';
                    statusText = '失败';
                    cardBorderColor = '#880000';
                    break;
                default:
                    headerBgColor = 'linear-gradient(to right, #333333, #444444)';
                    statusBadgeBg = 'rgba(150, 150, 150, 0.7)';
                    statusText = '未知';
                    cardBorderColor = '#444';
            }

            // 计算预计收入
            const potentialWin = Math.round(bet.amount * bet.odds * 100) / 100;

            // 获取比赛局数信息
            const matchRound = bet.matchRound || '第1局';

            // 创建卡片元素
            const card = document.createElement('div');
            card.className = 'bet-card';
            card.style.border = `1px solid ${cardBorderColor}`;

            // 添加卡片内容
            card.innerHTML = `
                <div class="bet-card-header" style="background: ${headerBgColor};">
                    <div>${bet.teams ? bet.teams.join(' VS ') : '未知比赛'}</div>
                    <span class="bet-status-badge" style="background: ${statusBadgeBg};">${statusText}</span>
                </div>
                <div class="bet-card-body">
                    <div class="bet-card-row">
                        <div>选择队伍:</div>
                        <div class="bet-team">${bet.selectedTeam}<span class="bet-round-badge">${matchRound}</span></div>
                    </div>
                    <div class="bet-card-divider"></div>
                    <div class="bet-card-row">
                        <div>下注金额:</div>
                        <div class="bet-amount">${bet.amount}</div>
                    </div>
                    <div class="bet-card-row">
                        <div>固定赔率:</div>
                        <div class="bet-odds">${bet.odds.toFixed(2)}</div>
                    </div>
                    <div class="bet-card-row">
                        <div>预计收入:</div>
                        <div class="bet-income">${potentialWin}</div>
                    </div>
                </div>
                <div class="bet-card-footer">
                    ${new Date(bet.placedAt).toLocaleString()}
                </div>
            `;

            // 添加到容器
            cardContainer.appendChild(card);
        });

        // 添加实时监控功能
        const monitorSection = document.createElement('div');
        monitorSection.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
        `;
        monitorSection.innerHTML = `
            <h4 style="margin: 0 0 10px 0; color: #00ccff; font-size: 14px;">实时比赛监控</h4>
            <div style="font-size: 12px; color: #aaa; margin-bottom: 10px;">
                系统正在监控您下注的比赛，状态变化将自动更新
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 11px; color: #888;">
                    上次更新: ${new Date().toLocaleTimeString()}
                </div>
                <button id="monitor-refresh-btn" style="
                    background-color: rgba(0, 153, 255, 0.3);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 5px 10px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: background-color 0.2s;
                ">立即刷新</button>
            </div>
        `;
        container.appendChild(monitorSection);

        // 添加刷新按钮事件
        const refreshBtn = monitorSection.querySelector('#monitor-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                updateBettingDisplay();
                logToUI('已手动刷新比赛监控', 'info');
            });
        }
    }

    // 提交下单到网站
    function submitBet(betRecord) {
        console.log('提交下单:', betRecord);
        logToUI('提交下单: ' + betRecord.selectedTeam + ' 金额: ' + betRecord.amount);

        // 使用更全面的选择器查找下单按钮
        const betButtons = Array.from(document.querySelectorAll(
            '.bet-button, .place-bet, [data-bet="true"], div.btBtn, div.odds, #singleBet, ' +
            'div.oddItem, div.oddNum, div.teamInfoGrp, div.marketRow, div.teamName, ' +
            '[class*="odd"], [class*="bet"], [class*="team"]'
        ));
        let targetButton = null;

        // 尝试找到匹配的下单按钮
        for (const button of betButtons) {
            const buttonText = button.textContent.toLowerCase();
            const buttonId = button.id || '';
            const buttonClass = button.className || '';

            // 检查按钮是否与我们要下注的队伍相关
            if (buttonText.includes(betRecord.selectedTeam.toLowerCase()) ||
                buttonId.includes(betRecord.selectedTeamId) ||
                button.getAttribute('data-team-id') === betRecord.selectedTeamId) {
                targetButton = button;
                logToUI('找到匹配的下单按钮: ' + buttonText);
                break;
            }
        }

        // 如果没有找到匹配的按钮，尝试查找所有可能的下注元素
        if (!targetButton) {
            logToUI('未找到精确匹配的下单按钮，尝试查找所有可能的下注元素', 'warning');
            
            // 查找所有可能的下注元素
            const allPossibleElements = document.querySelectorAll('div.oddItem, div.oddNum, div.teamInfoGrp, div.marketRow');
            
            if (allPossibleElements.length > 0) {
                // 选择第一个元素作为目标
                targetButton = allPossibleElements[0];
                logToUI('找到可能的下单元素: ' + targetButton.textContent, 'info');
            }
        }

        if (targetButton) {
            // 更新下单状态
            betRecord.status = 'submitted';
            saveData();

            // 模拟点击下单按钮
            targetButton.click();
            console.log('已点击下单按钮');
            logToUI('已点击下单按钮');

            // 尝试填写金额
            setTimeout(() => {
                // 使用更广泛的选择器查找金额输入框
                const amountInputs = document.querySelectorAll(
                    'input[type="number"], input[type="text"], .bet-amount, [placeholder*="金额"], ' +
                    '[class*="amount"], [class*="stake"], [class*="bet"], input'
                );
                
                if (amountInputs.length > 0) {
                    const amountInput = amountInputs[0];
                    // 保存原始值
                    const originalValue = amountInput.value;
                    
                    // 设置新值
                    amountInput.value = betRecord.amount;
                    // 触发多种事件以确保值被正确更新
                    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                    amountInput.dispatchEvent(new Event('change', { bubbles: true }));
                    amountInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    console.log('已填写下单金额:', betRecord.amount);
                    logToUI('已填写下单金额: ' + betRecord.amount);

                    // 尝试点击确认按钮
                    setTimeout(() => {
                        // 使用更广泛的选择器查找确认按钮
                        const confirmButtons = document.querySelectorAll(
                            '.confirm-bet, .submit-bet, [type="submit"], div.btBtn, ' +
                            'button, [class*="confirm"], [class*="submit"], [class*="bet"], ' +
                            '[class*="place"], [class*="ok"], [class*="yes"]'
                        );
                        
                        if (confirmButtons.length > 0) {
                            // 找到最可能的确认按钮
                            let confirmButton = null;
                            for (const btn of confirmButtons) {
                                const btnText = btn.textContent.toLowerCase();
                                if (btnText.includes('确认') || btnText.includes('提交') || 
                                    btnText.includes('下单') || btnText.includes('确定') || 
                                    btnText.includes('confirm') || btnText.includes('submit') || 
                                    btnText.includes('place bet')) {
                                    confirmButton = btn;
                                    break;
                                }
                            }
                            
                            // 如果没有找到明确的确认按钮，使用第一个按钮
                            if (!confirmButton) {
                                confirmButton = confirmButtons[0];
                            }
                            
                            confirmButton.click();
                            console.log('已点击确认下单按钮');
                            logToUI('已点击确认下单按钮');
                            betRecord.status = 'placed';
                            saveData();

                            // 更新下注显示
                            updateBettingDisplay();
                            
                            // 监听下注结果
                            setTimeout(() => {
                                checkBetResult(betRecord);
                            }, 1500);
                        } else {
                            logToUI('未找到确认下单按钮，尝试直接提交', 'warning');
                            // 如果没有找到确认按钮，尝试按回车键提交
                            amountInput.dispatchEvent(new KeyboardEvent('keydown', {
                                key: 'Enter',
                                code: 'Enter',
                                keyCode: 13,
                                which: 13,
                                bubbles: true
                            }));
                            
                            betRecord.status = 'placed';
                            saveData();
                            updateBettingDisplay();
                            
                            // 监听下注结果
                            setTimeout(() => {
                                checkBetResult(betRecord);
                            }, 1500);
                        }
                    }, 800);
                } else {
                    logToUI('未找到金额输入框，尝试直接确认下单', 'warning');
                    // 如果没有找到金额输入框，尝试直接点击确认按钮
                    setTimeout(() => {
                        const confirmButtons = document.querySelectorAll(
                            'button, [class*="confirm"], [class*="submit"], [class*="bet"], ' +
                            '[class*="place"], [class*="ok"], [class*="yes"]'
                        );
                        
                        if (confirmButtons.length > 0) {
                            confirmButtons[0].click();
                            logToUI('已尝试直接确认下单', 'info');
                            betRecord.status = 'placed';
                            saveData();
                            updateBettingDisplay();
                            
                            // 监听下注结果
                            setTimeout(() => {
                                checkBetResult(betRecord);
                            }, 1500);
                        } else {
                            logToUI('未找到任何可用的确认按钮', 'error');
                            betRecord.status = 'failed';
                            betRecord.result = '未找到确认按钮';
                            saveData();
                            updateBettingDisplay();
                            
                            // 显示下注失败提示
                            showBetNotification('下注失败', '未找到确认按钮', 'error');
                        }
                    }, 500);
                }
            }, 800);
        } else {
            console.log('未找到任何可能的下单元素');
            logToUI('未找到任何可能的下单元素', 'error');
            betRecord.status = 'failed';
            betRecord.result = '未找到下单元素';
            saveData();

            // 更新下注显示
            updateBettingDisplay();
            
            // 显示下注失败提示
            showBetNotification('下注失败', '未找到下单元素', 'error');
        }
    }
    
    // 检查下注结果
    function checkBetResult(betRecord) {
        // 检查页面上是否有成功或失败的提示信息
        const successElements = document.querySelectorAll(
            '.success-message, .bet-success, [class*="success"], ' +
            'div:contains("下注成功"), div:contains("投注成功"), div:contains("已接受")'
        );
        
        const errorElements = document.querySelectorAll(
            '.error-message, .bet-error, [class*="error"], ' +
            'div:contains("余额不足"), div:contains("下注失败"), div:contains("投注失败"), ' +
            'div:contains("错误"), div:contains("失败")'
        );
        
        // 检查DOM中的文本内容
        const pageText = document.body.textContent.toLowerCase();
        const hasSuccessText = pageText.includes('下注成功') || pageText.includes('投注成功') || 
                              pageText.includes('已接受') || pageText.includes('bet accepted');
        
        const hasErrorText = pageText.includes('余额不足') || pageText.includes('下注失败') || 
                            pageText.includes('投注失败') || pageText.includes('insufficient balance');
        
        if (successElements.length > 0 || hasSuccessText) {
            // 下注成功
            betRecord.status = 'placed';
            betRecord.result = '下注成功';
            saveData();
            updateBettingDisplay();
            
            // 显示下注成功提示
            showBetNotification('下注成功', `已成功对 ${betRecord.selectedTeam} 下注 ${betRecord.amount}`, 'success');
            logToUI(`下注成功: ${betRecord.selectedTeam} 金额: ${betRecord.amount}`, 'success');
        } else if (errorElements.length > 0 || hasErrorText) {
            // 下注失败
            betRecord.status = 'failed';
            
            // 尝试确定失败原因
            let failReason = '未知原因';
            
            if (pageText.includes('余额不足') || pageText.includes('insufficient balance')) {
                failReason = '余额不足';
            } else if (pageText.includes('赔率变化') || pageText.includes('odds changed')) {
                failReason = '赔率已变化';
            } else if (pageText.includes('已关闭') || pageText.includes('closed')) {
                failReason = '投注已关闭';
            }
            
            betRecord.result = `下注失败: ${failReason}`;
            saveData();
            updateBettingDisplay();
            
            // 显示下注失败提示
            showBetNotification('下注失败', failReason, 'error');
            logToUI(`下注失败: ${failReason}`, 'error');
        } else {
            // 无法确定结果，可能需要再次检查
            console.log('无法确定下注结果，将再次检查');
            
            // 如果已经重试过，则标记为未知状态
            if (betRecord.checkCount && betRecord.checkCount >= 2) {
                betRecord.status = 'unknown';
                betRecord.result = '无法确定下注结果';
                saveData();
                updateBettingDisplay();
                
                // 显示未知结果提示
                showBetNotification('下注状态未知', '请手动检查下注是否成功', 'warning');
                logToUI('下注状态未知，请手动检查', 'warning');
            } else {
                // 增加检查计数并再次尝试
                betRecord.checkCount = (betRecord.checkCount || 0) + 1;
                saveData();
                
                // 再次检查
                setTimeout(() => {
                    checkBetResult(betRecord);
                }, 1500);
            }
        }
    }
    
    // 显示下注通知
    function showBetNotification(title, message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        
        // 根据类型设置样式
        let bgColor, borderColor, iconColor;
        
        switch(type) {
            case 'success':
                bgColor = 'rgba(0, 128, 0, 0.9)';
                borderColor = '#00ff00';
                iconColor = '#00ff00';
                break;
            case 'error':
                bgColor = 'rgba(128, 0, 0, 0.9)';
                borderColor = '#ff0000';
                iconColor = '#ff0000';
                break;
            case 'warning':
                bgColor = 'rgba(128, 128, 0, 0.9)';
                borderColor = '#ffff00';
                iconColor = '#ffff00';
                break;
            default: // info
                bgColor = 'rgba(0, 0, 128, 0.9)';
                borderColor = '#0000ff';
                iconColor = '#0000ff';
        }
        
        // 设置通知样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 300px;
            max-width: 400px;
            background-color: ${bgColor};
            color: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            font-family: 'Segoe UI', Arial, sans-serif;
            border-left: 4px solid ${borderColor};
            animation: slideInRight 0.5s, fadeOut 0.5s 5s forwards;
        `;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // 设置通知内容
        let icon = '';
        
        switch(type) {
            case 'success':
                icon = '✓';
                break;
            case 'error':
                icon = '✗';
                break;
            case 'warning':
                icon = '⚠';
                break;
            default: // info
                icon = 'ℹ';
        }
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div style="font-size: 24px; margin-right: 15px; color: ${iconColor};">${icon}</div>
                <div>
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${title}</div>
                    <div style="font-size: 14px;">${message}</div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动移除通知
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5500); // 5.5秒后移除（包括0.5秒的淡出动画）
        
        // 添加点击关闭功能
        notification.addEventListener('click', function() {
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    // 显示下单确认对话框
    function showBetConfirmation(betRecord) {
        // 创建确认对话框
        const confirmDialog = document.createElement('div');
        confirmDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.9);
            color: white;
            z-index: 10002;
            border-radius: 5px;
            padding: 20px;
            font-family: Arial, sans-serif;
            min-width: 300px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        `;

        // 获取比赛局数信息
        const matchRound = betRecord.matchRound || '第1局';

        confirmDialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #00ff00; text-align: center;">确认下单</h3>
            <div style="margin-bottom: 15px;">
                <div><strong>比赛:</strong> ${betRecord.teams[0]} VS ${betRecord.teams[1]}</div>
                <div><strong>局数:</strong> ${matchRound}</div>
                <div><strong>选择:</strong> ${betRecord.selectedTeam}</div>
                <div><strong>固定赔率:</strong> ${betRecord.odds}</div>
                <div><strong>下注金额:</strong> ${betRecord.amount}</div>
                <div><strong>预计收入:</strong> ${betRecord.potentialWin}</div>
                <div><strong>置信度:</strong> ${betRecord.confidence}%</div>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <button id="confirm-bet-btn" style="
                    background-color: #00aa00;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 8px 15px;
                    cursor: pointer;
                ">确认下单</button>
                <button id="cancel-bet-btn" style="
                    background-color: #aa0000;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 8px 15px;
                    cursor: pointer;
                ">取消</button>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        // 添加按钮事件
        document.getElementById('confirm-bet-btn').addEventListener('click', function() {
            submitBet(betRecord);
            document.body.removeChild(confirmDialog);
        });

        document.getElementById('cancel-bet-btn').addEventListener('click', function() {
            betRecord.status = 'cancelled';
            saveData();
            document.body.removeChild(confirmDialog);
            updateUI();

            // 更新下注显示
            updateBettingDisplay();
        });
    }

    // 处理事件数据
    function processEventData(data) {
        // 根据实际数据结构进行调整
        if (data.events) {
            collectedData.events = data.events;
        } else if (data.type === 'event') {
            collectedData.events.push(data);
            // 限制事件数量，避免内存过大
            if (collectedData.events.length > 100) {
                collectedData.events = collectedData.events.slice(-100);
            }
        }

        collectedData.lastUpdate = new Date();

        // 如果启用了实时更新，检查是否需要触发分析
        if (updateConfig.enabled && data.type === 'match_update') {
            checkAndUpdateAnalysis();
        }
    }

    // 实时数据更新函数
    function updateRealTimeData() {
        if (!updateConfig.enabled) return;

        const now = new Date();

        // 检查是否需要更新比赛数据
        if (!updateConfig.lastMatchUpdate ||
            (now - updateConfig.lastMatchUpdate) / 1000 >= updateConfig.matchInterval) {
            updateMatchData();
            updateConfig.lastMatchUpdate = now;

            if (updateConfig.showNotifications) {
                logToUI('已更新比赛数据', 'info');
            }
        }

        // 检查是否需要更新赔率数据
        if (!updateConfig.lastOddsUpdate ||
            (now - updateConfig.lastOddsUpdate) / 1000 >= updateConfig.oddsInterval) {
            updateOddsData();
            updateConfig.lastOddsUpdate = now;

            if (updateConfig.showNotifications) {
                logToUI('已更新赔率数据', 'info');
            }
        }

        // 检查是否需要更新分析
        if (!updateConfig.lastAnalysisUpdate ||
            (now - updateConfig.lastAnalysisUpdate) / 1000 >= updateConfig.analysisInterval) {
            if (!analysisActive) {
                analyzeMatches();
                updateConfig.lastAnalysisUpdate = now;

                if (updateConfig.showNotifications) {
                    logToUI('已更新比赛分析', 'info');
                }
            }
        }
    }

    // 更新比赛数据
    function updateMatchData() {
        // 尝试从页面DOM中提取最新比赛数据
        const matchElements = document.querySelectorAll('.match-container, .match-row, .event-row, div.matchItem');

        if (matchElements.length > 0) {
            matchElements.forEach((element, index) => {
                try {
                    // 提取比赛信息
                    const matchId = element.getAttribute('data-match-id') || `dom-match-${index}`;
                    const matchInfo = extractMatchInfo(element);

                    if (matchInfo) {
                        // 检查是否已存在该比赛
                        const existingMatchIndex = collectedData.matches.findIndex(m => m.id === matchId);

                        if (existingMatchIndex !== -1) {
                            // 更新现有比赛数据
                            const existingMatch = collectedData.matches[existingMatchIndex];
                            const updatedMatch = {...existingMatch, ...matchInfo, id: matchId};

                            // 检查是否有变化
                            if (JSON.stringify(existingMatch) !== JSON.stringify(updatedMatch)) {
                                collectedData.matches[existingMatchIndex] = updatedMatch;

                                if (updateConfig.highlightChanges) {
                                    // 高亮显示变化的元素
                                    element.style.transition = 'background-color 1s';
                                    element.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
                                    setTimeout(() => {
                                        element.style.backgroundColor = '';
                                    }, 2000);
                                }
                            }
                        } else {
                            // 添加新比赛
                            collectedData.matches.push({id: matchId, ...matchInfo});

                            if (updateConfig.showNotifications) {
                                logToUI(`发现新比赛: ${matchInfo.teams ? matchInfo.teams.map(t => t.name).join(' vs ') : '未知比赛'}`, 'info');
                            }
                        }
                    }
                } catch (e) {
                    console.error('提取比赛信息错误:', e);
                }
            });
        }

        // 更新UI
        updateMatchesDisplay();
    }

    // 从DOM元素中提取比赛信息
    function extractMatchInfo(element) {
        // 尝试提取队伍名称
        const teamElements = element.querySelectorAll('.team-name, .team, div.teamName');
        const teams = [];

        if (teamElements.length >= 2) {
            teams.push(
                { id: 'team1-' + Date.now(), name: teamElements[0].textContent.trim() },
                { id: 'team2-' + Date.now(), name: teamElements[1].textContent.trim() }
            );
        }

        // 尝试提取比赛状态
        const statusElement = element.querySelector('.match-status, .status, div.matchStatus');
        const status = statusElement ? statusElement.textContent.trim() : '未知';

        // 尝试提取比赛时间
        const timeElement = element.querySelector('.match-time, .time, div.matchTime');
        const timeText = timeElement ? timeElement.textContent.trim() : '';
        const startTime = timeText ? new Date(timeText) : new Date();

        // 尝试提取赔率
        const oddsElements = element.querySelectorAll('.odds, .odd, div.oddItem');
        const odds = {};

        if (oddsElements.length >= 2 && teams.length >= 2) {
            try {
                odds[teams[0].id] = parseFloat(oddsElements[0].textContent.trim()) || 1.5;
                odds[teams[1].id] = parseFloat(oddsElements[1].textContent.trim()) || 1.5;
            } catch (e) {
                console.error('解析赔率错误:', e);
            }
        }

        return {
            teams: teams.length > 0 ? teams : undefined,
            status: status,
            startTime: startTime,
            odds: Object.keys(odds).length > 0 ? odds : undefined,
            source: 'dom-extracted',
            lastUpdated: new Date()
        };
    }

    // 更新赔率数据
    function updateOddsData() {
        // 尝试从页面DOM中提取最新赔率数据
        const oddsElements = document.querySelectorAll('.odds-container, .odds-row, div.oddItem');

        if (oddsElements.length > 0) {
            oddsElements.forEach((element) => {
                try {
                    // 尝试找到关联的比赛ID
                    let matchId = element.getAttribute('data-match-id');
                    if (!matchId) {
                        // 尝试从父元素或相关元素找到比赛ID
                        const matchElement = element.closest('[data-match-id]') ||
                                            element.parentElement.querySelector('[data-match-id]');
                        if (matchElement) {
                            matchId = matchElement.getAttribute('data-match-id');
                        }
                    }

                    if (matchId) {
                        // 查找对应的比赛
                        const matchIndex = collectedData.matches.findIndex(m => m.id === matchId);
                        if (matchIndex !== -1) {
                            // 提取赔率数据
                            const oddsValues = element.querySelectorAll('.odd-value, .odd, span.oddNum');
                            const match = collectedData.matches[matchIndex];

                            if (oddsValues.length >= 2 && match.teams && match.teams.length >= 2) {
                                const oldOdds = {...match.odds};
                                const newOdds = {};

                                try {
                                    newOdds[match.teams[0].id] = parseFloat(oddsValues[0].textContent.trim()) || oldOdds[match.teams[0].id] || 1.5;
                                    newOdds[match.teams[1].id] = parseFloat(oddsValues[1].textContent.trim()) || oldOdds[match.teams[1].id] || 1.5;

                                    // 检查赔率是否有变化
                                    if (JSON.stringify(oldOdds) !== JSON.stringify(newOdds)) {
                                        // 更新赔率
                                        match.odds = newOdds;
                                        match.lastOddsUpdate = new Date();

                                        if (updateConfig.showNotifications) {
                                            const team1 = match.teams[0].name;
                                            const team2 = match.teams[1].name;
                                            const oldOdds1 = oldOdds[match.teams[0].id]?.toFixed(2) || '?';
                                            const oldOdds2 = oldOdds[match.teams[1].id]?.toFixed(2) || '?';
                                            const newOdds1 = newOdds[match.teams[0].id].toFixed(2);
                                            const newOdds2 = newOdds[match.teams[1].id].toFixed(2);

                                            logToUI(`赔率更新: ${team1}(${oldOdds1}→${newOdds1}) vs ${team2}(${oldOdds2}→${newOdds2})`, 'info');
                                        }

                                        if (updateConfig.highlightChanges) {
                                            // 高亮显示变化的元素
                                            oddsValues.forEach(oddElement => {
                                                oddElement.style.transition = 'color 1s';
                                                oddElement.style.color = '#ffff00';
                                                setTimeout(() => {
                                                    oddElement.style.color = '';
                                                }, 2000);
                                            });
                                        }
                                    }
                                } catch (e) {
                                    console.error('解析赔率错误:', e);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('更新赔率错误:', e);
                }
            });
        }
    }

    // 检查并更新分析
    function checkAndUpdateAnalysis() {
        if (!updateConfig.enabled || analysisActive) return;

        const now = new Date();

        // 检查是否需要更新分析
        if (!updateConfig.lastAnalysisUpdate ||
            (now - updateConfig.lastAnalysisUpdate) / 1000 >= updateConfig.analysisInterval) {
            analyzeMatches();
            updateConfig.lastAnalysisUpdate = now;

            if (updateConfig.showNotifications) {
                logToUI('已更新比赛分析', 'info');
            }
        }
    }

    // 初始化函数
    function init() {
        console.log('初始化电竞数据采集器...');

        // 拦截网络请求
        interceptWebSocket();
        interceptXHR();

        // 等待DOM加载完成后创建UI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                createUI();
                createDOMSelector();
                // 自动加载今日比赛数据
                updateMatchData();
                // 显示左侧比赛面板
                const matchesPanel = document.getElementById('matches-panel');
                if (matchesPanel) {
                    matchesPanel.style.display = 'block';
                }
                // 更新比赛显示
                updateMatchesDisplay();
                logToUI('已自动加载今日比赛数据', 'info');
            });
        } else {
            createUI();
            createDOMSelector();
            // 自动加载今日比赛数据
            updateMatchData();
            // 显示左侧比赛面板和右侧下注面板
            const matchesPanel = document.getElementById('matches-panel');
            const bettingPanel = document.getElementById('betting-panel');
            if (matchesPanel) {
                matchesPanel.style.display = 'block';
            }
            if (bettingPanel) {
                bettingPanel.style.display = 'block';
            }
            // 更新比赛显示
            updateMatchesDisplay();
            logToUI('已自动加载今日比赛数据', 'info');
        }

        // 定期更新UI和下注显示
        setInterval(function() {
            updateUI();
            updateBettingDisplay();
        }, 5000);
        
        // 单独设置自动下注检查定时器，确保正常运行
        setInterval(function() {
            // 检查是否需要自动下注
            if (betConfig.enabled) {
                checkAutoBetting();
            }
        }, 10000);

    // 检查是否需要自动下注
    function checkAutoBetting() {
        if (!betConfig.enabled) {
            console.log('自动下注功能已禁用');
            return;
        }

        console.log('执行自动下注检查...');
        logToUI('执行自动下注检查...', 'info');

        // 检查是否有可下注的比赛
        const now = new Date();
        const currentHour = now.getHours();

        // 检查时间限制 (默认只在9:00-23:00之间下注)
        if (currentHour < 9 || currentHour >= 23) {
            console.log('当前时间不在下注时间范围内');
            logToUI('当前时间不在下注时间范围内 (9:00-23:00)', 'info');
            return;
        }

        // 获取所有今天的比赛
        const todayMatches = Object.values(collectedData.matches).filter(match => {
            if (!match || !match.startTime) return false;
            try {
                const matchDate = new Date(match.startTime);
                return matchDate.toDateString() === now.toDateString();
            } catch (e) {
                console.error('解析比赛时间出错:', e);
                return false;
            }
        });

        console.log(`找到今天的比赛: ${todayMatches.length}场`);
        logToUI(`找到今天的比赛: ${todayMatches.length}场`, 'info');

        if (todayMatches.length === 0) {
            logToUI('没有找到今天的比赛，尝试更新比赛数据', 'warning');
            // 尝试更新比赛数据
            updateMatchData();
            return;
        }

        // 检查每个比赛
        let betPlaced = false;
        for (const match of todayMatches) {
            if (betPlaced) break; // 如果已经下注，跳出循环

            // 跳过已经下注的比赛
            const alreadyBet = Object.values(collectedData.betHistory || []).some(bet => 
                bet.matchId === match.id && ['pending', 'submitted', 'placed', 'won', 'lost'].includes(bet.status)
            );

            if (alreadyBet) {
                console.log(`比赛 ${match.id} (${match.teams[0].name} vs ${match.teams[1].name}) 已经下注过`);
                continue;
            }

            // 检查比赛状态
            if (match.status !== 'upcoming' && match.status !== 'live') {
                console.log(`比赛 ${match.id} 状态不符合要求: ${match.status}`);
                continue;
            }

            // 检查赔率是否在配置范围内
            const odds = match.odds;
            if (!odds || !odds[match.teams[0].id] || !odds[match.teams[1].id]) {
                console.log(`比赛 ${match.id} 赔率数据不完整`);
                continue;
            }

            // 分析比赛并获取预测
            console.log(`分析比赛: ${match.teams[0].name} vs ${match.teams[1].name}`);
            const prediction = predictMatch(match);
            if (!prediction || !prediction.predictedWinner) {
                console.log(`比赛 ${match.id} 无法生成预测`);
                continue;
            }
            
            if (prediction.confidence < betConfig.confidenceThreshold) {
                console.log(`比赛 ${match.id} 预测置信度不足: ${prediction.confidence}`);
                continue;
            }

            // 评估风险
            const risk = assessRisk(match, prediction);
            if (risk > getRiskLevelValue(betConfig.riskLevel)) {
                console.log(`比赛 ${match.id} 风险过高: ${risk}`);
                continue;
            }

            // 确定下注金额
            let betAmount = betConfig.defaultAmount || 10;

            // 根据赔率调整下注金额
            const selectedTeam = prediction.prediction;
            const selectedOdds = prediction.odds;
            
            // 检查赔率是否在允许范围内
            if (selectedOdds < betConfig.minOdds || selectedOdds > betConfig.maxOdds) {
                console.log(`比赛 ${match.id} 赔率不在允许范围内: ${selectedOdds}`);
                continue;
            }

            // 根据赔率阈值调整下注金额
            betAmount = adjustBetAmount(selectedOdds);

            // 临时修改下注金额
            const originalAmount = betConfig.betAmount;
            betConfig.betAmount = betAmount;

            logToUI(`准备下注: ${match.teams[0].name} vs ${match.teams[1].name}, 选择: ${selectedTeam}, 金额: ${betAmount}, 赔率: ${selectedOdds}`, 'success');

            // 执行下单
            console.log(`对比赛 ${match.id} 自动下单，预测 ${prediction.prediction} 获胜，置信度 ${prediction.confidence}%，调整后下注金额: ${betAmount}`);
            placeBet(match, prediction);

            // 恢复原始下注金额
            betConfig.betAmount = originalAmount;

            betPlaced = true;
            logToUI(`已自动提交下注: ${selectedTeam}`, 'success');
        }

        if (!betPlaced) {
            logToUI('没有找到符合条件的比赛进行下注', 'info');
        }
    }
    
    // 获取风险等级数值
    function getRiskLevelValue(riskLevel) {
        switch(riskLevel) {
            case 'low': return 1;
            case 'medium': return 2;
            case 'high': return 3;
            default: return 2;
        }
    }

    // 获取比赛的游戏类型
    function getGameType(match) {
        // 从比赛标题、描述或其他信息中提取游戏类型
        const matchTitle = match.title || '';
        const matchDesc = match.description || '';
        const teamNames = match.teams ? match.teams.map(t => t.name).join(' ') : '';
        const allText = (matchTitle + ' ' + matchDesc + ' ' + teamNames).toLowerCase();

        // 判断游戏类型
        if (allText.includes('英雄联盟') || allText.includes('lol') || allText.includes('league of legends')) {
            return 'LOL';
        } else if (allText.includes('王者荣耀') || allText.includes('kog') || allText.includes('king of glory')) {
            return 'KOG';
        } else if (allText.includes('cs:go') || allText.includes('csgo') || allText.includes('反恐精英')) {
            return 'CSGO';
        } else if (allText.includes('dota2') || allText.includes('刀塔') || allText.includes('dota')) {
            return 'DOTA2';
        } else if (allText.includes('激斗峡谷') || allText.includes('wild rift') || allText.includes('wildrift')) {
            return 'WildRift';
        }

        // 默认返回LOL
        return 'LOL';
    }

    // 检查比赛是否满足最小开局时间限制
    function checkGameTimeLimit(match, gameType) {
        // 获取比赛时间（分钟）
        const gameTime = getGameTime(match);

        // 获取该游戏类型的最小开局时间限制
        const minTime = betConfig.gameRules.minGameTime[gameType] || 0;

        // 检查是否满足最小开局时间限制
        return gameTime >= minTime;
    }

    // 检查比赛是否满足开局时间+赔率限制
    function checkStartTimeOddsLimit(match, gameType, odds) {
        // 获取比赛时间（分钟）
        const gameTime = getGameTime(match);

        // 获取该游戏类型的开局时间+赔率限制
        const limit = betConfig.gameRules.startTimeOddsLimit[gameType];
        if (!limit) return true;

        // 如果比赛时间等于限制时间，且赔率大于等于限制赔率，则不满足条件
        if (gameTime === limit.time && odds >= limit.maxOdds) {
            return false;
        }

        return true;
    }

    // 获取比赛时间（分钟）
    function getGameTime(match) {
        // 尝试从比赛信息中提取时间
        const gameTimeStr = match.gameTime || match.time || '';

        // 如果有明确的比赛时间字段
        if (typeof gameTimeStr === 'number') {
            return gameTimeStr;
        }

        // 尝试解析时间字符串（格式可能是"10:30"或"10分30秒"等）
        if (typeof gameTimeStr === 'string') {
            // 尝试匹配"分钟:秒数"格式
            const timeMatch = gameTimeStr.match(/(\d+)[:：](\d+)/);
            if (timeMatch) {
                return parseInt(timeMatch[1]);
            }

            // 尝试匹配"x分y秒"格式
            const cnTimeMatch = gameTimeStr.match(/(\d+)[分](\d+)[秒]/);
            if (cnTimeMatch) {
                return parseInt(cnTimeMatch[1]);
            }

            // 尝试直接解析数字
            const numMatch = gameTimeStr.match(/(\d+)/);
            if (numMatch) {
                return parseInt(numMatch[1]);
            }
        }

        // 如果无法解析，默认返回0
        return 0;
    }

    // 根据赔率调整下注金额
    function adjustBetAmount(odds) {
        if (!betConfig.oddsAdjustment.enabled) {
            return betConfig.betAmount;
        }

        // 按照赔率从高到低排序阈值
        const sortedThresholds = [...betConfig.oddsAdjustment.thresholds].sort((a, b) => b.threshold - a.threshold);

        // 查找第一个小于等于当前赔率的阈值
        for (const threshold of sortedThresholds) {
            if (odds >= threshold.threshold) {
                // 计算调整后的下注金额
                return Math.round(betConfig.betAmount * (threshold.betPercentage / 100));
            }
        }

        // 如果没有匹配的阈值，返回原始下注金额
        return betConfig.betAmount;
    }

        // 初始化自动下注功能
        logToUI('自动下注功能已初始化', 'info');

        // 定期监控选择的DOM元素
        setInterval(monitorSelectedElements, 2000);

        // 定期更新比赛数据
        setInterval(function() {
            if (updateConfig.enabled) {
                updateMatchData();
                updateMatchesDisplay();
                updateConfig.lastMatchUpdate = new Date();
            }
        }, updateConfig.matchInterval * 1000);

        // 定期更新赔率数据
        setInterval(function() {
            if (updateConfig.enabled) {
                updateOddsData();
                updateConfig.lastOddsUpdate = new Date();
            }
        }, updateConfig.oddsInterval * 1000);
    }

    // 启动脚本
    init();

})();
