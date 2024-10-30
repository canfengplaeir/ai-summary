// 全局变量
let editor = null;

// Toast 提示函数
function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        className: type,
        style: {
            background: type === 'success' ? '#4CAF50' : 
                        type === 'error' ? '#f44336' : 
                        type === 'warning' ? '#ff9800' : '#2196F3'
        }
    }).showToast();
}

// 初始化编辑器
function initEditor(initialContent = '') {
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: initialContent,
            language: 'html',
            theme: 'vs-light',
            automaticLayout: true,
            minimap: { enabled: false }
        });
    });
}

// 保存主题
async function saveTheme() {
    if (!editor) return;
    
    const themeName = document.querySelector('h1').textContent.split(':')[1].trim();
    const content = editor.getValue();
    
    try {
        // 如果是新建主题，先检查名称是否重复
        const checkResponse = await fetch(`/admin/api/themes/${themeName}`);
        const isNewTheme = checkResponse.status === 404;
        
        if (isNewTheme) {
            const checkNameResponse = await fetch('/admin/api/themes');
            const themes = await checkNameResponse.json();
            if (themes.some(theme => theme.name === themeName)) {
                showToast('主题名称已存在', 'error');
                return;
            }
        }
        
        // 保存主题
        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) throw new Error('保存失败');
        
        showToast('主题保存成功', 'success');
        setTimeout(() => {
            window.location.href = '/admin/dashboard#themes';
        }, 1500);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    const themeName = document.querySelector('h1').textContent.split(':')[1].trim();
    
    try {
        const response = await fetch(`/admin/api/themes/${themeName}`);
        if (response.ok) {
            const data = await response.json();
            initEditor(data.content);
        } else {
            // 如果主题不存在，使用空模板初始化
            const defaultTemplate = `<div class="card">
    <div class="card-header">
        <h3>AI摘要</h3>
    </div>
    <div class="card-body">
        <div class="summary">
            <!-- 摘要内容将显示在这里 -->
        </div>
    </div>
</div>
<style>
    .card {
        /* 添加你的样式 */
    }
</style>`;
            initEditor(defaultTemplate);
        }
    } catch (error) {
        console.error('Error loading theme:', error);
        initEditor('');
    }
}); 