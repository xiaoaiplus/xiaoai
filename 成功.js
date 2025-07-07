// ==UserScript==
// @name         电竞自动下注脚本
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  电竞网站自动下注脚本，可以自动选择比赛并下注，专注于odds元素的超强适应性赔率检测，修复金额验证问题，支持快速金额选择
// @author       AI助手
// @match        https://imes-0hloh.takatakz.xyz/esportsitev2/index.html*
// @match        *://*.takatakz.xyz/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .auto-bet-panel {
            position: fixed;
            top: 10px;
            left: 10px; /* 从右上角改为左上角 */
            background-color: #1e1e26;
            border: 1px solid #333;
            border-radius: 5px;
            padding: 10px;
            z-index: 9999;
            color: #e3e3e3;
            width: 300px;
            font-size: 14px;
            transition: all 0.3s ease; /* 添加过渡效果 */
        }
        .auto-bet-panel h3 {
            margin-top: 0;
            margin-bottom: 10px;
            text-align: center;
            color: #fff;
        }
        .auto-bet-panel label {
            display: block;
            margin-bottom: 5px;
        }
        .auto-bet-panel input, .auto-bet-panel select {
            width: 100%;
            padding: 5px;
            margin-bottom: 10px;
            background-color: #2a2a38;
            border: 1px solid #444;
            color: #e3e3e3;
            border-radius: 3px;
        }
        .auto-bet-panel button {
            width: 100%;
            padding: 8px;
            background-color: #4a4a5a;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-bottom: 5px;
        }
        .auto-bet-panel button:hover {
            background-color: #5a5a6a;
        }
        .auto-bet-panel .status {
            margin-top: 10px;
            padding: 5px;
            background-color: #2a2a38;
            border-radius: 3px;
            text-align: center;
        }
        .auto-bet-panel .close-btn {
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: #e3e3e3;
            cursor: pointer;
            width: auto;
            padding: 0;
            font-size: 16px;
        }
        /* 添加最小化样式 */
        .auto-bet-panel.minimized {
            width: 40px;
            height: 40px;
            overflow: hidden;
            padding: 0;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            background-color: #4a4a5a;
        }
        .auto-bet-panel.minimized::before {
            content: "+";
            font-size: 24px;
            color: white;
        }
        .auto-bet-panel.minimized > * {
            display: none;
        }
    `);

    // 等待页面加载完成
    function waitForPageLoad() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }

    // 等待元素出现
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素 ${selector} 超时`));
            }, timeout);
        });
    }

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.className = 'auto-bet-panel';
        panel.innerHTML = `
            <button class="close-btn">×</button>
            <h3>电竞自动下注</h3>
            <label for="bet-type">下注类型:</label>
            <select id="bet-type">
                <option value="single">单项</option>
                <option value="parlay">过关</option>
            </select>

            <label for="bet-mode">下注模式:</label>
            <select id="bet-mode">
                <option value="manual">手动选择</option>
                <option value="auto">自动选择</option>
            </select>

            <label for="bet-amount">下注金额:</label>
            <input type="number" id="bet-amount" value="10" min="1">

            <label for="bet-team">下注选项:</label>
            <select id="bet-team">
                <option value="home">主队/左边</option>
                <option value="away">客队/右边</option>
                <option value="random">随机选择</option>
            </select>

            <label for="bet-odds-min">最低赔率:</label>
            <input type="number" id="bet-odds-min" value="1.5" min="1" step="0.1">

            <label for="bet-odds-max">最高赔率:</label>
            <input type="number" id="bet-odds-max" value="3.0" min="1" step="0.1">

            <button id="start-auto-bet">开始自动下注</button>
            <button id="stop-auto-bet" disabled>停止自动下注</button>
            <button id="place-single-bet">立即下注一次</button>
            <button id="toggle-minimize">最小化</button>

            <div class="status" id="bet-status">准备就绪</div>
        `;
        document.body.appendChild(panel);

        // 关闭按钮事件
        panel.querySelector('.close-btn').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        // 最小化/展开按钮事件
        panel.querySelector('#toggle-minimize').addEventListener('click', () => {
            panel.classList.toggle('minimized');
            if (panel.classList.contains('minimized')) {
                GM_setValue('panelState', 'minimized');
            } else {
                GM_setValue('panelState', 'expanded');
            }
        });

        // 点击最小化面板时展开
        panel.addEventListener('click', (e) => {
            if (panel.classList.contains('minimized') && e.target === panel) {
                panel.classList.remove('minimized');
                GM_setValue('panelState', 'expanded');
            }
        });

        // 保存设置
        function saveSettings() {
            const settings = {
                betType: document.getElementById('bet-type').value,
                betMode: document.getElementById('bet-mode').value,
                betAmount: document.getElementById('bet-amount').value,
                betTeam: document.getElementById('bet-team').value,
                betOddsMin: document.getElementById('bet-odds-min').value,
                betOddsMax: document.getElementById('bet-odds-max').value
            };
            GM_setValue('autoBetSettings', settings);
        }

        // 加载设置
        function loadSettings() {
            const settings = GM_getValue('autoBetSettings');
            if (settings) {
                document.getElementById('bet-type').value = settings.betType || 'single';
                document.getElementById('bet-mode').value = settings.betMode || 'manual';
                document.getElementById('bet-amount').value = settings.betAmount || 10;
                document.getElementById('bet-team').value = settings.betTeam || 'home';
                document.getElementById('bet-odds-min').value = settings.betOddsMin || 1.5;
                document.getElementById('bet-odds-max').value = settings.betOddsMax || 3.0;
            }
        }

        // 保存设置事件
        document.getElementById('bet-type').addEventListener('change', saveSettings);
        document.getElementById('bet-mode').addEventListener('change', saveSettings);
        document.getElementById('bet-amount').addEventListener('input', saveSettings);
        document.getElementById('bet-team').addEventListener('change', saveSettings);
        document.getElementById('bet-odds-min').addEventListener('input', saveSettings);
        document.getElementById('bet-odds-max').addEventListener('input', saveSettings);

        // 加载保存的设置
        loadSettings();

        // 加载面板状态
        const panelState = GM_getValue('panelState', 'expanded');
        if (panelState === 'minimized') {
            panel.classList.add('minimized');
        } else if (panelState === 'hidden') {
            panel.style.display = 'none';
        }

        return panel;
    }

    // 更新状态
    function updateStatus(message) {
        const statusElement = document.getElementById('bet-status');
        if (statusElement) {
            statusElement.textContent = message;
            console.log('[自动下注]', message);
        }
    }

    // 调试日志函数
    function debugLog(message, data) {
        const isDebug = true; // 设置为false可以关闭调试输出
        if (isDebug) {
            if (data) {
                console.log(`[自动下注调试] ${message}`, data);
            } else {
                console.log(`[自动下注调试] ${message}`);
            }
        }
    }

    // 解析赔率
    function parseOdds(oddsText) {
        const odds = parseFloat(oddsText.trim());
        return isNaN(odds) ? 0 : odds;
    }

    // 获取元素的所有兄弟节点
    function getSiblings(element) {
        const siblings = [];
        let sibling = element.parentNode.firstChild;

        while (sibling) {
            if (sibling.nodeType === 1 && sibling !== element) {
                siblings.push(sibling);
            }
            sibling = sibling.nextSibling;
        }

        return siblings;
    }

    // 选择比赛
    function selectMatch() {
        const betType = document.getElementById('bet-type').value;
        const betTeam = document.getElementById('bet-team').value;
        const minOdds = parseFloat(document.getElementById('bet-odds-min').value);
        const maxOdds = parseFloat(document.getElementById('bet-odds-max').value);

        // 获取所有比赛
        let matches;
        if (betType === 'single') {
            // 单项比赛选择器 - 尝试多种可能的选择器
            matches = Array.from(document.querySelectorAll('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]')).filter(match => {
                // 排除已经开始的比赛
                return !match.textContent.includes('进行中') && !match.textContent.includes('live');
            });
        } else {
            // 过关比赛选择器 - 尝试多种可能的选择器
            matches = Array.from(document.querySelectorAll('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]')).filter(match => {
                return match.textContent.includes('过关盘口可用') ||
                       match.textContent.toLowerCase().includes('parlay') ||
                       match.textContent.toLowerCase().includes('combo');
            });
        }

        debugLog(`找到 ${matches.length} 个可能的比赛`);
        if (matches.length === 0) {
            // 尝试更宽泛的选择器
            const allPossibleMatches = document.querySelectorAll('div[class*="container"], div[class*="row"], div[class*="card"]');
            debugLog(`尝试更宽泛的选择器，找到 ${allPossibleMatches.length} 个可能的容器`);

            // 过滤出可能包含比赛信息的容器
            matches = Array.from(allPossibleMatches).filter(el => {
                const text = el.textContent.toLowerCase();
                return (text.includes('vs') || text.includes('对') || text.includes('vs.')) &&
                       /\d+\.\d+/.test(text); // 包含类似赔率的数字
            });

            debugLog(`过滤后找到 ${matches.length} 个可能的比赛`);
            if (matches.length === 0) {
                updateStatus('没有找到符合条件的比赛，请检查网站结构');
                return null;
            }
        }

        // 随机选择一场比赛
        const randomIndex = Math.floor(Math.random() * matches.length);
        const selectedMatch = matches[randomIndex];

        // 尝试多种可能的赔率元素选择器
        let oddsElements = [];

        debugLog('开始查找赔率元素');
        debugLog('选中的比赛内容', selectedMatch.textContent);

        // 方法1：尝试多种可能的赔率类名 - 增强对特定'odds'元素的支持
        const oddsSelectors = [
            // 精确匹配odds类名
            'div.odds',
            'span.odds',
            // 包含odds的类名
            'div[class*="odds"]',
            'span[class*="odds"]',
            // 包含odds的id
            'div[id*="odds"]',
            'span[id*="odds"]',
            // 包含odds的属性
            'div[data-odds]',
            'span[data-odds]',
            // 其他可能的赔率相关选择器
            'div[class*="rate"]',
            'div[class*="ratio"]',
            'span[class*="rate"]',
            'div[class*="price"]',
            'span[class*="price"]',
            'div[data-test*="odds"]',
            'div[data-test*="rate"]',
            'div[data-role*="odds"]'
        ];

        // 直接在整个文档中查找odds元素，然后过滤属于当前比赛的元素
        if (oddsElements.length < 2) {
            debugLog('尝试在整个文档中查找odds元素');
            const allOddsElements = document.querySelectorAll('.odds, [class*="odds"]');
            debugLog(`在整个文档中找到 ${allOddsElements.length} 个odds元素`);

            // 过滤出属于当前比赛的odds元素
            if (allOddsElements.length > 0) {
                oddsElements = Array.from(allOddsElements).filter(el => {
                    // 检查元素是否是当前比赛的子元素或与当前比赛有关联
                    return selectedMatch.contains(el) ||
                           // 检查元素是否与当前比赛在同一行或同一区域
                           (el.getBoundingClientRect().top >= selectedMatch.getBoundingClientRect().top &&
                            el.getBoundingClientRect().top <= selectedMatch.getBoundingClientRect().bottom);
                });

                debugLog(`过滤后找到 ${oddsElements.length} 个与当前比赛相关的odds元素`);
            }
        }

        for (const selector of oddsSelectors) {
            const elements = selectedMatch.querySelectorAll(selector);
            if (elements.length >= 2) {
                oddsElements = Array.from(elements);
                debugLog(`使用选择器 ${selector} 找到 ${elements.length} 个赔率元素`);
                break;
            }
        }

        // 方法2：如果方法1失败，尝试查找包含数字的元素（可能是赔率）
        if (oddsElements.length < 2) {
            debugLog('尝试方法2: 查找包含数字的元素');
            // 查找所有可能包含赔率的元素（通常是数字格式如1.5、2.0等）
            const possibleOddsElements = Array.from(selectedMatch.querySelectorAll('div, span, p, button, a')).filter(el => {
                const text = el.textContent.trim();
                // 匹配类似赔率的数字格式（如1.5、2.0等）
                const isOddsFormat = /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;

                // 检查元素是否有odds相关的类名、ID或属性
                const hasOddsClass = el.className && el.className.toLowerCase().includes('odds');
                const hasOddsId = el.id && el.id.toLowerCase().includes('odds');
                const hasOddsAttribute = el.hasAttribute('data-odds') ||
                                        el.hasAttribute('data-odd') ||
                                        el.hasAttribute('odds');

                // 如果元素有odds相关的标识，优先考虑
                if (hasOddsClass || hasOddsId || hasOddsAttribute) {
                    debugLog(`找到带有odds标识的元素: ${text}`);
                    return true;
                }

                return isOddsFormat;
            });

            debugLog(`方法2结果: 找到 ${possibleOddsElements.length} 个可能的赔率元素`,
                    possibleOddsElements.map(el => el.textContent));

            if (possibleOddsElements.length >= 2) {
                oddsElements = possibleOddsElements;
                debugLog('使用方法2找到的赔率元素');
            }
        }

        // 方法3：如果前两种方法都失败，尝试查找队伍旁边的数字元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法3: 查找队伍旁边的数字元素');
            // 找到队伍名称元素 - 尝试多种可能的选择器
            const teamSelectors = [
                'div[class*="team"]',
                'div[class*="competitor"]',
                'div[class*="player"]',
                'span[class*="team"]',
                'span[class*="competitor"]',
                'div[data-test*="team"]',
                'div[data-role*="team"]'
            ];

            let teamElements = [];
            for (const selector of teamSelectors) {
                const elements = selectedMatch.querySelectorAll(selector);
                if (elements.length >= 2) {
                    teamElements = Array.from(elements);
                    debugLog(`使用选择器 ${selector} 找到 ${elements.length} 个队伍元素`);
                    break;
                }
            }

            // 如果没有找到明确的队伍元素，尝试查找包含vs的元素
            if (teamElements.length < 2) {
                const vsContainer = Array.from(selectedMatch.querySelectorAll('div, span')).find(el =>
                    el.textContent.includes('vs') || el.textContent.includes('VS') || el.textContent.includes('对')
                );

                if (vsContainer) {
                    debugLog('找到包含vs的元素:', vsContainer.textContent);
                    // 查找vs元素的兄弟节点或子节点作为可能的队伍元素
                    teamElements = Array.from(vsContainer.querySelectorAll('*')).concat(getSiblings(vsContainer));
                }
            }

            debugLog(`找到 ${teamElements.length} 个可能的队伍元素`);

            if (teamElements.length >= 2) {
                // 查找队伍元素附近的数字元素
                teamElements.forEach((teamEl, index) => {
                    debugLog(`检查第 ${index+1} 个队伍元素: ${teamEl.textContent}`);

                    // 检查兄弟节点
                    const siblings = getSiblings(teamEl);
                    debugLog(`找到 ${siblings.length} 个兄弟节点`);

                    siblings.forEach(sib => {
                        // 检查是否有odds相关的类名或属性
                        const hasOddsClass = sib.className && sib.className.toLowerCase().includes('odds');
                        const hasOddsId = sib.id && sib.id.toLowerCase().includes('odds');
                        const hasOddsAttribute = sib.hasAttribute('data-odds') || sib.hasAttribute('odds');

                        // 检查文本是否是赔率格式
                        const text = sib.textContent.trim();
                        const isOddsFormat = /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;

                        if (hasOddsClass || hasOddsId || hasOddsAttribute || isOddsFormat) {
                            debugLog(`找到可能的赔率元素: ${text}`);
                            oddsElements.push(sib);
                        }
                    });

                    // 检查父元素的兄弟节点
                    if (teamEl.parentElement) {
                        const parentSiblings = getSiblings(teamEl.parentElement);
                        parentSiblings.forEach(sib => {
                            // 检查是否有odds相关的类名或属性
                            const hasOddsClass = sib.className && sib.className.toLowerCase().includes('odds');
                            const hasOddsId = sib.id && sib.id.toLowerCase().includes('odds');

                            if (hasOddsClass || hasOddsId) {
                                debugLog(`在父元素兄弟节点中找到odds元素: ${sib.textContent}`);
                                oddsElements.push(sib);
                                return;
                            }

                            const text = sib.textContent.trim();
                            if (/\d+\.\d+/.test(text)) {
                                // 查找包含数字的子元素
                                const numElements = Array.from(sib.querySelectorAll('*')).filter(el => {
                                    // 检查是否有odds相关的类名或属性
                                    const hasOddsClass = el.className && el.className.toLowerCase().includes('odds');
                                    const hasOddsId = el.id && el.id.toLowerCase().includes('odds');
                                    const hasOddsAttribute = el.hasAttribute('data-odds') || el.hasAttribute('odds');

                                    // 检查文本是否是赔率格式
                                    const text = el.textContent.trim();
                                    const isOddsFormat = /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;

                                    return hasOddsClass || hasOddsId || hasOddsAttribute || isOddsFormat;
                                });

                                if (numElements.length > 0) {
                                    debugLog(`在父元素兄弟节点中找到可能的赔率: ${numElements[0].textContent}`);
                                    oddsElements.push(numElements[0]);
                                }
                            }
                        });
                    }

                    // 检查整个比赛容器中是否有与队伍相关的odds元素
                    const teamRect = teamEl.getBoundingClientRect();
                    const allOddsInMatch = Array.from(selectedMatch.querySelectorAll('[class*="odds"], [id*="odds"], [data-odds]'));

                    allOddsInMatch.forEach(oddsEl => {
                        const oddsRect = oddsEl.getBoundingClientRect();
                        // 检查odds元素是否在队伍元素的同一行或附近
                        const isNearTeam = Math.abs(oddsRect.top - teamRect.top) < 50 || // 同一行或接近
                                          Math.abs(oddsRect.bottom - teamRect.bottom) < 50;

                        if (isNearTeam) {
                            debugLog(`找到与队伍在同一行的odds元素: ${oddsEl.textContent}`);
                            oddsElements.push(oddsEl);
                        }
                    });
                });
            }
        }

        // 方法3.5：尝试查找所有具有data-odds属性的元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法3.5: 查找具有data-odds属性的元素');
            const dataOddsElements = selectedMatch.querySelectorAll('[data-odds], [data-odd], [odds]');

            if (dataOddsElements.length >= 2) {
                oddsElements = Array.from(dataOddsElements);
                debugLog(`找到 ${oddsElements.length} 个具有data-odds属性的元素`);
            }
        }

        // 方法4：查找任何看起来像赔率的数字，并检查是否有odds相关的父元素或祖先元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法4: 查找任何看起来像赔率的数字，并检查odds相关元素');
            // 获取所有文本节点
            const walker = document.createTreeWalker(
                selectedMatch,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                // 匹配类似赔率的数字格式，并且值大于1.0
                if (/^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0) {
                    // 检查父元素或祖先元素是否有odds相关的类名或属性
                    let parent = node.parentNode;
                    let hasOddsAncestor = false;

                    // 向上检查5层祖先元素
                    for (let i = 0; i < 5 && parent; i++) {
                        if (parent.className && parent.className.toLowerCase().includes('odds') ||
                            parent.id && parent.id.toLowerCase().includes('odds') ||
                            parent.hasAttribute && (parent.hasAttribute('data-odds') || parent.hasAttribute('odds'))) {
                            hasOddsAncestor = true;
                            debugLog(`找到带有odds标识的祖先元素，包含赔率: ${text}`);
                            break;
                        }
                        parent = parent.parentNode;
                    }

                    // 如果有odds相关的祖先元素，优先添加
                    if (hasOddsAncestor) {
                        textNodes.unshift(node); // 放在数组前面，优先考虑
                    } else {
                        textNodes.push(node);
                    }

                    debugLog(`找到可能的赔率文本: ${text}`);
                }
            }

            // 如果找到至少两个可能的赔率文本节点
            if (textNodes.length >= 2) {
                // 将文本节点转换为它们的父元素
                oddsElements = textNodes.map(node => node.parentNode);
                debugLog('使用方法4找到的赔率元素');
            }
        }

        // 方法5：查找任何可点击的元素，其中包含数字，并检查是否有odds相关的类名或属性
        if (oddsElements.length < 2) {
            debugLog('尝试方法5: 查找可点击元素中的数字，并检查odds相关元素');
            const clickableElements = Array.from(selectedMatch.querySelectorAll('div[class*="button"], div[role="button"], button, a, div[class*="odds"], span[class*="odds"]'));

            const oddsButtons = clickableElements.filter(el => {
                // 检查是否有odds相关的类名或属性
                const hasOddsClass = el.className && el.className.toLowerCase().includes('odds');
                const hasOddsId = el.id && el.id.toLowerCase().includes('odds');
                const hasOddsAttribute = el.hasAttribute('data-odds') || el.hasAttribute('odds');

                // 如果有odds相关的标识，优先考虑
                if (hasOddsClass || hasOddsId || hasOddsAttribute) {
                    debugLog(`找到带有odds标识的可点击元素: ${el.textContent}`);
                    return true;
                }

                const text = el.textContent.trim();
                return /\d+\.\d+/.test(text) && parseFloat(text.match(/\d+\.\d+/)[0]) > 1.0;
            });

            debugLog(`方法5结果: 找到 ${oddsButtons.length} 个可能的赔率按钮`);
            if (oddsButtons.length >= 2) {
                oddsElements = oddsButtons;
            }
        }

        // 方法6：查找特定HTML结构中的odds元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法6: 查找特定HTML结构中的odds元素');

            // 尝试查找常见的赔率容器结构
            const oddsContainers = Array.from(selectedMatch.querySelectorAll('.odds-container, .bet-odds, .market-odds, [class*="odds-container"], [class*="bet-odds"], [class*="market-odds"]'));

            if (oddsContainers.length > 0) {
                debugLog(`找到 ${oddsContainers.length} 个可能的赔率容器`);

                // 从容器中提取赔率元素
                for (const container of oddsContainers) {
                    // 查找容器中的数字元素
                    const numElements = Array.from(container.querySelectorAll('*')).filter(el => {
                        const text = el.textContent.trim();
                        return /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;
                    });

                    if (numElements.length >= 2) {
                        oddsElements = numElements;
                        debugLog(`在赔率容器中找到 ${numElements.length} 个赔率元素`);
                        break;
                    }
                }
            }
        }

        debugLog(`最终找到 ${oddsElements.length} 个赔率元素`);
        if (oddsElements.length < 2) {
            // 显示比赛元素的HTML结构，帮助调试
            debugLog('比赛元素HTML结构', selectedMatch.outerHTML);
            updateStatus('无法找到赔率元素，请检查网站结构是否已更新');
            return null;
        }

        // 解析赔率
        const homeOdds = parseOdds(oddsElements[0].textContent);
        const awayOdds = parseOdds(oddsElements[1].textContent);

        // 根据设置选择队伍
        let selectedTeam, selectedOdds, teamIndex;
        if (betTeam === 'home' || (betTeam === 'random' && Math.random() < 0.5)) {
            selectedTeam = 'home';
            selectedOdds = homeOdds;
            teamIndex = 0;
        } else {
            selectedTeam = 'away';
            selectedOdds = awayOdds;
            teamIndex = 1;
        }

        // 检查赔率是否在范围内
        if (selectedOdds < minOdds || selectedOdds > maxOdds) {
            updateStatus(`赔率 ${selectedOdds} 不在设定范围内 (${minOdds}-${maxOdds})`);
            return null;
        }

        return {
            match: selectedMatch,
            team: selectedTeam,
            odds: selectedOdds,
            element: oddsElements[teamIndex]
        };
    }

    // 设置下注金额
    async function setBetAmount(amount) {
        debugLog('尝试查找下注金额输入框');

        // 验证金额是否有效
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            updateStatus('下注金额无效，请输入有效的金额');
            debugLog(`无效的下注金额: ${amount}`);
            return false;
        }

        // 尝试多种可能的选择器
        let amountInput = null;

        // 方法0：使用用户指定的特定选择器
        amountInput = document.querySelector('#singleBet, .btQuickA, input#singleBet, input.btQuickA');
        debugLog(`方法0结果: ${amountInput ? '找到' : '未找到'}用户指定的下注金额输入框`);

        // 方法1：使用原有的选择器
        if (!amountInput) {
            amountInput = document.querySelector('input[class*="amount"]');
            debugLog(`方法1结果: ${amountInput ? '找到' : '未找到'}下注金额输入框`);
        }

        // 方法2：尝试查找任何数字输入框
        if (!amountInput) {
            const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]'));
            debugLog(`找到 ${inputs.length} 个可能的输入框`);

            // 查找可能的金额输入框
            amountInput = inputs.find(input => {
                // 检查输入框的属性和周围元素
                const hasAmountClass = input.className.toLowerCase().includes('amount');
                const hasAmountId = input.id.toLowerCase().includes('amount');
                const hasAmountPlaceholder = input.placeholder && input.placeholder.toLowerCase().includes('金额');
                const parentText = input.parentElement ? input.parentElement.textContent.toLowerCase() : '';
                const hasAmountParentText = parentText.includes('金额') || parentText.includes('金') || parentText.includes('额');

                return hasAmountClass || hasAmountId || hasAmountPlaceholder || hasAmountParentText;
            });

            debugLog(`方法2结果: ${amountInput ? '找到' : '未找到'}可能的下注金额输入框`);
        }

        // 方法3：查找下注面板中的输入框
        if (!amountInput) {
            // 查找可能的下注面板
            const betPanels = Array.from(document.querySelectorAll('div[class*="bet"], div[class*="slip"], div[class*="ticket"]'));
            debugLog(`找到 ${betPanels.length} 个可能的下注面板`);

            for (const panel of betPanels) {
                const inputs = panel.querySelectorAll('input');
                if (inputs.length > 0) {
                    // 假设第一个输入框是金额输入框
                    amountInput = inputs[0];
                    debugLog(`在下注面板中找到输入框: ${amountInput.outerHTML}`);
                    break;
                }
            }
        }

        // 方法4：查找任何可能的输入框
        if (!amountInput) {
            const allInputs = Array.from(document.querySelectorAll('input'));
            debugLog(`找到 ${allInputs.length} 个输入框元素`);

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

                debugLog(`方法4结果: 使用可见输入框 ${amountInput.outerHTML}`);
            }
        }

        // 方法5：查找可能在iframe中的输入框
        if (!amountInput) {
            const iframes = document.querySelectorAll('iframe');
            debugLog(`找到 ${iframes.length} 个iframe元素`);

            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const iframeInputs = iframeDoc.querySelectorAll('input[type="number"], input[type="text"]');

                    if (iframeInputs.length > 0) {
                        amountInput = iframeInputs[0];
                        debugLog(`在iframe中找到输入框: ${amountInput.outerHTML}`);
                        break;
                    }
                } catch (e) {
                    debugLog(`无法访问iframe内容: ${e.message}`);
                }
            }
        }

        // 如果仍然找不到，记录页面结构以便调试
        if (!amountInput) {
            debugLog('无法找到下注金额输入框，记录页面结构以便调试');
            const betSlip = document.querySelector('div[class*="bet"], div[class*="slip"], div[class*="ticket"]');
            if (betSlip) {
                debugLog('下注面板HTML结构', betSlip.outerHTML);
            } else {
                debugLog('无法找到下注面板');
            }

            updateStatus('找不到下注金额输入框，请检查网站结构是否已更新');
            return false;
        }

        // 设置金额
        debugLog(`找到下注金额输入框，设置金额: ${amount}`);

        try {
            // 先点击输入框以激活它
            // 模拟完整的鼠标点击事件序列
            amountInput.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            amountInput.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
            amountInput.click();
            // 等待一小段时间确保点击事件被处理
            await new Promise(resolve => setTimeout(resolve, 100));
            // 再聚焦输入框
            amountInput.focus();
            // 再次触发点击事件以确保激活
            amountInput.click();

            // 先清空输入框
            amountInput.value = '';
            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            // 短暂延迟确保清空操作完成
            await new Promise(resolve => setTimeout(resolve, 50));

            // 再次确认输入框处于激活状态
            amountInput.focus();
            amountInput.click();

            // 模拟逐个输入数字
            const amountStr = amount.toString();
            for (let i = 0; i < amountStr.length; i++) {
                amountInput.value += amountStr[i];
                // 触发多种事件，确保输入被识别
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: amountStr[i], code: `Digit${amountStr[i]}`, keyCode: 48 + parseInt(amountStr[i]), bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: amountStr[i], code: `Digit${amountStr[i]}`, keyCode: 48 + parseInt(amountStr[i]), bubbles: true }));
                // 短暂延迟，模拟真实输入
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // 触发多种事件，确保金额被正确识别
            amountInput.dispatchEvent(new Event('change', { bubbles: true }));
            amountInput.dispatchEvent(new Event('blur', { bubbles: true }));

            // 再次聚焦并按下回车键，有些网站需要这样确认输入
            amountInput.focus();
            amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

            // 验证金额是否已设置
            if (!amountInput.value || amountInput.value === '0' || amountInput.value === '') {
                debugLog('常规输入方法失败，尝试其他方法设置金额');

                // 方法1：尝试直接设置value属性
                amountInput.value = amount;
                amountInput.setAttribute('value', amount);
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new Event('change', { bubbles: true }));

                // 方法2：尝试使用execCommand
                try {
                    amountInput.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, amount);
                } catch (e) {
                    debugLog(`execCommand方法失败: ${e.message}`);
                }

                // 方法3：尝试使用剪贴板API
                try {
                    const tempInput = document.createElement('input');
                    tempInput.value = amount;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);

                    amountInput.focus();
                    document.execCommand('paste');
                } catch (e) {
                    debugLog(`剪贴板方法失败: ${e.message}`);
                }

                // 方法4：尝试模拟Tab键和回车键
                amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true }));
                amountInput.focus();
                amountInput.value = amount;
                amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            }

            // 最终验证
            if (!amountInput.value || amountInput.value === '0' || amountInput.value === '') {
                updateStatus('下注金额设置失败，请手动输入金额');
                debugLog('下注金额设置失败');
                return false;
            }

            debugLog(`金额已成功设置为: ${amountInput.value}`);
            return true;
        } catch (error) {
            debugLog(`设置金额时出错: ${error.message}`);
            updateStatus('设置金额时出错，请手动输入');
            return false;
        }
    }

    // 关闭成功提示框
    async function closeSuccessPopup() {
        debugLog('检查是否出现成功提示框');
        try {
            // 等待成功提示框出现
            for (let i = 0; i < 10; i++) { // 尝试10次，每次等待200ms
                // 尝试多种可能的选择器
                const successPopup = document.querySelector('.btBtn.btBtn3, div.btBtn.btBtn3, button.btBtn.btBtn3, .btBtn3, [class*="btBtn3"]');
                if (successPopup) {
                    debugLog(`找到成功提示框，点击关闭按钮: ${successPopup.outerHTML}`);
                    // 模拟完整的点击事件
                    successPopup.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    successPopup.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                    successPopup.click();
                    await new Promise(resolve => setTimeout(resolve, 300)); // 等待关闭动画完成
                    return true;
                }

                // 尝试查找其他可能的成功提示框
                const otherPopups = document.querySelectorAll('div[class*="popup"], div[class*="modal"], div[class*="dialog"], div[class*="message"]');
                for (const popup of otherPopups) {
                    // 检查是否包含关闭按钮或确认按钮
                    const closeButtons = popup.querySelectorAll('button, div[role="button"], div[class*="close"], div[class*="confirm"], div[class*="ok"]');
                    if (closeButtons.length > 0) {
                        debugLog(`找到可能的提示框，点击关闭按钮: ${closeButtons[0].outerHTML}`);
                        closeButtons[0].click();
                        await new Promise(resolve => setTimeout(resolve, 300));
                        return true;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }
            return false;
        } catch (error) {
            debugLog(`关闭成功提示框时出错: ${error.message}`);
            return false;
        }
    }

    // 确认下注
    async function confirmBet() {
        debugLog('尝试查找确认下注按钮');

        // 尝试多种可能的选择器
        let confirmButton = null;

        // 方法0：使用用户提供的选择器
        confirmButton = document.querySelector('div.btBtn.disabled, div.btBtn:not(.disabled)');
        if (confirmButton) {
            debugLog(`找到用户提供的确认下注按钮: ${confirmButton.outerHTML}`);

            // 检查按钮是否真的被禁用
            if (confirmButton.classList.contains('disabled')) {
                // 尝试移除disabled类以启用按钮
                debugLog('尝试移除disabled类以启用按钮');
                confirmButton.classList.remove('disabled');
            }
        }

        // 方法1：使用原有的选择器
        if (!confirmButton) {
            confirmButton = document.querySelector('div[class*="confirm"]');
            debugLog(`方法1结果: ${confirmButton ? '找到' : '未找到'}确认下注按钮`);
        }

        // 方法2：查找可能的确认按钮
        if (!confirmButton) {
            // 查找包含"确认"、"下注"等文本的按钮或可点击元素
            const possibleButtons = Array.from(document.querySelectorAll('button, div[role="button"], div[class*="button"], a[class*="button"]'));
            debugLog(`找到 ${possibleButtons.length} 个可能的按钮元素`);

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

            debugLog(`方法2结果: ${confirmButton ? '找到' : '未找到'}可能的确认下注按钮`);
        }

        // 方法3：查找下注面板中的最后一个按钮
        if (!confirmButton) {
            // 查找可能的下注面板
            const betPanels = Array.from(document.querySelectorAll('div[class*="bet"], div[class*="slip"], div[class*="ticket"]'));

            for (const panel of betPanels) {
                // 查找面板中的所有按钮
                const buttons = Array.from(panel.querySelectorAll('button, div[role="button"], div[class*="button"], a[class*="button"]'));

                if (buttons.length > 0) {
                    // 假设最后一个按钮是确认下注按钮
                    confirmButton = buttons[buttons.length - 1];
                    debugLog(`在下注面板中找到可能的确认按钮: ${confirmButton.outerHTML}`);
                    break;
                }
            }
        }

        // 如果仍然找不到，记录页面结构以便调试
        if (!confirmButton) {
            debugLog('无法找到确认下注按钮，记录页面结构以便调试');
            const betSlip = document.querySelector('div[class*="bet"], div[class*="slip"], div[class*="ticket"]');
            if (betSlip) {
                debugLog('下注面板HTML结构', betSlip.outerHTML);
            } else {
                debugLog('无法找到下注面板');
            }

            updateStatus('找不到确认下注按钮，请检查网站结构是否已更新');
            return false;
        }

        // 检查金额输入框是否有值
        const amountInput = document.querySelector('input[class*="amount"]');
        if (amountInput && (!amountInput.value || amountInput.value === '0' || amountInput.value === '')) {
            updateStatus('请先输入下注金额');
            debugLog('金额输入框为空');
            return false;
        }

        // 点击确认按钮
        debugLog('点击确认下注按钮');
        confirmButton.click();

        // 等待一段时间，确保下注操作完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 检查是否出现成功提示框并关闭
        await closeSuccessPopup();

        return true;
    }

    // 执行单次下注
    async function placeSingleBet() {
        updateStatus('开始下注...');

        // 选择比赛
        const selection = selectMatch();
        if (!selection) {
            return false;
        }

        updateStatus(`已选择比赛，赔率: ${selection.odds}`);

        // 点击选择的队伍
        selection.element.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 获取下注金额
        const amount = document.getElementById('bet-amount').value;
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            updateStatus('请输入有效的下注金额');
            return false;
        }

        // 直接使用setBetAmount设置下注金额
        debugLog('使用setBetAmount设置下注金额');
        if (!await setBetAmount(amount)) {
            updateStatus('设置下注金额失败');
            return false;
        }

        updateStatus(`已设置下注金额: ${amount}`);
        await new Promise(resolve => setTimeout(resolve, 500));

        // 确认下注
        if (!await confirmBet()) {
            return false;
        }

        updateStatus('下注成功!');

        // 再次检查并关闭可能出现的成功提示框
        await closeSuccessPopup();

        return true;
    }

    // 自动下注循环
    let autoBetInterval = null;

    function startAutoBet() {
        const interval = 30000; // 30秒下注一次
        updateStatus('自动下注已启动');

        document.getElementById('start-auto-bet').disabled = true;
        document.getElementById('stop-auto-bet').disabled = false;

        // 立即执行一次
        placeSingleBet();

        // 设置定时器
        autoBetInterval = setInterval(async () => {
            await placeSingleBet();
        }, interval);
    }

    function stopAutoBet() {
        if (autoBetInterval) {
            clearInterval(autoBetInterval);
            autoBetInterval = null;

            document.getElementById('start-auto-bet').disabled = false;
            document.getElementById('stop-auto-bet').disabled = true;
            updateStatus('自动下注已停止');
        }
    }

    // 主函数
    async function main() {
        await waitForPageLoad();

        // 创建控制面板
        const panel = createControlPanel();

        // 绑定按钮事件
        document.getElementById('start-auto-bet').addEventListener('click', startAutoBet);
        document.getElementById('stop-auto-bet').addEventListener('click', stopAutoBet);
        document.getElementById('place-single-bet').addEventListener('click', placeSingleBet);

        // 添加快捷键
        document.addEventListener('keydown', (e) => {
            // Alt+B 显示/隐藏面板
            if (e.altKey && e.key === 'b') {
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    panel.classList.remove('minimized');
                    GM_setValue('panelState', 'expanded');
                } else {
                    panel.style.display = 'none';
                    GM_setValue('panelState', 'hidden');
                }
            }
            // Alt+S 开始/停止自动下注
            if (e.altKey && e.key === 's') {
                if (autoBetInterval) {
                    stopAutoBet();
                } else {
                    startAutoBet();
                }
            }
            // Alt+M 最小化/展开面板
            if (e.altKey && e.key === 'm') {
                if (panel.style.display !== 'none') {
                    panel.classList.toggle('minimized');
                    GM_setValue('panelState', panel.classList.contains('minimized') ? 'minimized' : 'expanded');
                }
            }
        });

        updateStatus('脚本已加载，按Alt+B显示/隐藏面板');
    }

    // 启动脚本
    main().catch(err => {
        console.error('[自动下注] 错误:', err);
        updateStatus(`错误: ${err.message}`);
    });

})();
