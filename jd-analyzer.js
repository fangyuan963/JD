// 应用状态
const state = {
    currentJD: '',
    isAnalyzing: false,
    analysisResults: {}
};

// API配置
const API_CONFIG = {
    baseURL: '',
    timeout: 60000
};

// DOM 元素
const elements = {
    jdInput: document.getElementById('jdInput'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    copyBtn: document.getElementById('copyBtn'),
    loading: document.getElementById('loading'),
    analysisTime: document.getElementById('analysisTime'),
    result1: document.getElementById('result1'),
    result2: document.getElementById('result2'),
    result3: document.getElementById('result3'),
    result4: document.getElementById('result4'),
    result5: document.getElementById('result5'),
    result6: document.getElementById('result6')
};

// 初始化
function initApp() {
    setupEventListeners();
    updateButtonStates();
    checkServerStatus();
}

// 检查服务器状态
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/health`);
        if (response.ok) {
            console.log('✅ 服务器连接正常');
        }
    } catch (error) {
        console.warn('⚠️ 服务器未启动，请先启动后端服务器');
    }
}

// 设置事件监听器
function setupEventListeners() {
    elements.jdInput.addEventListener('input', () => {
        state.currentJD = elements.jdInput.value.trim();
        updateButtonStates();
    });

    elements.analyzeBtn.addEventListener('click', startAnalysis);
    elements.clearBtn.addEventListener('click', clearInput);
    elements.copyBtn.addEventListener('click', copyResults);
}

// 更新按钮状态
function updateButtonStates() {
    const hasJD = state.currentJD.length > 0;
    elements.analyzeBtn.disabled = !hasJD || state.isAnalyzing;
}

// 开始解析
async function startAnalysis() {
    if (!state.currentJD) {
        showToast('请输入JD内容');
        return;
    }

    state.isAnalyzing = true;
    updateButtonStates();
    showLoading();

    try {
        const startTime = Date.now();

        // 调用后端API
        const result = await callDeepSeekAPI(state.currentJD);
        
        state.analysisResults = result;

        const endTime = Date.now();
        const analysisTime = ((endTime - startTime) / 1000).toFixed(1);
        elements.analysisTime.textContent = analysisTime;

        // 显示结果
        displayResults(result);
        showToast('解析完成');

    } catch (error) {
        console.error('解析失败:', error);
        
        // 显示错误信息
        let errorMessage = '解析失败';
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = '无法连接到服务器，请确保后端服务器已启动';
        } else if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查.env文件配置';
        } else if (error.message.includes('429')) {
            errorMessage = '请求过于频繁，请稍后再试';
        } else if (error.message.includes('timeout')) {
            errorMessage = '请求超时，请检查网络连接';
        } else {
            errorMessage = error.message;
        }
        
        showToast(errorMessage);
        
        // 显示错误到结果区域
        displayError(errorMessage);
        
    } finally {
        state.isAnalyzing = false;
        hideLoading();
        updateButtonStates();
    }
}

// 调用DeepSeek API（通过后端）
async function callDeepSeekAPI(jd) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    try {
        const response = await fetch(`api/analyze-jd`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jd }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || '解析失败');
        }

        return data.data;

    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('请求超时');
        }
        throw error;
    }
}

// 显示结果
function displayResults(results) {
    // 1. 一句话看懂
    elements.result1.querySelector('.card-content').innerHTML = `
        <div class="result-text">${results.summary || '暂无数据'}</div>
    `;

    // 2. 要你做的3件事
    const tasks = results.tasks && results.tasks.length > 0 
        ? results.tasks 
        : ['暂无数据'];
    elements.result2.querySelector('.card-content').innerHTML = `
        <ul class="result-list">
            ${tasks.map(task => `<li>${task}</li>`).join('')}
        </ul>
    `;

    // 3. 硬门槛/可培养/加分项
    const requirements = results.requirements || {};
    
    // 硬门槛分类显示
    const requiredItems = requirements.required && requirements.required.length > 0 
        ? requirements.required 
        : ['暂无数据'];
    
    elements.result3.querySelector('.card-content').innerHTML = `
        <div class="result-text">
            <div style="margin-bottom: 1.5rem;">
                <strong style="color: #dc2626; font-size: 1.1rem; display: block; margin-bottom: 0.75rem;">🚫 硬门槛（必须满足）：</strong>
                <div style="background: #fef2f2; border-radius: 0.5rem; padding: 1rem; border-left: 4px solid #dc2626;">
                    ${requiredItems.map(item => {
                        // 检查是否是分类标题
                        if (item.includes('：') || item.match(/^[\d一二三四五六七八九十]/) || item.includes('要求') || item.includes('JD中')) {
                            return `<div style="font-weight: 600; color: #991b1b; margin: 0.75rem 0 0.5rem 0; padding-top: 0.5rem; border-top: 1px solid #fecaca;">${item}</div>`;
                        }
                        return `<div style="margin: 0.5rem 0; padding-left: 1rem; color: #7f1d1d; line-height: 1.6;">• ${item}</div>`;
                    }).join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <strong style="color: #2563eb; font-size: 1.1rem; display: block; margin-bottom: 0.75rem;">📚 可培养（入职后学习）：</strong>
                <div style="background: #eff6ff; border-radius: 0.5rem; padding: 1rem; border-left: 4px solid #2563eb;">
                    ${(requirements.trainable && requirements.trainable.length > 0 
                        ? requirements.trainable 
                        : ['暂无数据']).map(item => `<div style="margin: 0.5rem 0; padding-left: 1rem; color: #1e40af; line-height: 1.6;">• ${item}</div>`).join('')}
                </div>
            </div>
            
            <div>
                <strong style="color: #059669; font-size: 1.1rem; display: block; margin-bottom: 0.75rem;">✨ 加分项（优先考虑）：</strong>
                <div style="background: #f0fdf4; border-radius: 0.5rem; padding: 1rem; border-left: 4px solid #059669;">
                    ${(requirements.bonus && requirements.bonus.length > 0 
                        ? requirements.bonus 
                        : ['暂无数据']).map(item => `<div style="margin: 0.5rem 0; padding-left: 1rem; color: #166534; line-height: 1.6;">• ${item}</div>`).join('')}
                </div>
            </div>
        </div>
    `;

    // 4. 翻译 + 例子
    const translations = results.translation && results.translation.translations && results.translation.translations.length > 0
        ? results.translation.translations
        : [{ term: '暂无数据', explanation: '', example: '' }];
    elements.result4.querySelector('.card-content').innerHTML = `
        <div class="result-text">
            ${translations.map(item => `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; border-left: 4px solid #7c3aed;">
                    <div style="margin-bottom: 0.5rem;">
                        <strong style="color: #dc2626; font-size: 0.875rem;">📝 原文句子：</strong>
                        <div style="color: #1e293b; margin-top: 0.25rem; line-height: 1.6;">${item.term || '暂无数据'}</div>
                    </div>
                    ${item.explanation ? `
                    <div style="margin-bottom: 0.5rem;">
                        <strong style="color: #2563eb; font-size: 0.875rem;">💬 大白话翻译：</strong>
                        <div style="color: #64748b; margin-top: 0.25rem; line-height: 1.6;">${item.explanation}</div>
                    </div>
                    ` : ''}
                    ${item.example ? `
                    <div style="margin-bottom: 0.5rem;">
                        <strong style="color: #059669; font-size: 0.875rem;">💡 实际例子：</strong>
                        <div style="color: #64748b; margin-top: 0.25rem; line-height: 1.6;">${item.example}</div>
                    </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;

    // 5. 面试反问三个问题
    const questions = results.questions && results.questions.length > 0
        ? results.questions
        : ['暂无数据'];
    elements.result5.querySelector('.card-content').innerHTML = `
        <ul class="result-list">
            ${questions.map((q, index) => `
                <li style="background: #eff6ff; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem;">
                    <strong style="color: #2563eb;">Q${index + 1}:</strong> ${q}
                </li>
            `).join('')}
        </ul>
    `;

    // 6. 面试可能被问三个问题
    const interviewQuestions = results.interviewQuestions && results.interviewQuestions.length > 0
        ? results.interviewQuestions
        : ['暂无数据'];
    elements.result6.querySelector('.card-content').innerHTML = `
        <ul class="result-list">
            ${interviewQuestions.map((q, index) => `
                <li style="background: #fef3c7; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem;">
                    <strong style="color: #d97706;">Q${index + 1}:</strong> ${q}
                </li>
            `).join('')}
        </ul>
    `;

    // 添加动画效果
    animateResults();
}

// 显示错误
function displayError(errorMessage) {
    const errorHTML = `
        <div style="color: #dc2626; padding: 1.5rem; text-align: center; background: #fef2f2; border-radius: 0.5rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
            <div style="font-weight: 600; margin-bottom: 0.5rem;">解析失败</div>
            <div style="font-size: 0.875rem; color: #991b1b;">${errorMessage}</div>
            <div style="margin-top: 1rem; font-size: 0.75rem; color: #64748b;">
                请检查：<br>
                1. 后端服务器是否已启动<br>
                2. API密钥是否正确配置<br>
                3. 网络连接是否正常
            </div>
        </div>
    `;

    elements.result1.querySelector('.card-content').innerHTML = errorHTML;
    elements.result2.querySelector('.card-content').innerHTML = errorHTML;
    elements.result3.querySelector('.card-content').innerHTML = errorHTML;
    elements.result4.querySelector('.card-content').innerHTML = errorHTML;
    elements.result5.querySelector('.card-content').innerHTML = errorHTML;
    elements.result6.querySelector('.card-content').innerHTML = errorHTML;
}

// 动画效果
function animateResults() {
    const cards = [elements.result1, elements.result2, elements.result3, elements.result4, elements.result5, elements.result6];
    
    cards.forEach((card, index) => {
        card.classList.remove('animate');
        setTimeout(() => {
            card.classList.add('animate');
        }, index * 150);
    });
}

// 清空输入
function clearInput() {
    elements.jdInput.value = '';
    state.currentJD = '';
    state.analysisResults = {};
    updateButtonStates();

    // 清空结果
    const cardContents = document.querySelectorAll('.card-content');
    cardContents.forEach(content => {
        content.innerHTML = `
            <div class="placeholder">
                <p>点击"开始解析"后显示结果</p>
            </div>
        `;
    });

    elements.analysisTime.textContent = '--';

    // 移除动画类
    const cards = [elements.result1, elements.result2, elements.result3, elements.result4, elements.result5, elements.result6];
    cards.forEach(card => {
        card.classList.remove('animate');
    });

    showToast('已清空');
}

// 复制结果
function copyResults() {
    if (Object.keys(state.analysisResults).length === 0) {
        showToast('没有结果可复制');
        return;
    }

    let copyText = '岗位JD解读结果\n\n';
    
    copyText += '1. 一句话看懂（大白话）\n';
    copyText += state.analysisResults.summary || '暂无数据';
    copyText += '\n\n';
    
    copyText += '2. 要做的三件事（大白话）\n';
    if (state.analysisResults.tasks && state.analysisResults.tasks.length > 0) {
        state.analysisResults.tasks.forEach((task, index) => {
            copyText += `${index + 1}. ${task}\n`;
        });
    } else {
        copyText += '暂无数据\n';
    }
    copyText += '\n';
    
    copyText += '3. 硬门槛/可培养/加分项\n';
    const req = state.analysisResults.requirements || {};
    copyText += '硬门槛：\n';
    if (req.required && req.required.length > 0) {
        req.required.forEach(item => {
            copyText += `- ${item}\n`;
        });
    } else {
        copyText += '暂无数据\n';
    }
    copyText += '\n可培养：\n';
    if (req.trainable && req.trainable.length > 0) {
        req.trainable.forEach(item => {
            copyText += `- ${item}\n`;
        });
    } else {
        copyText += '暂无数据\n';
    }
    copyText += '\n加分项：\n';
    if (req.bonus && req.bonus.length > 0) {
        req.bonus.forEach(item => {
            copyText += `- ${item}\n`;
        });
    } else {
        copyText += '暂无数据\n';
    }
    copyText += '\n';
    
    copyText += '4. 翻译＋例子（大白话）\n';
    const trans = state.analysisResults.translation && state.analysisResults.translation.translations;
    if (trans && trans.length > 0) {
        trans.forEach(item => {
            copyText += `${item.term}\n`;
            if (item.explanation) copyText += `解释：${item.explanation}\n`;
            if (item.example) copyText += `例子：${item.example}\n`;
            copyText += '\n';
        });
    } else {
        copyText += '暂无数据\n\n';
    }
    
    copyText += '5. 面试反问三个问题\n';
    if (state.analysisResults.questions && state.analysisResults.questions.length > 0) {
        state.analysisResults.questions.forEach((q, index) => {
            copyText += `${index + 1}. ${q}\n`;
        });
    } else {
        copyText += '暂无数据\n';
    }
    copyText += '\n';
    
    copyText += '6. 面试可能被问三个问题\n';
    if (state.analysisResults.interviewQuestions && state.analysisResults.interviewQuestions.length > 0) {
        state.analysisResults.interviewQuestions.forEach((q, index) => {
            copyText += `${index + 1}. ${q}\n`;
        });
    } else {
        copyText += '暂无数据\n';
    }

    navigator.clipboard.writeText(copyText).then(() => {
        showToast('结果已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败，请手动复制');
    });
}

// 显示加载
let progressInterval = null;

function showLoading() {
    elements.loading.classList.add('active');
    startProgress();
}

// 隐藏加载
function hideLoading() {
    elements.loading.classList.remove('active');
    stopProgress();
}

// 开始进度条
function startProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingStatus = document.getElementById('loadingStatus');
    
    let progress = 0;
    const stages = [
        { progress: 10, status: '正在连接服务器...' },
        { progress: 20, status: '发送JD到AI模型...' },
        { progress: 30, status: 'AI正在分析JD...' },
        { progress: 50, status: '提取核心信息...' },
        { progress: 70, status: '生成大白话翻译...' },
        { progress: 85, status: '准备面试问题...' },
        { progress: 95, status: '即将完成...' }
    ];
    
    let stageIndex = 0;
    
    progressInterval = setInterval(() => {
        if (progress < 100) {
            // 更新进度
            if (stageIndex < stages.length && progress >= stages[stageIndex].progress) {
                loadingStatus.textContent = stages[stageIndex].status;
                stageIndex++;
            }
            
            // 模拟进度增长
            const increment = Math.random() * 2 + 0.5;
            progress = Math.min(progress + increment, 98);
            
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        }
    }, 200);
}

// 停止进度条
function stopProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // 完成进度条
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingStatus = document.getElementById('loadingStatus');
    
    if (progressFill) {
        progressFill.style.width = '100%';
    }
    if (progressText) {
        progressText.textContent = '100%';
    }
    if (loadingStatus) {
        loadingStatus.textContent = '解析完成！';
    }
}

// 显示提示
function showToast(message) {
    // 移除现有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 12px 24px;
        border-radius: var(--radius-md);
        z-index: 1001;
        font-size: 0.875rem;
        font-weight: 500;
        box-shadow: var(--shadow-md);
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);
