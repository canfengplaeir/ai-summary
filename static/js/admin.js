// 全局变量
let editor = null; // Monaco Editor 实例

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

// 页面导航
function navigate(section) {
    // 隐藏所有部分
    document.querySelectorAll('#dashboard, #summaries, #config, #themes, #accounts').forEach(el => {
        el.classList.add('hidden');
    });
    // 显示选中部分
    document.getElementById(section).classList.remove('hidden');
    // 更新URL hash
    window.location.hash = section;
    // 更新活动菜单项
    document.querySelectorAll('.menu a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('href') === '#' + section) {
            a.classList.add('active');
        }
    });
}

// 初始化 Monaco Editor
function initMonacoEditor() {
    if (!document.getElementById('monaco-editor')) return;
    
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs' }});
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: '',
            language: 'html',
            theme: 'vs-light',
            automaticLayout: true,
            minimap: { enabled: false }
        });
        
        // 初始化完成后加载当前选中主题的内容
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect && themeSelect.value) {
            loadThemeContent(themeSelect.value);
        }
    });
}

// 加载主题内容
async function loadThemeContent(themeName) {
    try {
        const response = await fetch(`/admin/api/themes/${themeName}`);
        if (!response.ok) throw new Error('加载主题失败');
        const data = await response.json();
        editor.setValue(data.content);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 保存主题
async function saveTheme() {
    if (!editor) {
        showToast('编辑器未初始化', 'error');
        return;
    }

    const themeName = document.getElementById('themeSelect').value;
    const content = editor.getValue();

    try {
        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '保存失败');
        }
        
        showToast('主题保存成功', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 删除主题
async function deleteTheme() {
    const themeName = document.getElementById('themeSelect').value;
    if (!confirm(`确定要删除主题 "${themeName}" 吗？此操作不可恢复。`)) return;

    try {
        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('删除失败');
        showToast('主题删除成功', 'success');
        location.reload();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 显示新建主题弹窗
function showNewThemeModal() {
    document.getElementById('newThemeModal').showModal();
}

// 检查主题名是否存在
async function isThemeNameExists(themeName) {
    try {
        const response = await fetch('/admin/api/themes');
        if (!response.ok) throw new Error('检查主题名失败');
        const themes = await response.json();
        return themes.some(t => t.name.toLowerCase() === themeName.toLowerCase());
    } catch (error) {
        showToast(error.message, 'error');
        return true; // 出错时返回 true 以防止创建
    }
}

// 修改创建新主题函数
async function createNewTheme() {
    const themeName = document.getElementById('newThemeName').value.trim();
    if (!themeName) {
        showToast('请输入主题名称', 'warning');
        return;
    }

    // 检查主题名是否包含非法字符
    if (!/^[a-zA-Z0-9_-]+$/.test(themeName)) {
        showToast('主题名称只能包含字母、数字、下划线和横线', 'error');
        return;
    }

    try {
        // 检查主题名是否已存在
        if (await isThemeNameExists(themeName)) {
            showToast('主题名称已存在，请使用其他名称', 'error');
            return;
        }

        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: getDefaultTemplate() })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '创建失败');
        }
        
        showToast('主题创建成功', 'success');
        document.getElementById('newThemeModal').close();
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 修改主题上传处理函数
async function handleThemeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件扩展名
    if (!file.name.toLowerCase().endsWith('.html')) {
        showToast('只能上传HTML文件', 'error');
        return;
    }

    try {
        const content = await file.text();
        
        // 验证主题内容
        const validation = validateThemeContent(content);
        if (!validation.valid) {
            showToast(validation.error, 'error');
            return;
        }

        // 获取文件名（不包含扩展名）作为主题名
        const themeName = file.name.replace('.html', '');

        // 检查主题名是否包含非法字符
        if (!/^[a-zA-Z0-9_-]+$/.test(themeName)) {
            showToast('主题文件名只能包含字母、数字、下划线和横线', 'error');
            return;
        }

        // 检查主题名是否已存在
        if (await isThemeNameExists(themeName)) {
            showToast('已存在同名主题，请修改文件名后重试', 'error');
            return;
        }

        // 上传主题
        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        if (!response.ok) throw new Error('上传失败');
        
        showToast('主题上传成功', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }

    // 清除文件选择
    event.target.value = '';
}

// 添加默认模板函数
function getDefaultTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://cdn.jsdelivr.net/npm/daisyui@3.9.4/dist/full.css" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
            <div class="summary"></div>
        </div>
    </div>
</body>
</html>`;
}

// 加载仪表盘数据
async function loadDashboardData() {
    try {
        const response = await fetch('/admin/api/stats');
        if (!response.ok) throw new Error('加载统计数据失败');
        const data = await response.json();
        
        // 更新统计数据
        document.getElementById('totalSummaries').textContent = data.total_summaries;
        document.getElementById('todaySummaries').textContent = data.today_summaries;
        document.getElementById('apiCalls').textContent = data.api_calls;
        document.getElementById('cacheHitRate').textContent = data.cache_hit_rate + '%';

        // 更新最近摘要列表
        const tbody = document.querySelector('#recentSummaries tbody');
        tbody.innerHTML = data.recent_summaries.map(summary => `
            <tr>
                <td>${summary.article_id}</td>
                <td>${summary.last_updated}</td>
                <td>
                    <button onclick="showSummaryModal('${summary.summary}')" 
                            class="link link-primary">
                        ${summary.summary}
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 保存配置
async function saveConfig(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const config = {
        DASHSCOPE_API_KEY: formData.get('api_key'),
        BASE_URL: formData.get('base_url'),
        SYSTEM_CONTENT: formData.get('system_content'),
        CORS_ORIGIN: formData.get('cors_origin'),
        THEME: document.querySelector('#themeSelect')?.value || 'light'
    };

    try {
        const response = await fetch('/admin/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!response.ok) throw new Error('保存失败');
        showToast('配置保存成功', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面导航
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigate(hash);

    // 监听hash变化
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1) || 'dashboard';
        navigate(hash);
    });

    // 初始化 Monaco Editor
    if (document.getElementById('monaco-editor')) {
        initMonacoEditor();
    }

    // 加载仪表盘数据
    if (document.getElementById('dashboard')) {
        loadDashboardData();
        // 每60秒刷新一次数据
        setInterval(loadDashboardData, 60000);
    }

    // 监听主题选择变化
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', () => {
            if (editor) {  // 确保编辑器已初始化
                loadThemeContent(themeSelect.value);
            }
        });
    }

    // 添加键盘事件监听器，按ESC关闭弹窗
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('dialog[open]');
            modals.forEach(modal => modal.close());
        }
    });

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        // 设置当前用户名
        const currentUsername = document.getElementById('current_username');
        // 从 cookie 或其他地方获取当前用户名
        fetch('/admin/api/profile/current')
            .then(response => response.json())
            .then(data => {
                currentUsername.value = data.username;
            })
            .catch(error => console.error('Error:', error));

        // 监听输入变化以更新按钮状态
        const newUsername = profileForm.querySelector('input[name="new_username"]');
        const newPassword = profileForm.querySelector('input[name="new_password"]');
        const submitButton = profileForm.querySelector('button[type="submit"]');
        
        function updateButtonState() {
            const hasNewUsername = newUsername.value.trim() !== '';
            const hasNewPassword = newPassword.value.trim() !== '';
            submitButton.disabled = !(hasNewUsername || hasNewPassword);
        }

        newUsername.addEventListener('input', updateButtonState);
        newPassword.addEventListener('input', updateButtonState);

        // 表单提交处理
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const currentPassword = formData.get('current_password');
            
            if (!currentPassword) {
                showToast('请输入当前密码', 'error');
                return;
            }
            
            try {
                const response = await fetch('/admin/api/profile/update', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showToast('账户信息更新成功！', 'success');
                    // 更新成功后延迟1.5秒退出登录
                    setTimeout(() => {
                        window.location.href = '/admin/logout';
                    }, 1500);
                } else {
                    showToast(data.detail || '更新失败，请重试', 'error');
                }
            } catch (error) {
                showToast('发生错误，请重试', 'error');
                console.error(error);
            }
        });
    }

    // 加载主题预览
    loadThemePreviews();
});

