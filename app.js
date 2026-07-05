/* =========================================================================
   Data Layer (StorageService)
   - 目前封裝 LocalStorage 進行資料持久化
   - 結構設計為 Promise Base，未來可輕易抽換為 Firebase/Supabase API
========================================================================= */
class StorageService {
    constructor() {
        this.prefix = 'dream_tracker_';
        this.initializeData();
    }

    initializeData() {
        const collections = ['projects', 'milestones', 'tasks', 'journals', 'risks', 'blockers'];
        collections.forEach(col => {
            if (!localStorage.getItem(this.prefix + col)) {
                localStorage.setItem(this.prefix + col, JSON.stringify([]));
            }
        });
    }

    async getCollection(collection) {
        return JSON.parse(localStorage.getItem(this.prefix + collection)) || [];
    }

    async saveCollection(collection, data) {
        localStorage.setItem(this.prefix + collection, JSON.stringify(data));
    }

    async addItem(collection, item) {
        const data = await this.getCollection(collection);
        const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        data.push(newItem);
        await this.saveCollection(collection, data);
        return newItem;
    }
}

/* =========================================================================
   Application Controller
   - 負責處理 UI 渲染、事件綁定與主題切換
========================================================================= */
class AppController {
    constructor() {
        this.db = new StorageService();
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.bindEvents();
        this.loadView('dashboard'); // 預設載入 Dashboard
    }

    bindEvents() {
        // 深色模式切換
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            this.applyTheme(this.currentTheme);
            localStorage.setItem('theme', this.currentTheme);
        });

        // 側邊欄視圖切換
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const view = e.currentTarget.getAttribute('data-view');
                this.loadView(view);
                
                // 手機版自動收合
                document.getElementById('sidebar').classList.remove('open');
            });
        });

        // 手機版側邊欄開關
        document.getElementById('mobile-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Modal 控制
        const modal = document.getElementById('task-modal');
        document.getElementById('quick-add-btn').addEventListener('click', () => {
            modal.classList.add('active');
        });
        document.querySelector('.close-modal').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // 儲存任務邏輯
        document.getElementById('save-task-btn').addEventListener('click', async () => {
            const title = document.getElementById('task-title').value;
            if(!title) return alert("Task title is required.");
            
            await this.db.addItem('tasks', {
                title: title,
                description: document.getElementById('task-desc').value,
                dueDate: document.getElementById('task-due').value,
                status: 'Not Started'
            });
            modal.classList.remove('active');
            document.getElementById('task-title').value = '';
            document.getElementById('task-desc').value = '';
            
            // 重新載入當前畫面更新數據
            this.loadView('dashboard');
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.querySelector('#theme-toggle i');
        if(theme === 'dark') {
            icon.classList.replace('ph-moon', 'ph-sun');
        } else {
            icon.classList.replace('ph-sun', 'ph-moon');
        }
    }

    /* =========================================================================
       View Renderer Router
    ========================================================================= */
    async loadView(viewName) {
        const container = document.getElementById('view-container');
        container.innerHTML = '<h2>Loading...</h2>'; // 簡單載入動畫狀態

        switch(viewName) {
            case 'dashboard':
                container.innerHTML = await this.renderDashboard();
                break;
            case 'projects':
                container.innerHTML = `<h2>Projects</h2><p>Project list and grid rendering goes here.</p>`;
                break;
            case 'tasks':
                container.innerHTML = `<h2>Tasks (List/Board)</h2><p>Kanban and List view of tasks.</p>`;
                break;
            // 由於系統龐大，其餘 View 預留介面與擴充節點
            default:
                container.innerHTML = `<h2>${viewName.charAt(0).toUpperCase() + viewName.slice(1)}</h2><p>This module is structured and ready for implementation.</p>`;
        }
    }

    /* =========================================================================
       Dashboard View Generator
    ========================================================================= */
    async renderDashboard() {
        // 取得統計資料
        const tasks = await this.db.getCollection('tasks');
        const projects = await this.db.getCollection('projects');
        
        const doneTasks = tasks.filter(t => t.status === 'Done').length;
        const pendingTasks = tasks.length - doneTasks;

        return `
            <div class="dashboard-header" style="margin-bottom: 24px;">
                <h1>Overview</h1>
                <p style="color: var(--text-secondary);">Track your dreams and daily progress.</p>
            </div>
            
            <div class="dashboard-grid">
                <div class="metric-card">
                    <span class="metric-title">今日待辦 (Today)</span>
                    <span class="metric-value">${pendingTasks}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title">專案數量 (Projects)</span>
                    <span class="metric-value">${projects.length}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title">已完成 Task (Done)</span>
                    <span class="metric-value">${doneTasks}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title">專案完成率 (Avg Progress)</span>
                    <span class="metric-value">0%</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title">逾期 Task (Overdue)</span>
                    <span class="metric-value" style="color: #ef4444;">0</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title">本週工時 (Hours Logged)</span>
                    <span class="metric-value">0h</span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <div class="panel" style="background: var(--bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <h3>甘特圖概覽 (Gantt Mini View)</h3>
                    <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                        [ Timeline Component Placeholder ]
                    </div>
                </div>
                <div class="panel" style="background: var(--bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <h3>最近延期工作 (Delay Log)</h3>
                    <ul style="list-style: none; padding-top: 12px;">
                        <li style="color: var(--text-secondary); font-size: 0.9rem;">No delayed tasks recently! Keep it up.</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// 啟動應用程式
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
