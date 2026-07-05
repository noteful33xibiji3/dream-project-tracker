/* =========================================================================
   Part 3: app.js
   核心資料結構、業務邏輯與介面渲染 (Dream Project Tracker)
========================================================================= */

/* =========================================================================
   1. Data Layer (StorageService)
   封裝 LocalStorage 進行資料持久化，未來可無縫切換至雲端資料庫
========================================================================= */
class StorageService {
    constructor() {
        this.prefix = 'dream_tracker_';
        this.collections = ['projects', 'milestones', 'tasks', 'delay_logs', 'reviews', 'journals', 'risks', 'blockers'];
        this.initializeData();
    }

    initializeData() {
        this.collections.forEach(col => {
            if (!localStorage.getItem(this.prefix + col)) {
                localStorage.setItem(this.prefix + col, JSON.stringify([]));
            }
        });
        this.seedInitialData();
    }

    // 建立一筆預設專案供首次使用測試
    seedInitialData() {
        const projects = this.getCollectionSync('projects');
        if (projects.length === 0) {
            this.addItemSync('projects', {
                title: 'Welcome Project',
                vision: 'Get familiar with Dream Tracker',
                description: 'This is an auto-generated project.',
                status: 'Doing',
                progress: 0,
                color: '#5e6ad2'
            });
        }
    }

    async getCollection(collection) {
        return JSON.parse(localStorage.getItem(this.prefix + collection)) || [];
    }

    getCollectionSync(collection) {
        return JSON.parse(localStorage.getItem(this.prefix + collection)) || [];
    }

    async saveCollection(collection, data) {
        localStorage.setItem(this.prefix + collection, JSON.stringify(data));
    }

    async addItem(collection, item) {
        const data = await this.getCollection(collection);
        const newItem = { 
            ...item, 
            id: crypto.randomUUID(), 
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        data.push(newItem);
        await this.saveCollection(collection, data);
        return newItem;
    }

    addItemSync(collection, item) {
        const data = this.getCollectionSync(collection);
        const newItem = { 
            ...item, 
            id: crypto.randomUUID(), 
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        data.push(newItem);
        localStorage.setItem(this.prefix + collection, JSON.stringify(data));
        return newItem;
    }

    async updateItem(collection, id, updates) {
        const data = await this.getCollection(collection);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
            await this.saveCollection(collection, data);
            return data[index];
        }
        return null;
    }

    async deleteItem(collection, id) {
        let data = await this.getCollection(collection);
        data = data.filter(item => item.id !== id);
        await this.saveCollection(collection, data);
    }
}

/* =========================================================================
   2. Application Controller
   負責處理 UI 渲染、事件綁定與主題切換
========================================================================= */
class AppController {
    constructor() {
        this.db = new StorageService();
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.currentView = 'dashboard';
    }

    async init() {
        this.applyTheme(this.currentTheme);
        await this.populateProjectDropdown();
        this.bindGlobalEvents();
        await this.loadView(this.currentView);
    }