// 在现有代码中添加或修改
function showSummaryModal(summary) {
    const modal = document.getElementById('summaryModal');
    const modalContent = document.getElementById('modalSummaryContent');
    if (modal && modalContent) {
        modalContent.textContent = summary;
        modal.showModal();
    } else {
        console.error('Modal elements not found');
    }
}

// 刷新摘要
async function refreshSummary(articleId) {
    if (!confirm('确定要刷新这篇文章的摘要吗？')) return;

    try {
        const response = await fetch(`/admin/api/refresh/${articleId}`, {
            method: 'POST',
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '刷新失败');
        }
        
        showToast('摘要刷新成功', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 删除摘要
async function deleteSummary(articleId) {
    if (!confirm('确定要删除这篇文章的摘要吗？此操作不可恢复。')) return;

    try {
        const response = await fetch(`/admin/api/delete/${articleId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
        
        showToast('摘要删除成功', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 主题管理相关函数
let currentEditingTheme = null;

// 修改加载主题预览的函数
async function loadThemePreviews() {
    const frames = document.querySelectorAll('[id^="preview-frame-"]');
    for (const frame of frames) {
        const themeName = frame.id.replace('preview-frame-', '');
        try {
            const response = await fetch(`/admin/api/themes/${themeName}`);
            if (response.ok) {
                const data = await response.json();
                // 创一个完整的HTML文档，包含必要的样式
                const previewHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <link rel="stylesheet" href="/static/css/output.css">
                        <style>
                            body {
                                margin: 0;
                                padding: 16px;
                                min-height: 100vh;
                                background-color: transparent;
                            }
                            .preview-content {
                                width: 100%;
                                height: 100%;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="preview-content">
                            ${data.content}
                        </div>
                    </body>
                    </html>
                `;
                frame.srcdoc = previewHtml;
            }
        } catch (error) {
            console.error(`Error loading preview for ${themeName}:`, error);
        }
    }
}

// 编辑主题
async function editTheme(themeName) {
    currentEditingTheme = themeName;
    const modal = document.getElementById('themeEditModal');
    
    try {
        const response = await fetch(`/admin/api/themes/${themeName}`);
        if (!response.ok) throw new Error('加载主题失败');
        const data = await response.json();
        
        if (!editor) {
            // 初始化编辑器
            require(['vs/editor/editor.main'], function() {
                editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                    value: data.content,
                    language: 'html',
                    theme: 'vs-light',
                    automaticLayout: true,
                    minimap: { enabled: false }
                });
                modal.showModal();
            });
        } else {
            editor.setValue(data.content);
            modal.showModal();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 关闭主题编辑器
function closeThemeEditor() {
    const modal = document.getElementById('themeEditModal');
    modal.close();
    currentEditingTheme = null;
}

// 保存主题编辑
async function saveThemeEdit() {
    if (!currentEditingTheme || !editor) return;
    
    try {
        const response = await fetch(`/admin/api/themes/${currentEditingTheme}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editor.getValue() })
        });
        
        if (!response.ok) throw new Error('保存失败');
        
        showToast('主题保存成功', 'success');
        closeThemeEditor();
        // 刷新预览
        loadThemePreviews();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 确认删除主题
function confirmDeleteTheme(themeName) {
    if (confirm(`确定要删除主题 "${themeName}" 吗？此操作不可恢复。`)) {
        deleteTheme(themeName);
    }
}

// 删除主题
async function deleteTheme(themeName) {
    try {
        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('删除失败');
        showToast('主题删除成功', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 应用主题
async function applyTheme(themeName) {
    try {
        // 首先获取当前配置
        const response = await fetch('/admin/api/config');
        if (!response.ok) throw new Error('获取配置失败');
        const currentConfig = await response.json();
        
        // 准备更新配置
        const configUpdate = {
            DASHSCOPE_API_KEY: currentConfig.configs.find(c => c.key === 'DASHSCOPE_API_KEY')?.value || '',
            BASE_URL: currentConfig.configs.find(c => c.key === 'BASE_URL')?.value || '',
            SYSTEM_CONTENT: currentConfig.configs.find(c => c.key === 'SYSTEM_CONTENT')?.value || '',
            CORS_ORIGIN: currentConfig.configs.find(c => c.key === 'CORS_ORIGIN')?.value || '',
            THEME: themeName
        };

        // 发送更新请求
        const updateResponse = await fetch('/admin/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configUpdate)
        });
        
        if (!updateResponse.ok) throw new Error('应用主题失败');
        showToast('主题应用成功', 'success');
        
        // 刷新页面以显示新主题
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// 添加主题验证函数
function validateThemeContent(content) {
    // 检查是否是HTML
    if (!content.trim().toLowerCase().includes('<!doctype html') && 
        !content.trim().toLowerCase().startsWith('<html')) {
        return { valid: false, error: '主题文件必须是完整的HTML文档' };
    }

    // 检查是否包含必要的布局元素
    if (!content.includes('class="summary"')) {
        return { valid: false, error: '主题必须包含摘要显示区域 (class="summary")' };
    }

    return { valid: true };
}
