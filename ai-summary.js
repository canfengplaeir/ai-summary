(function() {
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
            0% { background-position: 100% 50%; }
            100% { background-position: 0 50%; }
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

    function createAISummaryCard() {
        const aiSummaryDiv = document.createElement('div');
        aiSummaryDiv.id = 'ai-article-summary';
        aiSummaryDiv.className = 'card';
        
        const postElement = document.getElementById('post');
        if (postElement) {
            postElement.insertBefore(aiSummaryDiv, postElement.firstChild);
        } else {
            console.error('Element with id "post" not found');
            return;
        }

        // 立即渲染 skeleton
        aiSummaryDiv.innerHTML = skeletonHTML;

        function renderCard(cardHTML) {
            aiSummaryDiv.innerHTML = cardHTML;
            addEventListeners();
        }

        function addEventListeners() {
            const refreshButton = aiSummaryDiv.querySelector('.refresh-button');
            if (refreshButton) {
                refreshButton.addEventListener('click', generateSummary);
            }

            aiSummaryDiv.querySelectorAll('.button').forEach(button => {
                button.addEventListener('click', handleButtonClick);
            });
        }

        function handleButtonClick() {
            const summaryElement = aiSummaryDiv.querySelector('.summary');
            switch (this.textContent) {
                case "介绍自己":
                    summaryElement.textContent = "我是一个AI生成的摘要示例。";
                    break;
                case "生成本文简介":
                    generateSummary();
                    break;
                case "推荐相关文章":
                    summaryElement.textContent = "暂不支持";
                    break;
                case "前往主页":
                    window.location.href = '/';
                    break;
            }
            console.log('点击了按钮：' + this.textContent);
        }

        function generateSummary() {
            const summaryElement = aiSummaryDiv.querySelector('.summary');
            summaryElement.innerHTML = '<span class="loading"></span>正在生成AI摘要...';

            const articleContent = document.getElementById('article-container').innerText;

            fetch('http://121.199.22.180:3000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: articleContent })
            })
            .then(response => response.json())
            .then(data => {
                summaryElement.innerHTML = `<span class="typing-effect">${data.summary}</span>`;
            })
            .catch((error) => {
                console.error('Error:', error);
                summaryElement.innerHTML = "生成摘要时发生错误，请稍后重试。";
            });
        }

        // 加载实际卡片模板
        fetch('http://121.199.22.180:3000/get-card-template')
            .then(response => response.json())
            .then(data => {
                renderCard(data.card);
                generateSummary();
            })
            .catch((error) => {
                console.error('Error:', error);
                // 如果加载失败，保持 skeleton 显示
                console.log('Failed to load card template, keeping skeleton.');
            });
    }

    // 当 DOM 加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createAISummaryCard);
    } else {
        createAISummaryCard();
    }
})();