    bindGlobalEvents() {
        // 主題切換
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
                this.applyTheme(this.currentTheme);
                localStorage.setItem('theme', this.currentTheme);
            });
        }

        // 側邊欄導覽
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const view = e.currentTarget.getAttribute('data-view');
                this.currentView = view;
                await this.loadView(view);
                
                // 手機版自動收合
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('open');
            });
        });

        // 手機版選單開關
        const mobileToggle = document.getElementById('mobile-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
            });
        }

        // Modal 控制 (快速新增 Task)
        const modal = document.getElementById('task-modal');
        const quickAddBtn = document.getElementById('quick-add-btn');
        const closeModalBtn = document.querySelector('.close-modal');
        const saveTaskBtn = document.getElementById('save-task-btn');

        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                this.populateProjectDropdown();
                modal.classList.add('active');
            });
        }
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        
        // 點擊 Modal 外部關閉
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        // 儲存任務
        if (saveTaskBtn) {
            saveTaskBtn.addEventListener('click', async () => {
                const titleInput = document.getElementById('task-title');
                const descInput = document.getElementById('task-desc');
                const projectInput = document.getElementById('task-project');
                const dueInput = document.getElementById('task-due');

                const title = titleInput.value.trim();
                if(!title) {
                    alert("Task Name is required.");
                    return;
                }
                
                await this.db.addItem('tasks', {
                    title: title,
                    description: descInput.value,
                    projectId: projectInput.value,
                    dueDate: dueInput.value,
                    status: 'Not Started',
                    progress: 0,
                    priority: 'Medium'
                });

                modal.classList.remove('active');
                
                // 清空表單
                titleInput.value = '';
                descInput.value = '';
                projectInput.value = '';
                dueInput.value = '';
                
                // 重新載入當前畫面
                await this.loadView(this.currentView);
            });
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.querySelector('#theme-toggle i');
        if (icon) {
            if(theme === 'dark') {
                icon.classList.replace('ph-moon', 'ph-sun');
            } else {
                icon.classList.replace('ph-sun', 'ph-moon');
            }
        }
    }

    async populateProjectDropdown() {
        const projects = await this.db.getCollection('projects');
        const select = document.getElementById('task-project');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Project (Optional)</option>';
        projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.title;
            select.appendChild(option);
        });
    }

    /* =========================================================================
       3. View Renderer Router
       根據不同的 data-view 渲染對應的 HTML 內容
    ========================================================================= */
    async loadView(viewName) {
        const container = document.getElementById('view-container');
        if (!container) return;
        
        container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">Loading...</div>';

        try {
            let htmlContent = '';
            switch(viewName) {
                case 'dashboard':
                    htmlContent = await this.renderDashboard();
                    break;
                case 'projects':
                    htmlContent = await this.renderProjects();
                    break;
                case 'tasks':
                    htmlContent = await this.renderTasks();
                    break;
                case 'journal':
                    htmlContent = await this.renderJournal();
                    break;
                case 'review':
                    htmlContent = await this.renderReview();
                    break;
                case 'timeline':
                    htmlContent = await this.renderTimeline();
                    break;
                case 'calendar':
                    htmlContent = await this.renderCalendar();
                    break;
                case 'statistics':
                    htmlContent = await this.renderStatistics();
                    break;
                default:
                    htmlContent = `
                        <div class="page-header">
                            <h1>${viewName.charAt(0).toUpperCase() + viewName.slice(1)}</h1>
                            <p>This module is structured and ready for implementation.</p>
                        </div>
                    `;
            }
            container.innerHTML = htmlContent;
            
            // 綁定特定視圖的事件
            this.bindViewSpecificEvents(viewName);
            
        } catch (error) {
            console.error("View rendering error:", error);
            container.innerHTML = `<div style="color: red;">Error loading view: ${error.message}</div>`;
        }
    }

    /* =========================================================================
       4. View Generators
       各個模組的 HTML 樣板生成邏輯
    ========================================================================= */
    
    // --- Dashboard View ---
    async renderDashboard() {
        const tasks = await this.db.getCollection('tasks');
        const projects = await this.db.getCollection('projects');
        
        const doneTasks = tasks.filter(t => t.status === 'Done').length;
        const pendingTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled').length;
        
        // 計算今日待辦與逾期 (簡易邏輯：比對日期字串)
        const today = new Date().toISOString().split('T')[0];
        const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Done').length;
        const todayTasks = tasks.filter(t => t.dueDate === today && t.status !== 'Done');

        // 生成任務列表 HTML
        const todayTasksHtml = todayTasks.length > 0 
            ? todayTasks.map(t => `
                <div class="task-item">
                    <div class="task-item-left">
                        <i class="ph ph-circle"></i>
                        <span>${this.escapeHTML(t.title)}</span>
                    </div>
                    <span class="status-badge status-${t.status.toLowerCase().replace(' ', '-')}">${t.status}</span>
                </div>
              `).join('')
            : '<div style="color: var(--text-tertiary); padding: 12px 0;">No tasks due today. Awesome!</div>';

        return `
            <div class="page-header">
                <h1>Overview</h1>
                <p>Track your dreams and daily progress.</p>
            </div>
            
            <div class="dashboard-grid">
                <div class="metric-card">
                    <span class="metric-title"><i class="ph ph-sun"></i> 今日待辦 (Today)</span>
                    <span class="metric-value">${todayTasks.length}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title"><i class="ph ph-folder"></i> 專案數量 (Projects)</span>
                    <span class="metric-value">${projects.length}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title"><i class="ph ph-check-circle"></i> 已完成 Task</span>
                    <span class="metric-value">${doneTasks}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-title" style="color: #ef4444;"><i class="ph ph-warning-circle"></i> 逾期 Task</span>
                    <span class="metric-value" style="color: #ef4444;">${overdueTasks}</span>
                </div>
            </div>

            <div class="panel-grid">
                <div class="panel">
                    <h3><i class="ph ph-list-checks"></i> 今日任務 (Today's Tasks)</h3>
                    <div class="task-list">
                        ${todayTasksHtml}
                    </div>
                </div>
                <div class="panel">
                    <h3><i class="ph ph-clock-counter-clockwise"></i> 最近延期 (Delay Log)</h3>
                    <div style="color: var(--text-tertiary); margin-top: 12px; font-size: 0.9rem;">
                        No delayed tasks recorded recently. Keep up the good work!
                    </div>
                </div>
            </div>
        `;
    }

    // --- Projects View ---
    async renderProjects() {
        const projects = await this.db.getCollection('projects');
        
        let projectsHtml = projects.map(p => `
            <div class="metric-card" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">${this.escapeHTML(p.title)}</h3>
                    <span class="status-badge status-${(p.status || 'Not Started').toLowerCase().replace(' ', '-')}">${p.status || 'Not Started'}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${this.escapeHTML(p.description || 'No description provided.')}
                </p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${p.progress || 0}%; background-color: ${p.color || 'var(--brand-blue)'}"></div>
                </div>
                <div style="text-align: right; font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">${p.progress || 0}%</div>
            </div>
        `).join('');

        if(projects.length === 0) {
            projectsHtml = `<div style="grid-column: 1 / -1; color: var(--text-tertiary);">No projects found. Create one to start tracking your dreams.</div>`;
        }

        return `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Projects</h1>
                    <p>Manage your long-term goals and portfolios.</p>
                </div>
                <button class="btn-primary" id="new-project-btn"><i class="ph ph-plus"></i> New Project</button>
            </div>
            
            <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
                ${projectsHtml}
            </div>
        `;
    }

    // --- Tasks View ---
    async renderTasks() {
        const tasks = await this.db.getCollection('tasks');
        const projects = await this.db.getCollection('projects');
        
        // 建立專案 ID 對照表以便顯示專案名稱
        const projectMap = {};
        projects.forEach(p => projectMap[p.id] = p.title);

        // 依狀態分組
        const statuses = ['Not Started', 'Doing', 'Waiting', 'Blocked', 'Review', 'Done'];
        
        let boardHtml = `<div style="display: flex; gap: 24px; overflow-x: auto; padding-bottom: 24px; min-height: 500px;">`;
        
        statuses.forEach(status => {
            const statusTasks = tasks.filter(t => t.status === status);
            const statusColorClass = `status-${status.toLowerCase().replace(' ', '-')}`;
            
            boardHtml += `
                <div style="flex: 0 0 300px; background: var(--bg-secondary); border-radius: var(--border-radius); padding: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <span class="status-badge ${statusColorClass}" style="font-size: 0.9rem;">${status}</span>
                        <span style="color: var(--text-tertiary); font-size: 0.9rem;">${statusTasks.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${statusTasks.map(t => `
                            <div class="panel" style="padding: 16px; cursor: pointer;" data-task-id="${t.id}">
                                <h4 style="margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">${this.escapeHTML(t.title)}</h4>
                                ${t.projectId ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px;"><i class="ph ph-folder"></i> ${this.escapeHTML(projectMap[t.projectId] || 'Unknown')}</div>` : ''}
                                ${t.dueDate ? `<div style="font-size: 0.75rem; color: var(--text-tertiary);"><i class="ph ph-calendar"></i> ${t.dueDate}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn-icon full-width" style="margin-top: 12px; border: 1px dashed var(--border-color);" onclick="document.getElementById('quick-add-btn').click();">
                        <i class="ph ph-plus"></i> Add
                    </button>
                </div>
            `;
        });
        
        boardHtml += `</div>`;

        return `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Tasks Board</h1>
                    <p>Kanban view of all your action items.</p>
                </div>
            </div>
            ${boardHtml}
        `;
    }

    // --- Journal View ---
    async renderJournal() {
        const journals = await this.db.getCollection('journals');
        const today = new Date().toISOString().split('T')[0];
        const todayJournal = journals.find(j => j.date === today);

        return `
            <div class="page-header">
                <h1>Daily Journal</h1>
                <p>Reflect on your day, track issues, and plan for tomorrow.</p>
            </div>
            
            <div class="panel-grid">
                <div class="panel">
                    <h3><i class="ph ph-pencil-simple"></i> Today's Entry (${today})</h3>
                    <div style="margin-top: 20px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">今天做了什麼 (What did I do?)</label>
                        <textarea class="input-field full-width" id="j-done" placeholder="Document your progress...">${todayJournal ? this.escapeHTML(todayJournal.done) : ''}</textarea>
                        
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">遇到什麼問題 (What issues occurred?)</label>
                        <textarea class="input-field full-width" id="j-issues" placeholder="Blockers and challenges...">${todayJournal ? this.escapeHTML(todayJournal.issues) : ''}</textarea>
                        
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">新的想法 (New ideas/insights)</label>
                        <textarea class="input-field full-width" id="j-ideas" placeholder="Sparks of inspiration...">${todayJournal ? this.escapeHTML(todayJournal.ideas) : ''}</textarea>
                        
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">明天要做什麼 (Plan for tomorrow)</label>
                        <textarea class="input-field full-width" id="j-plan" placeholder="Set your intentions...">${todayJournal ? this.escapeHTML(todayJournal.plan) : ''}</textarea>
                        
                        <button class="btn-primary" id="save-journal-btn" style="margin-top: 16px;">Save Journal</button>
                    </div>
                </div>
                <div class="panel">
                    <h3><i class="ph ph-history"></i> History</h3>
                    <div style="margin-top: 16px; color: var(--text-tertiary); font-size: 0.9rem;">
                        ${journals.length > 0 ? journals.map(j => `<div style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">${j.date}</div>`).join('') : 'No previous entries.'}
                    </div>
                </div>
            </div>
        `;
    }

    // --- Weekly Review View ---
    async renderReview() {
        return `
            <div class="page-header">
                <h1>Weekly Review</h1>
                <p>Evaluate your week, identify bottlenecks, and improve.</p>
            </div>
            <div class="panel">
                <div class="form-row">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">本週完成 (Accomplishments)</label>
                        <textarea class="input-field full-width" style="min-height: 120px;"></textarea>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">未完成與原因 (Missed & Why)</label>
                        <textarea class="input-field full-width" style="min-height: 120px;"></textarea>
                    </div>
                </div>
                <label style="display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.9rem;">改善方案 (Actionable Improvements)</label>
                <textarea class="input-field full-width"></textarea>
                
                <button class="btn-primary" style="margin-top: 16px;">Submit Review</button>
            </div>
        `;
    }

    // --- Placeholder Views (Timeline, Calendar, Statistics) ---
    async renderTimeline() {
        return `
            <div class="page-header"><h1>Timeline & Gantt</h1><p>Visualize project schedules across multiple layers.</p></div>
            <div class="panel" style="height: 400px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); border: 1px dashed var(--border-color);">
                <span style="color: var(--text-tertiary);"><i class="ph ph-chart-bar" style="font-size: 2rem; display: block; text-align: center; margin-bottom: 8px;"></i> Gantt Chart Component will be rendered here.</span>
            </div>
        `;
    }

    async renderCalendar() {
        return `
            <div class="page-header"><h1>Calendar</h1><p>Month, Week, and Day views for all deadlines.</p></div>
            <div class="panel" style="height: 500px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); border: 1px dashed var(--border-color);">
                <span style="color: var(--text-tertiary);"><i class="ph ph-calendar-blank" style="font-size: 2rem; display: block; text-align: center; margin-bottom: 8px;"></i> Calendar Component will be rendered here.</span>
            </div>
        `;
    }

    async renderStatistics() {
        return `
            <div class="page-header"><h1>Statistics & Insights</h1><p>Data-driven analysis of your performance.</p></div>
            <div class="dashboard-grid">
                <div class="metric-card"><span class="metric-title">完成率 (Completion Rate)</span><span class="metric-value">--%</span></div>
                <div class="metric-card"><span class="metric-title">延期率 (Delay Rate)</span><span class="metric-value">--%</span></div>
                <div class="metric-card"><span class="metric-title">平均完成時間 (Avg Time)</span><span class="metric-value">-- days</span></div>
            </div>
            <div class="panel" style="height: 300px; display: flex; align-items: center; justify-content: center; background: var(--bg-secondary); border: 1px dashed var(--border-color);">
                <span style="color: var(--text-tertiary);">Burndown Chart & Velocity Graph Placeholder</span>
            </div>
        `;
    }

    /* =========================================================================
       5. Utilities & View Specific Events
    ========================================================================= */
    bindViewSpecificEvents(viewName) {
        if (viewName === 'journal') {
            const saveBtn = document.getElementById('save-journal-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const date = new Date().toISOString().split('T')[0];
                    const entry = {
                        date: date,
                        done: document.getElementById('j-done').value,
                        issues: document.getElementById('j-issues').value,
                        ideas: document.getElementById('j-ideas').value,
                        plan: document.getElementById('j-plan').value,
                    };
                    
                    const journals = await this.db.getCollection('journals');
                    const existingIndex = journals.findIndex(j => j.date === date);
                    
                    if (existingIndex >= 0) {
                        journals[existingIndex] = { ...journals[existingIndex], ...entry, updatedAt: new Date().toISOString() };
                        await this.db.saveCollection('journals', journals);
                    } else {
                        await this.db.addItem('journals', entry);
                    }
                    
                    alert('Journal saved successfully!');
                    this.loadView('journal');
                });
            }
        }
        
        if (viewName === 'projects') {
            const newProjBtn = document.getElementById('new-project-btn');
            if (newProjBtn) {
                newProjBtn.addEventListener('click', async () => {
                    const title = prompt("Enter Project Name:");
                    if (title) {
                        await this.db.addItem('projects', {
                            title: title,
                            status: 'Not Started',
                            progress: 0,
                            color: '#5e6ad2' // 預設顏色
                        });
                        this.loadView('projects');
                    }
                });
            }
        }
    }

    escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
}

// =========================================================================
// 系統啟動進入點
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
    window.app.init();
});
