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

        // 添加日志标题
        const logHeader = document.createElement('div');
        logHeader.style.cssText = `
            padding: 12px;
            background: linear-gradient(to right, #f0f0f0, #e0e0e0);
            border-bottom: 1px solid #dddddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            border-radius: 8px 8px 0 0;
        `;
        logHeader.innerHTML = '<h4 style="margin: 0; color: #2e7d32; text-shadow: 0 0 5px rgba(46,125,50,0.2);">电竞数据采集器 - 系统日志</h4>';
        logPopup.appendChild(logHeader);

        // 添加关闭按钮
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
            box-shadow: 0 0 5px rgba(211, 47, 47, 0.2);
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
            logPopup.style.display = 'none';
        };
        logHeader.appendChild(closeBtn);

        // 创建选项卡容器
        const tabsContainer = document.createElement('div');
        tabsContainer.style.cssText = `
            display: flex;
            margin-bottom: 10px;
            border-bottom: 1px solid #dddddd;
        `;
        logPopup.appendChild(tabsContainer);

        // 创建日志选项卡
        const logsTab = document.createElement('div');
        logsTab.textContent = '系统日志';
        logsTab.className = 'log-tab active';
        logsTab.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            background-color: rgba(46, 125, 50, 0.1);
            border-radius: 5px 5px 0 0;
            margin-right: 5px;
            font-weight: bold;
            color: #2e7d32;
            border: 1px solid #dddddd;
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
            background-color: rgba(200, 200, 200, 0.3);
            border-radius: 5px 5px 0 0;
            font-weight: bold;
            color: #666666;
            border: 1px solid #dddddd;
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
            scrollbar-color: #bbbbbb #f0f0f0;
            padding: 10px;
            background-color: rgba(240, 240, 240, 0.6);
            border-radius: 8px;
            border: 1px solid rgba(200, 200, 200, 0.4);
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
            scrollbar-color: #bbbbbb #f0f0f0;
            padding: 10px;
            background-color: rgba(240, 240, 240, 0.6);
            border-radius: 8px;
            border: 1px solid rgba(200, 200, 200, 0.4);
            display: none;
            flex: 1;
        `;
        contentContainer.appendChild(matchesContent);

        // 添加选项卡切换功能
        logsTab.addEventListener('click', function() {
            logsTab.style.backgroundColor = 'rgba(46, 125, 50, 0.1)';
            logsTab.style.color = '#2e7d32';
            matchesTab.style.backgroundColor = 'rgba(200, 200, 200, 0.3)';
            matchesTab.style.color = '#666666';
            logContent.style.display = 'block';
            matchesContent.style.display = 'none';
            logsTab.className = 'log-tab active';
            matchesTab.className = 'log-tab';
        });

        matchesTab.addEventListener('click', function() {
            matchesTab.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';
            matchesTab.style.color = '#1976d2';
            logsTab.style.backgroundColor = 'rgba(200, 200, 200, 0.3)';
            logsTab.style.color = '#666666';
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
                background: #f0f0f0;
                border-radius: 4px;
            }
            #logs-container::-webkit-scrollbar-thumb,
            #today-matches-container::-webkit-scrollbar-thumb {
                background-color: #bbbbbb;
                border-radius: 4px;
                border: 1px solid #dddddd;
            }
            #logs-container::-webkit-scrollbar-thumb:hover,
            #today-matches-container::-webkit-scrollbar-thumb:hover {
                background-color: #999999;
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
                background-color: rgba(240, 240, 240, 0.6);
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

        // 更新日志UI（只更新左侧操作日志面板）
        updateLogsUI();

        // 不再显示右下角弹窗
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
                let statusColor = '#777777';
                if (status === '进行中') statusColor = '#1976d2';
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
            background-color: rgba(255, 255, 255, 0.95);
            color: #333333;
            z-index: 10001;
            border-radius: 5px;
            padding: 10px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            display: none;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            border: 1px solid #dddddd;
        `;

        // 添加工具栏标题
        const toolbarTitle = document.createElement('div');
        toolbarTitle.innerHTML = '<h4 style="margin: 0 0 10px 0; color: #2e7d32;">DOM选择器模式</h4>';
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
            background-color: rgba(240, 240, 240, 0.8);
            border-radius: 3px;
            max-width: 300px;
            word-break: break-all;
            border: 1px solid #dddddd;
        `;
        selectorToolbar.appendChild(hoverInfo);

        // 添加完成按钮
        const doneButton = document.createElement('button');
        doneButton.textContent = '完成选择';
        doneButton.style.cssText = `
            margin-top: 10px;
            background-color: #2e7d32;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 5px 10px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        doneButton.onmouseover = function() {
            this.style.backgroundColor = '#1b5e20';
        };
        doneButton.onmouseout = function() {
            this.style.backgroundColor = '#2e7d32';
        };
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
        hoveredElement.style.outline = '2px solid #f44336';

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
            background-color: rgba(255, 255, 255, 0.98);
            color: #333333;
            z-index: 10002;
            border-radius: 8px;
            padding: 0;
            font-family: Arial, sans-serif;
            font-size: 14px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
            border: 1px solid #dddddd;
            display: ${settingsConfig.visible ? 'block' : 'none'};
        `;

        // 创建设置面板标题栏
        const settingsHeader = document.createElement('div');
        settingsHeader.style.cssText = `
            padding: 15px 20px;
            background: linear-gradient(to right, #e8f5e9, #c8e6c9);
            border-bottom: 1px solid #dddddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        settingsHeader.innerHTML = '<h3 style="margin: 0; color: #2e7d32; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">脚本设置</h3>';
        settingsPanel.appendChild(settingsHeader);

        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: none;
            color: #2e7d32;
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
            background-color: #f0f0f0;
            border-bottom: 1px solid #dddddd;
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
                background-color: ${settingsConfig.activeTab === tab.id ? '#e8f5e9' : '#f0f0f0'};
                color: ${settingsConfig.activeTab === tab.id ? '#333' : '#666'};
                border: none;
                padding: 12px 20px;
                cursor: pointer;
                font-size: 14px;
                flex: 1;
                transition: background-color 0.2s;
            `;
            tabBtn.onmouseover = function() {
                if (settingsConfig.activeTab !== tab.id) {
                    this.style.backgroundColor = '#e0e0e0';
                }
            };
            tabBtn.onmouseout = function() {
                if (settingsConfig.activeTab !== tab.id) {
                    this.style.backgroundColor = '#f0f0f0';
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
            background-color: #ffffff;
        `;
        settingsPanel.appendChild(contentContainer);

        // 添加底部按钮区域
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            padding: 15px 20px;
            background-color: #f5f5f5;
            border-top: 1px solid #dddddd;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        // 添加保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存设置';
        saveBtn.style.cssText = `
            background-color: #2e7d32;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        `;
        saveBtn.onmouseover = function() {
            this.style.backgroundColor = '#1b5e20';
        };
        saveBtn.onmouseout = function() {
            this.style.backgroundColor = '#2e7d32';
        };
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
            background-color: #d32f2f;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        `;
        cancelBtn.onmouseover = function() {
            this.style.backgroundColor = '#b71c1c';
        };
        cancelBtn.onmouseout = function() {
            this.style.backgroundColor = '#d32f2f';
        };
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

        // 定义每个标签页的保存按钮HTML
        const saveButtonHtml = `
            <div class="settings-save-container" style="margin-top: 20px; text-align: center;">
                <button id="tab-save-button" style="
                    background-color: #2e7d32;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 15px;
                    cursor: pointer;
                    font-size: 14px;
                    width: 120px;
                    transition: background-color 0.2s;
                ">保存设置</button>
            </div>
        `;

        // 根据当前激活的选项卡显示不同内容
        switch (settingsConfig.activeTab) {
            case 'general':
                html = `
                    <div class="settings-section">
                        <h4 style="margin-top: 0; color: #2e7d32;">常规设置</h4>
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
                        <h4 style="margin-top: 0; color: #2e7d32;">下注设置</h4>
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
                        <h4 style="margin-top: 0; color: #2e7d32;">赔率调整设置</h4>
                        <div class="settings-item">
                            <label for="odds-adjustment-enabled">启用赔率调整</label>
                            <input type="checkbox" id="odds-adjustment-enabled" ${betConfig.oddsAdjustment.enabled ? 'checked' : ''}>
                        </div>
                        <div class="settings-subsection">
                            <h5 style="color: #1976d2;">赔率阈值设置</h5>
                            <p style="color: #666; font-size: 12px; margin-bottom: 15px;">当赔率超过设定阈值时，下注金额将按照指定百分比进行调整</p>

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

        // 添加当前标签页的保存按钮
        html += saveButtonHtml;

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

        // 为当前标签页的保存按钮添加点击事件
        const tabSaveButton = document.getElementById('tab-save-button');
        if (tabSaveButton) {
            tabSaveButton.onclick = function() {
                saveSettings();
                logToUI(`${settingsConfig.activeTab === 'general' ? '常规' :
                          settingsConfig.activeTab === 'betting' ? '下注' :
                          settingsConfig.activeTab === 'odds' ? '赔率调整' :
                          '游戏规则'}设置已保存`, 'success');
            };
        }
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
        // 创建统一的控制面板
        const dashboardPanel = document.createElement('div');
        dashboardPanel.id = 'esports-dashboard';
        dashboardPanel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 900px;
            height: 600px;
            background-color: rgba(21, 23, 35, 0.95);
            color: white;
            z-index: 9998;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            overflow: hidden;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        // 添加顶部标题栏
        const dashboardHeader = document.createElement('div');
        dashboardHeader.style.cssText = `
            padding: 15px 20px;
            background: linear-gradient(90deg, #1a1f35, #2c3154);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 12px 12px 0 0;
        `;
        dashboardHeader.innerHTML = '<h2 style="margin: 0; color: #ffffff; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">电竞数据分析平台</h2>';
        dashboardPanel.appendChild(dashboardHeader);

        // 添加控制按钮组
        const controlGroup = document.createElement('div');
        controlGroup.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;

        // 添加设置按钮
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '设置';
        settingsBtn.style.cssText = `
            background-color: rgba(46, 125, 50, 0.2);
            color: #4ade80;
            border: 1px solid rgba(46, 125, 50, 0.5);
            border-radius: 6px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        settingsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>设置';
        settingsBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(46, 125, 50, 0.3)';
            this.style.transform = 'translateY(-2px)';
        };
        settingsBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(46, 125, 50, 0.2)';
            this.style.transform = 'translateY(0)';
        };
        settingsBtn.onclick = function() {
            settingsConfig.visible = true;
            createSettingsPanel();
        };
        controlGroup.appendChild(settingsBtn);

        // 添加刷新按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.style.cssText = `
            background-color: rgba(25, 118, 210, 0.2);
            color: #60a5fa;
            border: 1px solid rgba(25, 118, 210, 0.5);
            border-radius: 6px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        refreshBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>刷新';
        refreshBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(25, 118, 210, 0.3)';
            this.style.transform = 'translateY(-2px)';
        };
        refreshBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(25, 118, 210, 0.2)';
            this.style.transform = 'translateY(0)';
        };
        refreshBtn.onclick = function() {
            updateMatchesDisplay();
            logToUI('已刷新比赛数据', 'info');
        };
        controlGroup.appendChild(refreshBtn);

        // 添加DOM选择器按钮
        const selectorBtn = document.createElement('button');
        selectorBtn.style.cssText = `
            background-color: rgba(230, 81, 0, 0.2);
            color: #fb923c;
            border: 1px solid rgba(230, 81, 0, 0.5);
            border-radius: 6px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        selectorBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>选择DOM';
        selectorBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(230, 81, 0, 0.3)';
            this.style.transform = 'translateY(-2px)';
        };
        selectorBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(230, 81, 0, 0.2)';
            this.style.transform = 'translateY(0)';
        };
        selectorBtn.onclick = function() {
            toggleSelectorMode(true);
        };
        controlGroup.appendChild(selectorBtn);

        // 添加导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.style.cssText = `
            background-color: rgba(156, 39, 176, 0.2);
            color: #d8b4fe;
            border: 1px solid rgba(156, 39, 176, 0.5);
            border-radius: 6px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>导出数据';
        exportBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(156, 39, 176, 0.3)';
            this.style.transform = 'translateY(-2px)';
        };
        exportBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(156, 39, 176, 0.2)';
            this.style.transform = 'translateY(0)';
        };
        exportBtn.onclick = exportData;
        controlGroup.appendChild(exportBtn);

        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            background-color: rgba(220, 38, 38, 0.2);
            color: #f87171;
            border: 1px solid rgba(220, 38, 38, 0.5);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-left: 10px;
        `;
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(220, 38, 38, 0.3)';
            this.style.transform = 'rotate(90deg)';
        };
        closeBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(220, 38, 38, 0.2)';
            this.style.transform = 'rotate(0deg)';
        };
        closeBtn.onclick = function() {
            dashboardPanel.style.display = 'none';
            toggleBtn.style.display = 'flex';
        };
        controlGroup.appendChild(closeBtn);

        dashboardHeader.appendChild(controlGroup);

        // 添加主内容区域
        const dashboardContent = document.createElement('div');
        dashboardContent.style.cssText = `
            display: flex;
            flex: 1;
            overflow: hidden;
        `;
        dashboardPanel.appendChild(dashboardContent);

        // 添加左侧比赛列表区域
        const matchesSection = document.createElement('div');
        matchesSection.style.cssText = `
            width: 350px;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            background-color: rgba(30, 34, 53, 0.7);
        `;
        dashboardContent.appendChild(matchesSection);

        // 添加比赛列表标题
        const matchesHeader = document.createElement('div');
        matchesHeader.style.cssText = `
            padding: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: rgba(36, 41, 63, 0.7);
        `;
        matchesHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #4ade80;">今日比赛</h3>
            </div>
            <div style="font-size: 12px; color: #94a3b8;">${new Date().toLocaleDateString()}</div>
        `;
        matchesSection.appendChild(matchesHeader);

        // 添加比赛列表容器
        const matchesContainer = document.createElement('div');
        matchesContainer.id = 'matches-display-container';
        matchesContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        `;
        matchesSection.appendChild(matchesContainer);

        // 添加右侧内容区域
        const contentSection = document.createElement('div');
        contentSection.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        dashboardContent.appendChild(contentSection);

        // 添加选项卡容器
        const tabsContainer = document.createElement('div');
        tabsContainer.style.cssText = `
            display: flex;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            background-color: rgba(36, 41, 63, 0.7);
            padding: 0 15px;
        `;
        contentSection.appendChild(tabsContainer);

        // 创建选项卡
        const tabs = [
            { id: 'analysis', name: '数据分析', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>' },
            { id: 'logs', name: '操作日志', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' },
            { id: 'elements', name: '选择元素', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>' }
        ];

        // 当前激活的选项卡
        let activeTab = 'analysis';

        // 创建选项卡按钮
        tabs.forEach(tab => {
            const tabBtn = document.createElement('div');
            tabBtn.dataset.tabId = tab.id;
            tabBtn.style.cssText = `
                padding: 15px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: ${tab.id === activeTab ? '#60a5fa' : '#94a3b8'};
                border-bottom: 2px solid ${tab.id === activeTab ? '#60a5fa' : 'transparent'};
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            tabBtn.innerHTML = `${tab.icon} ${tab.name}`;
            tabBtn.onmouseover = function() {
                if (tab.id !== activeTab) {
                    this.style.color = '#cbd5e1';
                    this.style.borderBottom = '2px solid rgba(96, 165, 250, 0.3)';
                }
            };
            tabBtn.onmouseout = function() {
                if (tab.id !== activeTab) {
                    this.style.color = '#94a3b8';
                    this.style.borderBottom = '2px solid transparent';
                }
            };
            tabBtn.onclick = function() {
                // 更新所有选项卡样式
                document.querySelectorAll('[data-tab-id]').forEach(btn => {
                    const tabId = btn.dataset.tabId;
                    btn.style.color = tabId === tab.id ? '#60a5fa' : '#94a3b8';
                    btn.style.borderBottom = tabId === tab.id ? '2px solid #60a5fa' : '2px solid transparent';
                });

                // 更新内容区域
                document.querySelectorAll('[data-content-id]').forEach(content => {
                    content.style.display = content.dataset.contentId === tab.id ? 'block' : 'none';
                });

                activeTab = tab.id;
            };
            tabsContainer.appendChild(tabBtn);
        });

        // 添加内容区域容器
        const tabContentsContainer = document.createElement('div');
        tabContentsContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            position: relative;
        `;
        contentSection.appendChild(tabContentsContainer);

        // 创建分析内容
        const analysisContent = document.createElement('div');
        analysisContent.dataset.contentId = 'analysis';
        analysisContent.style.cssText = `
            display: block;
            height: 100%;
            overflow-y: auto;
            padding: 20px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        `;
        analysisContent.id = 'esports-data-content';
        tabContentsContainer.appendChild(analysisContent);

        // 创建日志内容
        const logsContent = document.createElement('div');
        logsContent.dataset.contentId = 'logs';
        logsContent.style.cssText = `
            display: none;
            height: 100%;
            overflow-y: auto;
            padding: 20px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        `;
        logsContent.id = 'logs-container';
        tabContentsContainer.appendChild(logsContent);

        // 创建选择元素内容
        const elementsContent = document.createElement('div');
        elementsContent.dataset.contentId = 'elements';
        elementsContent.style.cssText = `
            display: none;
            height: 100%;
            overflow-y: auto;
            padding: 20px;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        `;
        elementsContent.id = 'selected-elements-container';
        tabContentsContainer.appendChild(elementsContent);

        // 添加自定义滚动条样式
        const scrollbarStyle = document.createElement('style');
        scrollbarStyle.textContent = `
            #matches-display-container::-webkit-scrollbar,
            [data-content-id]::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            #matches-display-container::-webkit-scrollbar-track,
            [data-content-id]::-webkit-scrollbar-track {
                background: transparent;
            }
            #matches-display-container::-webkit-scrollbar-thumb,
            [data-content-id]::-webkit-scrollbar-thumb {
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
            }
            #matches-display-container::-webkit-scrollbar-thumb:hover,
            [data-content-id]::-webkit-scrollbar-thumb:hover {
                background-color: rgba(255, 255, 255, 0.3);
            }
            .match-item {
                background-color: rgba(36, 41, 63, 0.7);
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                border-left: 3px solid #4ade80;
                transition: all 0.2s ease;
                cursor: pointer;
            }
            .match-item:hover {
                transform: translateY(-3px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                background-color: rgba(45, 51, 78, 0.8);
            }
            .team-name {
                font-weight: 600;
                font-size: 14px;
                color: #f1f5f9;
            }
            .team-score {
                font-weight: 700;
                font-size: 18px;
                color: #fbbf24;
                text-shadow: 0 0 5px rgba(251, 191, 36, 0.5);
            }
            .team-odds {
                font-size: 12px;
                color: #4ade80;
                margin-top: 3px;
            }
            .match-status {
                font-size: 12px;
                font-weight: 500;
                padding: 3px 8px;
                border-radius: 12px;
                display: inline-block;
            }
            /* 原有状态类 */
            .match-status.live {
                background-color: rgba(239, 68, 68, 0.2);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }
            .match-status.upcoming {
                background-color: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
                border: 1px solid rgba(59, 130, 246, 0.3);
            }
            .match-status.finished {
                background-color: rgba(107, 114, 128, 0.2);
                color: #9ca3af;
                border: 1px solid rgba(107, 114, 128, 0.3);
            }
            /* 新增状态类 */
            .match-status.status-live {
                background-color: rgba(239, 68, 68, 0.2);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }
            .match-status.status-soon {
                background-color: rgba(16, 185, 129, 0.2);
                color: #34d399;
                border: 1px solid rgba(16, 185, 129, 0.3);
            }
            .match-status.status-upcoming {
                background-color: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
                border: 1px solid rgba(59, 130, 246, 0.3);
            }
            .match-status.status-finished {
                background-color: rgba(107, 114, 128, 0.2);
                color: #9ca3af;
                border: 1px solid rgba(107, 114, 128, 0.3);
            }
            .match-status.status-default {
                background-color: rgba(75, 85, 99, 0.2);
                color: #d1d5db;
                border: 1px solid rgba(75, 85, 99, 0.3);
            }
            .match-type {
                font-size: 12px;
                color: #94a3b8;
            }
            .match-time {
                font-size: 12px;
                color: #cbd5e1;
            }
            .analyze-btn {
                background-color: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 4px;
                padding: 4px 10px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .analyze-btn:hover {
                background-color: rgba(59, 130, 246, 0.3);
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(scrollbarStyle);

        // 创建显示/隐藏按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 9997;
            background-color: #1a1f35;
            color: #60a5fa;
            border: none;
            border-radius: 8px;
            padding: 10px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            display: none;
            align-items: center;
            justify-content: center;
        `;
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
        toggleBtn.onmouseover = function() {
            this.style.transform = 'scale(1.1)';
        };
        toggleBtn.onmouseout = function() {
            this.style.transform = 'scale(1)';
        };
        toggleBtn.onclick = function() {
            dashboardPanel.style.display = 'flex';
            this.style.display = 'none';
        };

        // 添加到页面
        document.body.appendChild(dashboardPanel);
        document.body.appendChild(toggleBtn);

        // 实现拖动功能
        let isDragging = false;
        let offsetX, offsetY;

        dashboardHeader.addEventListener('mousedown', function(e) {
            if (e.target === dashboardHeader || e.target.tagName === 'H2') {
                isDragging = true;
                offsetX = e.clientX - dashboardPanel.getBoundingClientRect().left;
                offsetY = e.clientY - dashboardPanel.getBoundingClientRect().top;
            }
        });

        document.addEventListener('mousemove', function(e) {
            if (isDragging) {
                dashboardPanel.style.left = (e.clientX - offsetX) + 'px';
                dashboardPanel.style.top = (e.clientY - offsetY) + 'px';
            }
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
        });

        // 输出初始日志
        logToUI('电竞数据分析平台已启动', 'success');
    }

    // 更新日志UI
    function updateLogsUI() {
        // 只获取左侧操作日志容器，不再更新右下角弹窗
        const leftLogsContainer = document.querySelector('[data-content-id="logs"]');
        
        // 如果容器不存在，则直接返回
        if (!leftLogsContainer) return;

        let html = '';

        if (collectedData.logs && collectedData.logs.length > 0) {
            // 按时间排序，最近的日志显示在最上面
            const sortedLogs = [...collectedData.logs].sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
            
            sortedLogs.forEach((log) => {
                // 根据日志类型设置颜色和图标
                let logColor = '#ffffff';
                let logIcon = '🔵';
                let borderColor = '#444';
                let borderStyle = 'solid';

                switch(log.type) {
                    case 'info':
                        logColor = '#00ccff';
                        logIcon = 'ℹ️';
                        borderColor = '#0088cc';
                        break;
                    case 'success':
                        logColor = '#00ff99';
                        logIcon = '✅';
                        borderColor = '#00cc66';
                        break;
                    case 'warning':
                        logColor = '#ffcc00';
                        logIcon = '⚠️';
                        borderColor = '#cc9900';
                        borderStyle = 'dashed';
                        break;
                    case 'error':
                        logColor = '#ff3333';
                        logIcon = '❌';
                        borderColor = '#cc0000';
                        borderStyle = 'dashed';
                        break;
                }

                // 格式化时间为 HH:MM:SS
                const time = new Date(log.timestamp).toLocaleTimeString();
                // 格式化日期为 YYYY-MM-DD
                const date = new Date(log.timestamp).toLocaleDateString();

                // 构建日志条目HTML - 简洁样式，无卡片效果
                html += `<div class="log-entry" style="
                    margin-bottom: 5px;
                    padding: 5px 8px;
                    border-left: 2px ${borderStyle} ${borderColor};
                    font-size: 12px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="margin-right: 5px; font-size: 12px;">${logIcon}</span>
                            <span style="font-weight: bold; font-size: 12px;">${log.type.toUpperCase()}</span>
                        </div>
                        <span style="font-size: 11px;">${date} ${time}</span>
                    </div>
                    <div style="
                        color: ${logColor};
                        margin-top: 3px;
                        line-height: 1.4;
                        word-break: break-word;
                        font-size: 12px;
                    ">${log.message}</div>
                </div>`;
            });
        }

        // 如果没有日志，显示提示信息
        if (!html) {
            html = '<div style="color: #aaaaaa; font-style: italic; text-align: center; padding: 10px;">暂无日志记录</div>';
        }

        // 只更新左侧操作日志面板中的日志
        leftLogsContainer.innerHTML = html;
        // 滚动到顶部，因为最新的日志在顶部
        leftLogsContainer.scrollTop = 0;

        // 添加鼠标悬停效果
        function addHoverEffects(container) {
            if (!container) return;
            
            const logEntries = container.querySelectorAll('div[style*="border-left"]');
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
        
        // 只为左侧操作日志容器添加悬停效果
        addHoverEffects(leftLogsContainer);
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
                let statusClass = 'status-default';

                if (currentMatchStatus.includes('进行中') || currentMatchStatus.includes('live')) {
                    statusColor = '#ff9900';
                    statusClass = 'status-live';
                } else if (currentMatchStatus.includes('结束') || currentMatchStatus.includes('完成')) {
                    statusColor = '#aaaaaa';
                    statusClass = 'status-finished';
                } else if (currentMatchStatus.includes('即将开始')) {
                    statusColor = '#00ff00';
                    statusClass = 'status-soon';
                } else if (currentMatchStatus.includes('未开赛')) {
                    statusColor = '#3399ff';
                    statusClass = 'status-upcoming';
                }

                // 获取比赛类型
                const currentMatchType = match.type || matchType;

                html += `<div class="match-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div class="match-type">${currentMatchType}</div>
                        <div class="match-status ${statusClass}">${currentMatchStatus}</div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="flex: 1; text-align: left;">
                            <div style="display: flex; align-items: center;">
                                <div class="team-name">${team1Name}</div>
                                ${team1Score ? `<div class="team-score">${team1Score}</div>` : ''}
                            </div>
                            <div class="team-odds">赔率: ${team1Odds}</div>
                        </div>
                        <div style="font-weight: bold; color: #f87171; font-size: 18px; margin: 0 15px;">VS</div>
                        <div style="flex: 1; text-align: right;">
                            <div style="display: flex; align-items: center; justify-content: flex-end;">
                                ${team2Score ? `<div class="team-score">${team2Score}</div>` : ''}
                                <div class="team-name">${team2Name}</div>
                            </div>
                            <div class="team-odds">赔率: ${team2Odds}</div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="match-time">${formattedDate}</div>
                        <button class="analyze-btn analyze-match-btn" data-match-id="${match.id}">分析</button>
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
                    // 更新UI显示预测结果
                    updateUI();

                    // 切换到数据分析标签页
                    const tabButtons = document.querySelectorAll('[data-tab-id]');
                    tabButtons.forEach(tab => {
                        if (tab.dataset.tabId === 'analysis') {
                            tab.click();
                        }
                    });
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

        // 显示预测结果
        html += `<div style="margin-top: 20px;">
            <h3 style="color: #00ff00; margin-bottom: 10px; border-bottom: 1px solid rgba(0, 255, 0, 0.3); padding-bottom: 5px;">预测结果</h3>
        `;

        if (collectedData.predictions && collectedData.predictions.length > 0) {
            html += `<div style="max-height: 300px; overflow-y: auto; padding-right: 5px;">`;

            collectedData.predictions.forEach((prediction, index) => {
                // 根据置信度设置颜色
                let confidenceColor = '#ff3333'; // 低置信度为红色
                if (prediction.confidence >= 70) {
                    confidenceColor = '#00ff00'; // 高置信度为绿色
                } else if (prediction.confidence >= 60) {
                    confidenceColor = '#ffcc00'; // 中等置信度为黄色
                }

                // 根据风险等级设置颜色
                let riskColor = '#ff3333'; // 高风险为红色
                if (prediction.riskLevel === 'low') {
                    riskColor = '#00ff00'; // 低风险为绿色
                } else if (prediction.riskLevel === 'medium') {
                    riskColor = '#ffcc00'; // 中等风险为黄色
                }

                html += `
                <div style="
                    margin-bottom: 15px;
                    padding: 10px;
                    background-color: rgba(20, 20, 30, 0.7);
                    border-radius: 5px;
                    border-left: 3px solid ${confidenceColor};
                ">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div style="font-weight: bold; color: #ffffff;">${prediction.teams[0]} VS ${prediction.teams[1]}</div>
                        <div style="font-weight: bold; color: ${confidenceColor};">置信度: ${prediction.confidence}%</div>
                    </div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div style="color: #00ccff;">预测获胜: <span style="color: #ffffff; font-weight: bold;">${prediction.prediction}</span></div>
                        <div style="color: #00ccff;">赔率: <span style="color: #ffcc00;">${prediction.odds}</span></div>
                    </div>

                    <div style="display: flex; justify-content: space-between;">
                        <div style="color: #aaaaaa;">风险等级: <span style="color: ${riskColor};">${prediction.riskLevel}</span></div>
                        ${prediction.riskFactors ? `<div style="color: #aaaaaa; font-size: 12px;">${prediction.riskFactors.join(', ')}</div>` : ''}
                    </div>
                </div>
                `;
            });

            html += `</div>`;
        } else {
            html += `<div style="color: #aaaaaa; text-align: center; padding: 20px; background-color: rgba(30, 30, 40, 0.5); border-radius: 5px;">
                暂无预测结果，请点击"分析比赛"按钮生成预测
            </div>`;
        }

        html += `</div>`;

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
        roundDialog.className = 'round-selection-dialog';
        roundDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(20, 20, 30, 0.95);
            color: white;
            z-index: 10002;
            border-radius: 8px;
            padding: 20px;
            font-family: Arial, sans-serif;
            min-width: 320px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(100, 100, 255, 0.3);
        `;

        // 生成局数选择按钮
        let roundButtons = '';
        for (let i = 1; i <= 5; i++) {
            roundButtons += `
                <button class="round-select-btn" data-round="${i}" style="
                    background-color: rgba(40, 40, 80, 0.8);
                    color: white;
                    border: 1px solid rgba(100, 100, 255, 0.3);
                    border-radius: 5px;
                    padding: 10px 15px;
                    margin: 5px;
                    cursor: pointer;
                    width: 60px;
                    text-align: center;
                    transition: all 0.2s ease;
                    font-weight: bold;
                ">${i}</button>
            `;
        }

        roundDialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #4488ff; text-align: center; font-size: 18px;">选择下注局数</h3>
            <div style="margin-bottom: 15px; background: rgba(30, 30, 50, 0.5); padding: 12px; border-radius: 6px;">
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">比赛:</strong> ${prediction.teams[0]} VS ${prediction.teams[1]}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">选择:</strong> ${prediction.prediction}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">赔率:</strong> ${prediction.odds}</div>
                <div><strong style="color: #aaccff;">置信度:</strong> ${prediction.confidence}%</div>
            </div>
            <div style="margin-bottom: 15px; text-align: center;">
                <div style="margin-bottom: 10px; color: #aaccff;">请选择要下注的局数:</div>
                <div style="display: flex; flex-wrap: wrap; justify-content: center;">
                    ${roundButtons}
                </div>
            </div>
            <div style="text-align: right;">
                <button id="cancel-round-select-btn" style="
                    background-color: rgba(170, 30, 30, 0.8);
                    color: white;
                    border: 1px solid rgba(255, 100, 100, 0.3);
                    border-radius: 5px;
                    padding: 8px 15px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                ">取消</button>
            </div>
        `;

        document.body.appendChild(roundDialog);

        // 添加局数选择按钮事件
        const roundBtns = roundDialog.querySelectorAll('.round-select-btn');
        roundBtns.forEach(btn => {
            btn.addEventListener('mouseover', function() {
                this.style.backgroundColor = 'rgba(60, 80, 170, 0.8)';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            });
            btn.addEventListener('mouseout', function() {
                this.style.backgroundColor = 'rgba(40, 40, 80, 0.8)';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
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

                // 切换到数据分析标签页
                const tabButtons = document.querySelectorAll('[data-tab-id]');
                tabButtons.forEach(tab => {
                    if (tab.dataset.tabId === 'analysis') {
                        tab.click();
                    }
                });
            });
        });

        // 添加取消按钮事件
        const cancelBtn = document.getElementById('cancel-round-select-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = 'rgba(200, 40, 40, 0.8)';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            });
            cancelBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = 'rgba(170, 30, 30, 0.8)';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
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

    // 分析单个比赛
    function analyzeMatch(match) {
        if (!match || !match.teams || match.teams.length < 2) {
            console.log('比赛数据不完整，无法分析');
            return;
        }

        console.log(`开始分析比赛: ${match.teams[0].name} vs ${match.teams[1].name}`);

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

                // 检查是否已存在相同比赛的预测，如果有则替换
                const existingIndex = collectedData.predictions.findIndex(p =>
                    p.teams && prediction.teams &&
                    p.teams[0] === prediction.teams[0] &&
                    p.teams[1] === prediction.teams[1]);

                if (existingIndex !== -1) {
                    collectedData.predictions[existingIndex] = prediction;
                } else {
                    collectedData.predictions.push(prediction);
                }

                // 对预测结果进行排序，置信度高的排在前面
                collectedData.predictions.sort((a, b) => b.confidence - a.confidence);

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

                console.log(`比赛分析完成: ${match.teams[0].name} vs ${match.teams[1].name}, 预测 ${prediction.prediction} 获胜，置信度 ${prediction.confidence}%`);
            } else {
                console.log(`比赛分析完成: ${match.teams[0].name} vs ${match.teams[1].name}, 无法生成预测`);
            }
        }
    }

    // 分析所有比赛数据
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

            analyzeMatch(match);
        });

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
            const isTeam1Streak = team1Stats.streakCount >= 3;
            const streakTeam = isTeam1Streak ? match.teams[0].name : match.teams[1].name;
            const streakType = isTeam1Streak ? team1Stats.streakType : team2Stats.streakType;
            const currentStreakCount = isTeam1Streak ? team1Stats.streakCount : team2Stats.streakCount;
            riskFactors.push(`${streakTeam}正处于${currentStreakCount}场连${streakType === 'win' ? '胜' : '负'}`);
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

            // 更新连胜/连败计数
            if (team1Stats.streakType === 'win') {
                team1Stats.streakCount++;
            } else {
                team1Stats.streakCount = 1;
                team1Stats.streakType = 'win';
            }

            if (team2Stats.streakType === 'loss') {
                team2Stats.streakCount++;
            } else {
                team2Stats.streakCount = 1;
                team2Stats.streakType = 'loss';
            }
        } else if (match.result.winner === team2.id) {
            team2Stats.wins++;
            team2Stats.recentForm.push(1);
            team1Stats.losses++;
            team1Stats.recentForm.push(0);

            // 更新连胜/连败计数
            if (team2Stats.streakType === 'win') {
                team2Stats.streakCount++;
            } else {
                team2Stats.streakCount = 1;
                team2Stats.streakType = 'win';
            }

            if (team1Stats.streakType === 'loss') {
                team1Stats.streakCount++;
            } else {
                team1Stats.streakCount = 1;
                team1Stats.streakType = 'loss';
            }
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

        // 计算总分，用于计算置信度
        const totalScore = team1Score + team2Score;

        if (team1Score > team2Score) {
            predictedWinner = team1.id;
            confidence = Math.round((team1Score / totalScore) * 100);
            reason = `${team1.name}最近表现更好(${Math.round(recentWinRateTeam1*100)}%胜率 vs ${Math.round(recentWinRateTeam2*100)}%)，总体胜率${Math.round(winRateTeam1*100)}%`;
        } else if (team2Score > team1Score) {
            predictedWinner = team2.id;
            confidence = Math.round((team2Score / totalScore) * 100);
            reason = `${team2.name}最近表现更好(${Math.round(recentWinRateTeam2*100)}%胜率 vs ${Math.round(recentWinRateTeam1*100)}%)，总体胜率${Math.round(winRateTeam2*100)}%`;
        } else {
            // 如果评分相等，比较最近的表现
            if (recentWinRateTeam1 > recentWinRateTeam2) {
                predictedWinner = team1.id;
                confidence = 55; // 略微倾向
                reason = `${team1.name}和${team2.name}整体实力相当，但${team1.name}最近状态略好(${Math.round(recentWinRateTeam1*100)}%胜率 vs ${Math.round(recentWinRateTeam2*100)}%)`;
            } else if (recentWinRateTeam2 > recentWinRateTeam1) {
                predictedWinner = team2.id;
                confidence = 55; // 略微倾向
                reason = `${team1.name}和${team2.name}整体实力相当，但${team2.name}最近状态略好(${Math.round(recentWinRateTeam2*100)}%胜率 vs ${Math.round(recentWinRateTeam1*100)}%)`;
            } else {
                // 如果最近表现也相等，比较总胜率
                if (winRateTeam1 >= winRateTeam2) {
                    predictedWinner = team1.id;
                    confidence = 51; // 非常接近
                    reason = `${team1.name}和${team2.name}实力非常接近，历史总胜率${Math.round(winRateTeam1*100)}% vs ${Math.round(winRateTeam2*100)}%`;
                } else {
                    predictedWinner = team2.id;
                    confidence = 51; // 非常接近
                    reason = `${team1.name}和${team2.name}实力非常接近，历史总胜率${Math.round(winRateTeam1*100)}% vs ${Math.round(winRateTeam2*100)}%`;
                }
            }
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
                <div style="text-align: center; padding: 30px; color: rgba(255, 255, 255, 0.7); background: rgba(30, 30, 50, 0.6); border-radius: 12px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); border: 1px solid rgba(100, 100, 255, 0.2); backdrop-filter: blur(5px);">
                    <div style="font-size: 50px; margin-bottom: 15px; opacity: 0.5;">📊</div>
                    <div style="font-size: 18px; margin-bottom: 15px; font-weight: 600; letter-spacing: 0.5px;">暂无下注记录</div>
                    <div style="font-size: 14px; line-height: 1.5; max-width: 300px; margin: 0 auto; color: rgba(255, 255, 255, 0.6);">您可以在比赛分析中选择手动下单或开启自动下单</div>
                    <button id="goto-analysis-btn" style="
                        margin-top: 20px;
                        background-color: rgba(60, 120, 220, 0.4);
                        color: white;
                        border: 1px solid rgba(100, 150, 255, 0.4);
                        border-radius: 6px;
                        padding: 8px 20px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                    ">前往分析页面</button>
                </div>
            `;

            // 添加前往分析页面按钮事件
            setTimeout(() => {
                const gotoAnalysisBtn = document.getElementById('goto-analysis-btn');
                if (gotoAnalysisBtn) {
                    // 点击事件
                    gotoAnalysisBtn.addEventListener('click', function() {
                        // 查找分析标签页并点击
                        const analysisTab = document.querySelector('[data-tab-id="analysis"]');
                        if (analysisTab) {
                            analysisTab.click();
                        }
                    });

                    // 悬停效果
                    gotoAnalysisBtn.addEventListener('mouseover', function() {
                        this.style.backgroundColor = 'rgba(80, 140, 240, 0.6)';
                        this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
                        this.style.transform = 'translateY(-2px)';
                    });

                    gotoAnalysisBtn.addEventListener('mouseout', function() {
                        this.style.backgroundColor = 'rgba(60, 120, 220, 0.4)';
                        this.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
                        this.style.transform = 'translateY(0)';
                    });
                }
            }, 100);

            return;
        }

        // 添加卡片容器样式
        const cardContainerStyle = document.createElement('style');
        cardContainerStyle.textContent = `
            .bet-card-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 18px;
                margin-bottom: 25px;
            }
            .bet-card {
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
                transition: all 0.3s ease;
                background: rgba(30, 30, 40, 0.7);
                backdrop-filter: blur(5px);
            }
            .bet-card:hover {
                transform: translateY(-5px) scale(1.02);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
            }
            .bet-card-header {
                padding: 12px 16px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
                letter-spacing: 0.5px;
            }
            .bet-card-body {
                padding: 16px;
                background: rgba(40, 40, 60, 0.4);
            }
            .bet-card-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 13px;
                align-items: center;
            }
            .bet-card-divider {
                height: 1px;
                background: rgba(255, 255, 255, 0.15);
                margin: 12px 0;
            }
            .bet-card-footer {
                padding: 10px 16px;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
                text-align: right;
                background: rgba(20, 20, 30, 0.5);
                letter-spacing: 0.5px;
            }
            .bet-amount {
                font-weight: bold;
                color: #ffdd44;
                font-size: 15px;
            }
            .bet-odds {
                font-weight: bold;
                color: #44aaff;
                font-size: 15px;
            }
            .bet-income {
                font-weight: bold;
                color: #ff9933;
                font-size: 15px;
            }
            .bet-team {
                font-weight: bold;
                color: #ffffff;
            }
            .bet-status-badge {
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }
            .bet-round-badge {
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 10px;
                background: rgba(60, 60, 100, 0.5);
                margin-left: 8px;
                letter-spacing: 0.5px;
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
        monitorSection.className = 'monitor-section';
        monitorSection.style.cssText = `
            margin-top: 25px;
            padding: 18px;
            background: rgba(30, 30, 50, 0.6);
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(100, 100, 255, 0.2);
            backdrop-filter: blur(5px);
        `;
        monitorSection.innerHTML = `
            <h4 style="margin: 0 0 12px 0; color: #66aaff; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">实时比赛监控</h4>
            <div style="font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-bottom: 15px; line-height: 1.5;">
                系统正在监控您下注的比赛，状态变化将自动更新
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 12px; color: rgba(255, 255, 255, 0.5); display: flex; align-items: center;">
                    <span style="margin-right: 5px;">⏱️</span> 上次更新: ${new Date().toLocaleTimeString()}
                </div>
                <button id="monitor-refresh-btn" style="
                    background-color: rgba(60, 120, 220, 0.4);
                    color: white;
                    border: 1px solid rgba(100, 150, 255, 0.4);
                    border-radius: 6px;
                    padding: 8px 15px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                "><span style="margin-right: 5px;">🔄</span> 立即刷新</button>
            </div>
        `;
        container.appendChild(monitorSection);

        // 添加刷新按钮事件和悬停效果
        const refreshBtn = monitorSection.querySelector('#monitor-refresh-btn');
        if (refreshBtn) {
            // 点击事件
            refreshBtn.addEventListener('click', function() {
                updateBettingDisplay();
                logToUI('已手动刷新比赛监控', 'info');

                // 添加点击动画效果
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 200);
            });

            // 悬停效果
            refreshBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = 'rgba(80, 140, 240, 0.6)';
                this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
                this.style.transform = 'translateY(-2px)';
            });

            refreshBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = 'rgba(60, 120, 220, 0.4)';
                this.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
                this.style.transform = 'translateY(0)';
            });
        }
    }

    // 提交下单到网站
    function submitBet(betRecord) {
        console.log('提交下单:', betRecord);
        logToUI('提交下单: ' + betRecord.selectedTeam + ' 金额: ' + betRecord.amount);

        // 1. 首先点击赔率元素
        const oddsElements = document.querySelectorAll('div.odds');
        let targetOdds = null;
        
        for (const odds of oddsElements) {
            const oddsText = (odds.textContent || '').toLowerCase();
            if (oddsText.includes(betRecord.selectedTeam.toLowerCase())) {
                targetOdds = odds;
                logToUI('找到匹配的赔率元素: ' + oddsText);
                break;
            }
        }
        
        if (!targetOdds && oddsElements.length > 0) {
            // 如果没找到匹配的，尝试使用第一个
            targetOdds = oddsElements[0];
            logToUI('未找到匹配的赔率元素，使用第一个可用的赔率元素');
        }
        
        if (targetOdds) {
            // 点击赔率元素
            targetOdds.click();
            logToUI('已点击赔率元素');
            console.log('已点击赔率元素:', targetOdds.textContent);
            
            // 2. 等待注单列表出现
            setTimeout(() => {
                // 查找注单详情元素
                const betItemElements = document.querySelectorAll('div.btItm');
                
                if (betItemElements.length > 0) {
                    logToUI('已找到注单详情元素');
                    console.log('找到注单详情元素数量:', betItemElements.length);
                    
                    // 3. 查找并填写金额输入框
                    setTimeout(() => {
                        // 优先使用#singleBet选择器
                        let amountInput = document.querySelector('#singleBet');
                        
                        // 如果没找到，尝试在btItm元素内查找输入框
                        if (!amountInput && betItemElements.length > 0) {
                            const inputs = betItemElements[0].querySelectorAll('input[type="number"], input[type="text"]');
                            if (inputs.length > 0) {
                                amountInput = inputs[0];
                                logToUI('在注单详情中找到金额输入框');
                            }
                        }
                        
                        // 如果仍然没找到，使用更广泛的选择器
                        if (!amountInput) {
                            const amountInputs = document.querySelectorAll(
                                'input[type="number"], input[type="text"], .bet-amount, [placeholder*="金额"], ' +
                                '[class*="amount"], [class*="stake"], [class*="bet"], input'
                            );
                            
                            // 尝试找到最匹配的金额输入框
                            for (const input of amountInputs) {
                                const placeholder = input.placeholder || '';
                                const name = input.name || '';
                                const id = input.id || '';
                                
                                if (placeholder.includes('金额') || placeholder.includes('amount') || 
                                    name.includes('amount') || name.includes('stake') || 
                                    id.includes('amount') || id.includes('stake')) {
                                    amountInput = input;
                                    logToUI('找到可能的金额输入框: ' + id);
                                    break;
                                }
                            }
                            
                            // 如果没找到特定的，使用第一个
                            if (!amountInput && amountInputs.length > 0) {
                                amountInput = amountInputs[0];
                                logToUI('使用第一个可用的输入框');
                            }
                        }
                        
                        if (amountInput) {
                            // 清空输入框
                            amountInput.value = '';
                            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // 设置新值
                            amountInput.value = betRecord.amount;
                            // 触发多种事件以确保值被正确更新
                            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                            amountInput.dispatchEvent(new Event('change', { bubbles: true }));
                            amountInput.dispatchEvent(new Event('blur', { bubbles: true }));
                            amountInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                            
                            console.log('已填写下单金额:', betRecord.amount);
                            logToUI('已填写下单金额: ' + betRecord.amount);
                            
                            // 4. 等待确认按钮激活并点击
                            setTimeout(() => {
                                // 首先查找特定的确认按钮（包括禁用状态的按钮）
                                let confirmBtn = document.querySelector('div.btBtn.disabled, div.btBtn');
                                
                                // 如果没找到，尝试在btItm元素内查找按钮
                                if (!confirmBtn && betItemElements.length > 0) {
                                    const buttons = betItemElements[0].querySelectorAll('button, div[role="button"]');
                                    if (buttons.length > 0) {
                                        confirmBtn = buttons[0];
                                        logToUI('在注单详情中找到确认按钮');
                                    }
                                }
                                
                                // 如果仍然没找到，使用更广泛的选择器
                                if (!confirmBtn) {
                                    const confirmButtons = document.querySelectorAll(
                                        '.confirm-bet, .submit-bet, [type="submit"], div.btBtn, ' +
                                        'button, [class*="confirm"], [class*="submit"], [class*="bet"], ' +
                                        '[class*="place"], [class*="ok"], [class*="yes"]'
                                    );
                                    
                                    if (confirmButtons.length > 0) {
                                        // 找到最可能的确认按钮
                                        for (const btn of confirmButtons) {
                                            const btnText = (btn.textContent || '').toLowerCase();
                                            if (btnText.includes('确认') || btnText.includes('提交') ||
                                                btnText.includes('下单') || btnText.includes('确定') ||
                                                btnText.includes('confirm') || btnText.includes('submit') ||
                                                btnText.includes('place bet') || btnText.includes('bet')) {
                                                confirmBtn = btn;
                                                logToUI('找到可能的确认按钮: ' + btnText);
                                                break;
                                            }
                                        }
                                        
                                        // 如果没找到特定的，使用第一个
                                        if (!confirmBtn) {
                                            confirmBtn = confirmButtons[0];
                                            logToUI('使用第一个可用的按钮作为确认按钮');
                                        }
                                    }
                                }
                                
                                if (confirmBtn) {
                                    // 如果按钮是禁用状态，尝试移除禁用类
                                    if (confirmBtn.classList && confirmBtn.classList.contains('disabled')) {
                                        logToUI('发现按钮处于禁用状态，尝试移除禁用类');
                                        confirmBtn.classList.remove('disabled');
                                    }
                                    
                                    // 如果按钮有disabled属性，移除它
                                    if (confirmBtn.hasAttribute('disabled')) {
                                        logToUI('发现按钮有disabled属性，尝试移除');
                                        confirmBtn.removeAttribute('disabled');
                                    }
                                    
                                    // 点击确认按钮
                                    confirmBtn.click();
                                    console.log('已点击确认下单按钮');
                                    logToUI('已点击确认下单按钮');
                                    
                                    betRecord.status = 'placed';
                                    saveData();
                                    updateBettingDisplay();
                                    
                                    // 监听下注结果
                                    setTimeout(() => {
                                        checkBetResult(betRecord);
                                    }, 2000);
                                } else {
                                    logToUI('未找到确认下单按钮，尝试按回车键提交', 'warning');
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
                                    }, 2000);
                                }
                            }, 1000); // 等待更长时间让按钮激活
                        } else {
                            logToUI('未找到金额输入框', 'error');
                            betRecord.status = 'failed';
                            betRecord.result = '未找到金额输入框';
                            saveData();
                            updateBettingDisplay();
                            
                            // 显示下注失败提示
                            showBetNotification('下注失败', '未找到金额输入框', 'error');
                        }
                    }, 1000); // 增加等待时间
                } else {
                    logToUI('未找到注单详情元素 div.btItm', 'error');
                    
                    // 尝试再次点击赔率元素
                    logToUI('尝试再次点击赔率元素', 'warning');
                    targetOdds.click();
                    
                    setTimeout(() => {
                        const retryBetItems = document.querySelectorAll('div.btItm');
                        if (retryBetItems.length > 0) {
                            logToUI('重试成功，找到注单详情元素');
                            // 递归调用自身，重新开始下注流程
                            submitBet(betRecord);
                        } else {
                            betRecord.status = 'failed';
                            betRecord.result = '未找到注单详情';
                            saveData();
                            updateBettingDisplay();
                            
                            // 显示下注失败提示
                            showBetNotification('下注失败', '未找到注单详情', 'error');
                        }
                    }, 1000);
                }
            }, 1000); // 增加等待时间
        } else {
            logToUI('未找到赔率元素 div.odds', 'error');
            betRecord.status = 'failed';
            betRecord.result = '未找到赔率元素';
            saveData();
            updateBettingDisplay();
            
            // 显示下注失败提示
            showBetNotification('下注失败', '未找到赔率元素', 'error');
        }
    }

    // 检查下注结果
    function checkBetResult(betRecord) {
        console.log('检查下注结果:', betRecord);
        logToUI('检查下注结果: ' + betRecord.selectedTeam);

        // 使用更全面的选择器查找成功或失败的提示信息
        const successElements = document.querySelectorAll(
            '.success-message, .bet-success, [class*="success"], [class*="confirm"], ' +
            '.message-success, .notification-success, .toast-success, ' +
            '.alert-success, .status-success, .result-success, ' +
            // 尝试使用jQuery风格的选择器，但在querySelectorAll中不起作用，仅作为注释保留
            // 'div:contains("下注成功"), div:contains("投注成功"), div:contains("已接受")'
            // 使用更通用的选择器
            '.betslip-success, .bet-notification, .bet-result, .bet-status'
        );

        const errorElements = document.querySelectorAll(
            '.error-message, .bet-error, [class*="error"], [class*="fail"], ' +
            '.message-error, .notification-error, .toast-error, ' +
            '.alert-error, .alert-danger, .status-error, .result-error, ' +
            // 尝试使用jQuery风格的选择器，但在querySelectorAll中不起作用，仅作为注释保留
            // 'div:contains("余额不足"), div:contains("下注失败"), div:contains("投注失败"), ' +
            // 'div:contains("错误"), div:contains("失败")'
            // 使用更通用的选择器
            '.betslip-error, .bet-notification-error, .bet-result-error, .bet-status-error'
        );

        // 检查DOM中的文本内容
        const pageText = document.body.textContent.toLowerCase();
        
        // 定义更全面的成功和失败关键词
        const successKeywords = [
            '下注成功', '投注成功', '已接受', '已确认', '已提交', '已完成',
            'bet accepted', 'bet confirmed', 'bet placed', 'bet successful',
            'success', 'confirmed', 'accepted', 'placed'
        ];
        
        const errorKeywords = [
            '余额不足', '下注失败', '投注失败', '错误', '失败', '拒绝', '取消',
            'insufficient balance', 'bet failed', 'bet rejected', 'bet cancelled',
            'error', 'failed', 'rejected', 'cancelled', 'denied'
        ];

        // 检查是否包含成功关键词
        const hasSuccessText = successKeywords.some(keyword => pageText.includes(keyword));
        
        // 检查是否包含失败关键词
        const hasErrorText = errorKeywords.some(keyword => pageText.includes(keyword));

        // 检查是否有通知元素
        const notifications = document.querySelectorAll(
            '.notification, .toast, .alert, .message, .popup, .modal, .dialog, ' +
            '.bet-notification, .betslip-notification, .bet-message, .bet-popup'
        );
        
        let notificationSuccess = false;
        let notificationError = false;
        let failReason = '未知原因';

        // 检查通知元素中的文本
        for (const notification of notifications) {
            if (!notification || !notification.textContent) continue;
            
            const notificationText = notification.textContent.toLowerCase();
            
            // 检查成功信息
            if (successKeywords.some(keyword => notificationText.includes(keyword))) {
                notificationSuccess = true;
            }
            
            // 检查失败信息
            if (errorKeywords.some(keyword => notificationText.includes(keyword))) {
                notificationError = true;
                
                // 尝试确定失败原因
                if (notificationText.includes('余额不足') || notificationText.includes('insufficient balance')) {
                    failReason = '余额不足';
                } else if (notificationText.includes('赔率变化') || notificationText.includes('odds changed')) {
                    failReason = '赔率已变化';
                } else if (notificationText.includes('已关闭') || notificationText.includes('closed')) {
                    failReason = '投注已关闭';
                } else if (notificationText.includes('限额') || notificationText.includes('limit')) {
                    failReason = '超出限额';
                } else if (notificationText.includes('风控') || notificationText.includes('risk')) {
                    failReason = '风控限制';
                }
            }
        }

        // 检查投注单元素
        const betSlips = document.querySelectorAll(
            '.bet-slip, .betslip, .bet-record, [class*="betslip"], [class*="bet-slip"], ' +
            '[class*="bet-record"], [class*="bet-list"]'
        );
        
        let foundInBetSlip = false;
        
        // 检查投注单中是否包含当前队伍信息
        for (const slip of betSlips) {
            if (!slip || !slip.textContent) continue;
            
            const slipText = slip.textContent.toLowerCase();
            if (slipText.includes(betRecord.selectedTeam.toLowerCase())) {
                foundInBetSlip = true;
                break;
            }
        }

        // 综合判断结果
        if (successElements.length > 0 || hasSuccessText || notificationSuccess || foundInBetSlip) {
            // 下注成功
            console.log('下注成功');
            logToUI(`下注成功: ${betRecord.selectedTeam} 金额: ${betRecord.amount}`, 'success');
            
            betRecord.status = 'success';
            betRecord.result = '下注成功';
            saveData();
            updateBettingDisplay();

            // 显示下注成功提示
            showBetNotification('下注成功', `已成功对 ${betRecord.selectedTeam} 下注 ${betRecord.amount}`, 'success');
            return;
        } 
        
        if (errorElements.length > 0 || hasErrorText || notificationError) {
            // 下注失败
            console.log('下注失败');
            logToUI(`下注失败: ${betRecord.selectedTeam}`, 'error');

            // 如果还没确定失败原因，尝试从页面文本中确定
            if (failReason === '未知原因') {
                if (pageText.includes('余额不足') || pageText.includes('insufficient balance')) {
                    failReason = '余额不足';
                } else if (pageText.includes('赔率变化') || pageText.includes('odds changed')) {
                    failReason = '赔率已变化';
                } else if (pageText.includes('已关闭') || pageText.includes('closed')) {
                    failReason = '投注已关闭';
                } else if (pageText.includes('限额') || pageText.includes('limit')) {
                    failReason = '超出限额';
                } else if (pageText.includes('风控') || pageText.includes('risk')) {
                    failReason = '风控限制';
                }
            }

            betRecord.status = 'failed';
            betRecord.result = `下注失败: ${failReason}`;
            saveData();
            updateBettingDisplay();

            // 显示下注失败提示
            showBetNotification('下注失败', failReason, 'error');
            logToUI(`下注失败: ${failReason}`, 'error');
            return;
        }

        // 无法确定结果，可能需要再次检查
        console.log('无法确定下注结果，将再次检查');
        logToUI('无法确定下注结果，将再次检查', 'warning');

        // 检查重试次数
        betRecord.checkCount = (betRecord.checkCount || 0) + 1;
        saveData();
        
        // 如果已经重试过多次，则标记为未知状态
        if (betRecord.checkCount >= 3) {
            betRecord.status = 'unknown';
            betRecord.result = '无法确定下注结果';
            saveData();
            updateBettingDisplay();

            // 显示未知结果提示
            showBetNotification('下注状态未知', '请手动检查下注是否成功', 'warning');
            logToUI(`下注状态未知，请手动检查 (已尝试 ${betRecord.checkCount} 次)`, 'warning');
        } else {
            // 再次检查
            logToUI(`将再次检查下注结果 (尝试 ${betRecord.checkCount}/3)`, 'info');
            setTimeout(() => {
                checkBetResult(betRecord);
            }, 1500);
        }
    }

    // 显示下注通知
    function showBetNotification(title, message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'bet-notification';

        // 根据类型设置样式
        let bgColor, borderColor, iconColor, icon;

        switch(type) {
            case 'success':
                bgColor = 'rgba(20, 120, 40, 0.95)';
                borderColor = 'rgba(100, 255, 100, 0.5)';
                iconColor = '#88ff88';
                icon = '✓';
                break;
            case 'error':
                bgColor = 'rgba(120, 30, 30, 0.95)';
                borderColor = 'rgba(255, 100, 100, 0.5)';
                iconColor = '#ff8888';
                icon = '✗';
                break;
            case 'warning':
                bgColor = 'rgba(120, 100, 20, 0.95)';
                borderColor = 'rgba(255, 200, 50, 0.5)';
                iconColor = '#ffcc44';
                icon = '⚠';
                break;
            default: // info
                bgColor = 'rgba(30, 30, 120, 0.95)';
                borderColor = 'rgba(100, 150, 255, 0.5)';
                iconColor = '#88aaff';
                icon = 'ℹ';
        }

        // 设置通知样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 320px;
            max-width: 420px;
            background-color: ${bgColor};
            color: white;
            border-radius: 10px;
            padding: 16px;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
            z-index: 10000;
            font-family: 'Segoe UI', Arial, sans-serif;
            border: 1px solid ${borderColor};
            animation: slideInRight 0.5s, fadeOut 0.5s 5s forwards;
            backdrop-filter: blur(5px);
        `;

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%) translateY(-10px); opacity: 0; }
                to { transform: translateX(0) translateY(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translateY(0); }
                to { opacity: 0; transform: translateY(-20px); }
            }
        `;
        document.head.appendChild(style);

        // 设置通知内容
        notification.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div style="font-size: 28px; margin-right: 16px; color: ${iconColor}; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: rgba(255, 255, 255, 0.1); border-radius: 50%;">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 6px; letter-spacing: 0.5px;">${title}</div>
                    <div style="font-size: 14px; opacity: 0.9; line-height: 1.4;">${message}</div>
                </div>
                <div class="close-btn" style="cursor: pointer; font-size: 18px; color: rgba(255, 255, 255, 0.7); margin-left: 10px; transition: color 0.2s ease;" onmouseover="this.style.color='white'" onmouseout="this.style.color='rgba(255, 255, 255, 0.7)'">×</div>
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

        // 添加关闭按钮功能
        const closeBtn = notification.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // 阻止事件冒泡
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }

        // 添加通知点击功能（可选择性关闭）
        notification.addEventListener('click', function(e) {
            // 如果点击的是关闭按钮，不执行任何操作（已由上面的事件处理）
            if (e.target.classList.contains('close-btn') || e.target.closest('.close-btn')) {
                return;
            }

            // 点击通知其他区域时关闭通知
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    // 显示下单确认对话框
    function showBetConfirmation(betRecord) {
        // 创建确认对话框
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'bet-confirmation-dialog';
        confirmDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(20, 20, 30, 0.95);
            color: white;
            z-index: 10002;
            border-radius: 8px;
            padding: 20px;
            font-family: Arial, sans-serif;
            min-width: 320px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(100, 100, 255, 0.3);
        `;

        // 获取比赛局数信息
        const matchRound = betRecord.matchRound || '第1局';

        confirmDialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #4488ff; text-align: center; font-size: 18px;">确认下单</h3>
            <div style="margin-bottom: 15px; background: rgba(30, 30, 50, 0.5); padding: 12px; border-radius: 6px;">
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">比赛:</strong> ${betRecord.teams[0]} VS ${betRecord.teams[1]}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">局数:</strong> ${matchRound}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">选择:</strong> ${betRecord.selectedTeam}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">固定赔率:</strong> ${betRecord.odds}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">下注金额:</strong> ${betRecord.amount}</div>
                <div style="margin-bottom: 8px;"><strong style="color: #aaccff;">预计收入:</strong> <span style="color: #ffcc00; font-weight: bold;">${betRecord.potentialWin}</span></div>
                <div><strong style="color: #aaccff;">置信度:</strong> <span style="color: ${betRecord.confidence > 70 ? '#00ff00' : betRecord.confidence > 50 ? '#ffcc00' : '#ff6666'}; font-weight: bold;">${betRecord.confidence}%</span></div>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <button id="confirm-bet-btn" style="
                    background-color: rgba(0, 120, 0, 0.8);
                    color: white;
                    border: 1px solid rgba(100, 255, 100, 0.3);
                    border-radius: 5px;
                    padding: 10px 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-weight: bold;
                ">确认下单</button>
                <button id="cancel-bet-btn" style="
                    background-color: rgba(170, 30, 30, 0.8);
                    color: white;
                    border: 1px solid rgba(255, 100, 100, 0.3);
                    border-radius: 5px;
                    padding: 10px 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-weight: bold;
                ">取消</button>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        // 添加确认按钮事件
        const confirmBtn = document.getElementById('confirm-bet-btn');
        confirmBtn.addEventListener('click', function() {
            submitBet(betRecord);
            document.body.removeChild(confirmDialog);
        });

        // 添加确认按钮悬停效果
        confirmBtn.addEventListener('mouseover', () => {
            confirmBtn.style.backgroundColor = 'rgba(0, 150, 0, 0.9)';
            confirmBtn.style.boxShadow = '0 0 10px rgba(100, 255, 100, 0.5)';
            confirmBtn.style.transform = 'translateY(-2px)';
        });
        confirmBtn.addEventListener('mouseout', () => {
            confirmBtn.style.backgroundColor = 'rgba(0, 120, 0, 0.8)';
            confirmBtn.style.boxShadow = 'none';
            confirmBtn.style.transform = 'translateY(0)';
        });

        // 添加取消按钮事件
        const cancelBtn = document.getElementById('cancel-bet-btn');
        cancelBtn.addEventListener('click', function() {
            betRecord.status = 'cancelled';
            saveData();
            document.body.removeChild(confirmDialog);
            updateUI();

            // 更新下注显示
            updateBettingDisplay();
        });

        // 添加取消按钮悬停效果
        cancelBtn.addEventListener('mouseover', () => {
            cancelBtn.style.backgroundColor = 'rgba(200, 40, 40, 0.9)';
            cancelBtn.style.boxShadow = '0 0 10px rgba(255, 100, 100, 0.5)';
            cancelBtn.style.transform = 'translateY(-2px)';
        });
        cancelBtn.addEventListener('mouseout', () => {
            cancelBtn.style.backgroundColor = 'rgba(170, 30, 30, 0.8)';
            cancelBtn.style.boxShadow = 'none';
            cancelBtn.style.transform = 'translateY(0)';
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



    // 启动脚本
    init();

})();
