// ==UserScript==
// @name         电竞今日比赛数据采集器
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
    
    // 默认设置
    let userSettings = {
        refreshInterval: 20, // 默认20秒刷新一次赔率
    };

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
            right: 20px;
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
            matchesPopup.style.display = 'none';
        };
        header.appendChild(closeBtn);

        // 添加刷新按钮
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '刷新';
        refreshBtn.style.cssText = `
            background-color: rgba(25, 118, 210, 0.7);
            color: white;
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            margin-right: 10px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            box-shadow: 0 0 5px rgba(25, 118, 210, 0.2);
        `;
        refreshBtn.onmouseover = function() {
            this.style.backgroundColor = 'rgba(25, 118, 210, 0.9)';
            this.style.transform = 'scale(1.05)';
        };
        refreshBtn.onmouseout = function() {
            this.style.backgroundColor = 'rgba(25, 118, 210, 0.7)';
            this.style.transform = 'scale(1)';
        };
        refreshBtn.onclick = function() {
            updateTodayMatchesInPopup();
        };
        header.appendChild(refreshBtn);
        
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

    // 在弹窗中更新今日比赛数据
    function updateTodayMatchesInPopup() {
        const matchesContainer = document.getElementById('today-matches-container');
        const updateTimeDisplay = document.getElementById('last-update-time');
        if (!matchesContainer || !updateTimeDisplay) return;
    
        // 更新最后更新时间
        const now = new Date();
        updateTimeDisplay.textContent = `最后更新: ${now.toLocaleTimeString()}`;
        collectedData.lastUpdate = now;
    
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
    }

    // 从DOM元素中提取比赛信息
    function extractMatchesFromDOM() {
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
        console.log(`找到 ${matchTimerElements.length} 个进行中比赛, ${matchStatusElements.length} 个即将开始比赛, ${matchDateTimeElements.length} 个未开始比赛`);
        console.log(`找到 ${leagueNameElements.length} 个比赛类型/联赛名称元素`);

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
        
        // 根据用户设置的刷新间隔从DOM提取比赛数据
        const refreshMs = userSettings.refreshInterval * 1000;
        window.domExtractInterval = setInterval(function() {
            extractMatchesFromDOM();
            console.log(`根据设置的${userSettings.refreshInterval}秒间隔刷新数据`);
        }, refreshMs);

        // 每5分钟保存一次数据
        window.dataSaveInterval = setInterval(function() {
            saveData();
        }, 300000);
    }

    // 初始化函数
    function init() {
        // 初始化空的比赛数据
        collectedData = {
            matches: [],
            lastUpdate: new Date()
        };
        
        // 只加载用户设置
        loadSettings();

        // 不再拦截WebSocket和XHR请求，只使用DOM提取的数据
        // interceptWebSocket();
        // interceptXHR();

        // 等待DOM加载完成
        window.addEventListener('load', function() {
            // 创建比赛数据弹窗
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
            `;
            document.head.appendChild(fadeStyle);
        });
    }

    // 启动脚本
    init();

})();
