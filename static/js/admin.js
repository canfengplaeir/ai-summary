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
    document.querySelectorAll('#dashboard, #summaries, #config, #themes').forEach(el => {
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

// 创建新主题
async function createNewTheme() {
    const themeName = document.getElementById('newThemeName').value.trim();
    if (!themeName) {
        showToast('请输入主题名称', 'warning');
        return;
    }

    try {
        const response = await fetch(`/admin/api/themes/${themeName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '' })
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

// 账户管理相关函数
async function loadAdmins() {
    try {
        const response = await fetch('/admin/api/admins');
        if (!response.ok) throw new Error('加载失败');
        const data = await response.json();
        return data.admins;
    } catch (error) {
        showToast(error.message, 'error');
        return [];
    }
}

async function createAdmin(adminData) {
    try {
        const response = await fetch('/admin/api/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '创建失败');
        }
        
        showToast('管理员创建成功', 'success');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

async function updateAdmin(username, adminData) {
    try {
        const response = await fetch(`/admin/api/admins/${username}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '更新失败');
        }
        
        showToast('管理员更新成功', 'success');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

async function deleteAdmin(username) {
    if (!confirm(`确定要删除管理员 "${username}" 吗？此操作不可恢复。`)) return false;

    try {
        const response = await fetch(`/admin/api/admins/${username}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
        
        showToast('管理员删除成功', 'success');
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}
