console.log('AI Summary script loaded');

// API配置
const API_CONFIG = {
    BASE_URL: '',
    ENDPOINTS: {
        TEMPLATE: '/api/card-template',
        SUMMARY: '/api/summary'
    }
};

// 骨架屏HTML模板
const skeletonHTML = `
<div class="card skeleton-theme">
    <div class="card-header">
        <div class="card-title skeleton-text">
            <div class="skeleton-icon"></div>
            <div class="skeleton-title-text"></div>
        </div>
        <div class="skeleton-button"></div>
    </div>
    <div class="card-body">
        <div class="summary">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
        </div>
        <div class="button-group">
            <div class="skeleton-button"></div>
            <div class="skeleton-button"></div>
            <div class="skeleton-button"></div>
            <div class="skeleton-button"></div>
        </div>
    </div>
</div>
<style>
    @keyframes skeleton-loading {
        0% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0 50%;
        }
    }
    .skeleton-theme {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
    }
    .card {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }
    .card-header {
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e9ecef;
    }
    .card-title {
        display: flex;
        align-items: center;
    }
    .skeleton-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        margin-right: 8px;
        background: linear-gradient(124deg, #ff2400, #e81d1d, #e8b71d, #e3e81d, #1de840, #1ddde8, #2b1de8, #dd00f3, #dd00f3);
        background-size: 1800% 1800%;
        animation: rainbow 18s ease infinite;
    }
    .skeleton-title-text {
        width: 100px;
        height: 20px;
        background-color: #e0e0e0;
        border-radius: 4px;
    }
    .skeleton-button {
        width: 80px;
        height: 30px;
        background-color: #e0e0e0;
        border-radius: 4px;
    }
    .card-body {
        padding: 16px;
    }
    .summary {
        min-height: 60px;
        margin-bottom: 16px;
    }
    .skeleton-line {
        height: 16px;
        margin-bottom: 8px;
        background-color: #e0e0e0;
        border-radius: 4px;
    }
    .skeleton-line:last-child {
        width: 60%;
    }
    .button-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    @keyframes rainbow { 
        0% { background-position: 0% 82% }
        50% { background-position: 100% 19% }
        100% { background-position: 0% 82% }
    }
</style>
`;

// 标记变量，防止重复初始化
let isInitializing = false;

// 创建AI摘要卡片
function createAISummaryCard() {
    // 如果正在初始化，直接返回
    if (isInitializing) return;
    isInitializing = true;

    // 移除已存在的卡片
    const existingCard = document.getElementById('ai-article-summary');
    if (existingCard) existingCard.remove();

    // 创建新卡片
    const aiSummaryDiv = document.createElement('div');
    aiSummaryDiv.id = 'ai-article-summary';
    aiSummaryDiv.className = 'card';
    
    // 插入到文章顶部
    const postElement = document.getElementById('post');
    if (!postElement) {
        console.error('Post element not found');
        isInitializing = false;
        return;
    }
    postElement.insertBefore(aiSummaryDiv, postElement.firstChild);
    aiSummaryDiv.innerHTML = skeletonHTML;

    // 使用配置的API地址
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TEMPLATE}`)
        .then(response => response.json())
        .then(data => {
            aiSummaryDiv.innerHTML = data.card;
            addEventListeners(aiSummaryDiv);
            generateSummary(aiSummaryDiv); // 获取初始摘要
            isInitializing = false;
        })
        .catch(error => {
            console.error('Failed to load card template:', error);
            isInitializing = false;
        });
}

// 添加事件监听器
function addEventListeners(card) {
    const refreshButton = card.querySelector('.refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => generateSummary(card));
    }

    card.querySelectorAll('.button').forEach(button => {
        button.addEventListener('click', handleButtonClick.bind(null, card));
    });
}

// 处理按钮点击事件
function handleButtonClick(card, event) {
    const summaryElement = card.querySelector('.summary');
    switch (event.target.textContent) {
        case "介绍自己":
            summaryElement.textContent = "我是一个AI生成的摘要示例。";
            break;
        case "生成本文简介":
            generateSummary(card);
            break;
        case "推荐相关文章":
            summaryElement.textContent = "暂不支持";
            break;
        case "前往主页":
            window.location.href = '/';
            break;
    }
}

// 生成摘要的核心函数
function generateSummary(card) {
    const summaryElement = card.querySelector('.summary');
    const articleContainer = document.querySelector('article.post-content.line-numbers#article-container');
    
    // 获取最后更新时间，使用title属性获取完整时间
    const lastUpdatedElement = document.querySelector('span.post-meta-date i[title="最后更新时间"]').nextElementSibling;
    const lastUpdated = lastUpdatedElement ? lastUpdatedElement.getAttribute('title') : null;
    
    const articleUrl = window.location.href;

    if (!articleContainer || !lastUpdated) {
        console.error('Required elements not found', {
            articleContainer: !!articleContainer,
            lastUpdated: !!lastUpdated,
            articleContainerSelector: 'article.post-content.line-numbers#article-container',
            lastUpdatedSelector: 'span.post-meta-date i[title="最后更新时间"]',
        });
        return;
    }

    const articleContent = articleContainer.innerText;
    console.log("Generating summary for article length:", articleContent.length);
    console.log("Article URL:", articleUrl);
    console.log("Last updated:", lastUpdated);
    
    summaryElement.innerHTML = '<span class="loading"></span>正在生成AI摘要...';

    // 使用配置的API地址
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SUMMARY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: articleContent,
            last_updated: lastUpdated,
            article_url: articleUrl
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.summary) {
            console.log("Summary received, length:", data.summary.length);
            summaryElement.innerHTML = `<span class="typing-effect">${data.summary}</span>`;
        } else {
            throw new Error('No summary in response');
        }
    })
    .catch(error => {
        console.error('Error generating summary:', error);
        summaryElement.innerHTML = "生成摘要时发生错误，请稍后重试。";
    });
}

// 检查并初始化
function checkAndInitialize() {
    // 如果正在初始化或者已经存在摘要卡片，则不执行
    if (isInitializing || document.getElementById('ai-article-summary')) {
        return false;
    }

    if (document.getElementById('article-container') && document.getElementById('post')) {
        createAISummaryCard();
        return true;
    }
    return false;
}

// 使用 MutationObserver 监听DOM变化
const observer = new MutationObserver((mutations) => {
    // 只在没有正在初始化时检查
    if (!isInitializing) {
        checkAndInitialize();
    }
});

// 等待 DOM 加载完成后再开始观察
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        checkAndInitialize();
    });
} else {
    observer.observe(document.body, { childList: true, subtree: true });
    checkAndInitialize();
}

// 暴露初始化函数到全局作用域
window.initializeAISummary = createAISummaryCard;

console.log('AI Summary script finished loading - ' + new Date().toISOString());
