document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const todoInput = document.getElementById('todo-input');
    const categorySelect = document.getElementById('category-select');
    const addBtn = document.getElementById('add-btn');
    const todoList = document.getElementById('todo-list');
    const filterCategory = document.getElementById('filter-category');
    const sortBy = document.getElementById('sort-by');
    const sortOrder = document.getElementById('sort-order');
    const storageStatus = document.getElementById('storage-status');
    const storageInfo = document.getElementById('storage-info');

    // 检查本地存储支持
    let db;
    const dbName = 'TodoDB';
    const dbVersion = 2; // 增加版本号以支持分类存储
    let isStorageSupported = false;
    let categories = ['default', 'work', 'personal', 'study', 'other']; // 默认分类
    const categoryNames = {
        'default': '默认',
        'work': '工作',
        'personal': '个人',
        'study': '学习',
        'other': '其他'
    };

    // 初始化数据库
    function initDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                storageStatus.textContent = '本地存储不支持';
                storageStatus.className = 'status status-error';
                storageInfo.textContent = '您的浏览器不支持 IndexedDB，数据将不会被持久化保存。';
                resolve(false);
                return;
            }

            const request = indexedDB.open(dbName, dbVersion);

            request.onerror = function(event) {
                console.error('数据库错误:', event.target.error);
                storageStatus.textContent = '本地存储初始化失败';
                storageStatus.className = 'status status-error';
                storageInfo.textContent = '无法初始化 IndexedDB，数据将不会被持久化保存。错误: ' + (event.target.error ? event.target.error.message : '未知错误');
                resolve(false);
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                isStorageSupported = true;
                storageStatus.textContent = '本地存储已启用';
                storageStatus.className = 'status status-success';
                storageInfo.textContent = '数据存储在浏览器的 IndexedDB 中，不会上传到任何服务器。';

                // 加载分类
                loadCategories();
                resolve(true);
            };

            request.onupgradeneeded = function(event) {
                db = event.target.result;
                
                // 检查并创建待办事项存储
                if (!db.objectStoreNames.contains('todos')) {
                    const todoObjectStore = db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
                    todoObjectStore.createIndex('category', 'category', { unique: false });
                    todoObjectStore.createIndex('completed', 'completed', { unique: false });
                    todoObjectStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                    todoObjectStore.createIndex('priority', 'priority', { unique: false });
                }

                // 创建分类存储
                if (!db.objectStoreNames.contains('categories')) {
                    const categoryObjectStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                    categoryObjectStore.createIndex('name', 'name', { unique: true });
                    categoryObjectStore.createIndex('slug', 'slug', { unique: true });

                    // 添加默认分类
                    const defaultCategories = [
                        { name: '默认', slug: 'default' },
                        { name: '工作', slug: 'work' },
                        { name: '个人', slug: 'personal' },
                        { name: '学习', slug: 'study' },
                        { name: '其他', slug: 'other' }
                    ];

                    defaultCategories.forEach(category => {
                        categoryObjectStore.add(category);
                    });
                }
            };
        });
    }

    // 加载分类
    function loadCategories() {
        if (!isStorageSupported) return;

        const transaction = db.transaction(['categories'], 'readonly');
        const objectStore = transaction.objectStore('categories');
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            const storedCategories = event.target.result;
            categories = [];
            storedCategories.forEach(category => {
                categories.push(category.slug);
                categoryNames[category.slug] = category.name;
            });

            console.log('Loaded categories:', categories);
            console.log('Category names:', categoryNames);

            // 确保DOM元素已加载
            if (categorySelect && filterCategory) {
                // 更新分类选择器
                updateCategorySelectors();
            } else {
                console.error('Category select elements not found');
                // 延迟重试
                setTimeout(updateCategorySelectors, 100);
            }
        };
    }

    // 添加新分类
    function addCategory(name) {
        if (!name.trim()) return;

        // 生成唯一标识符
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        if (isStorageSupported) {
            const transaction = db.transaction(['categories'], 'readwrite');
            const objectStore = transaction.objectStore('categories');

            // 检查分类是否已存在
            const index = objectStore.index('slug');
            const getRequest = index.get(slug);

            getRequest.onsuccess = function() {
                if (getRequest.result) {
                    alert('分类已存在');
                    return;
                }

                // 添加新分类
                const category = {
                    name: name,
                    slug: slug
                };

                const addRequest = objectStore.add(category);

                addRequest.onsuccess = function() {
                    categories.push(slug);
                    categoryNames[slug] = name;
                    updateCategorySelectors();
                };

                addRequest.onerror = function(event) {
                    console.error('添加分类错误:', event.target.error);
                    alert('添加分类失败: ' + event.target.error.message);
                };
            };
        }
    }

    // 更新分类选择器
    function updateCategorySelectors() {
        console.log('Updating category selectors');
        // 确保DOM元素存在
        if (!categorySelect || !filterCategory) {
            console.error('Category select elements not found');
            return;
        }

        // 更新添加待办的分类选择器
        categorySelect.innerHTML = '';
        categories.forEach(slug => {
            const option = document.createElement('option');
            option.value = slug;
            option.textContent = categoryNames[slug];
            categorySelect.appendChild(option);
        });

        // 更新筛选分类选择器
        filterCategory.innerHTML = '<option value="all">所有分类</option>';
        categories.forEach(slug => {
            const option = document.createElement('option');
            option.value = slug;
            option.textContent = categoryNames[slug];
            filterCategory.appendChild(option);
        });

        console.log('Category selectors updated successfully');
    }

    // 添加待办事项
    function addTodo() {
        const text = todoInput.value.trim();
        const category = categorySelect.value;

        if (!text) return;

        const todo = {
            text: text,
            category: category,
            completed: false,
            dateAdded: new Date().getTime(),
            priority: 'low'
        };

        if (isStorageSupported) {
            const transaction = db.transaction(['todos'], 'readwrite');
            const objectStore = transaction.objectStore('todos');
            const request = objectStore.add(todo);

            request.onsuccess = function() {
                todo.id = request.result;
                renderTodo(todo);
            };

            transaction.oncomplete = function() {
                console.log('事务已完成');
            };

            transaction.onerror = function(event) {
                console.error('事务错误:', event.target.error);
                alert('添加待办失败: ' + event.target.error.message);
            };
        } else {
            // 如果不支持存储，使用内存存储
            todo.id = Date.now();
            renderTodo(todo);
        }

        todoInput.value = '';
    }

    // 渲染单个待办事项
    function renderTodo(todo) {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.dataset.id = todo.id;
        li.dataset.category = todo.category;
        li.dataset.priority = todo.priority;
        li.dataset.dateAdded = todo.dateAdded;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', function() {
            toggleTodoStatus(todo.id, this.checked);
        });

        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text' + (todo.completed ? ' todo-completed' : '');
        textSpan.textContent = todo.text;

        const categorySpan = document.createElement('span');
        categorySpan.className = 'todo-category category-' + todo.category;
        categorySpan.textContent = getCategoryName(todo.category);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'todo-actions';

        const priorityBtn = document.createElement('button');
        priorityBtn.className = 'priority-btn' + (todo.priority === 'high' ? ' high' : '');
        priorityBtn.textContent = todo.priority === 'high' ? '★' : '☆';
        priorityBtn.title = todo.priority === 'high' ? '降低优先级' : '提高优先级';
        priorityBtn.addEventListener('click', function() {
            togglePriority(todo.id, todo.priority);
        });

        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-btn';
        shareBtn.textContent = '🔗';
        shareBtn.title = '分享';
        shareBtn.addEventListener('click', function() {
            shareTodo(todo);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = '删除';
        deleteBtn.addEventListener('click', function() {
            deleteTodo(todo.id);
        });

        actionsDiv.appendChild(priorityBtn);
        actionsDiv.appendChild(shareBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(checkbox);
        li.appendChild(textSpan);
        li.appendChild(categorySpan);
        li.appendChild(actionsDiv);

        todoList.appendChild(li);
    }

    // 获取分类名称
    function getCategoryName(category) {
        return categoryNames[category] || category;
    }

    // 切换待办事项状态
    function toggleTodoStatus(id, completed) {
        if (isStorageSupported) {
            const transaction = db.transaction(['todos'], 'readwrite');
            const objectStore = transaction.objectStore('todos');
            const request = objectStore.get(id);

            request.onsuccess = function() {
                const todo = request.result;
                todo.completed = completed;
                objectStore.put(todo);
            };
        }

        const li = document.querySelector(`.todo-item[data-id="${id}"]`);
        if (li) {
            const textSpan = li.querySelector('.todo-text');
            if (completed) {
                textSpan.classList.add('todo-completed');
            } else {
                textSpan.classList.remove('todo-completed');
            }
        }
    }

    // 切换优先级
    function togglePriority(id, currentPriority) {
        const newPriority = currentPriority === 'high' ? 'low' : 'high';

        if (isStorageSupported) {
            const transaction = db.transaction(['todos'], 'readwrite');
            const objectStore = transaction.objectStore('todos');
            const request = objectStore.get(id);

            request.onsuccess = function() {
                const todo = request.result;
                todo.priority = newPriority;
                objectStore.put(todo);
            };
        }

        const li = document.querySelector(`.todo-item[data-id="${id}"]`);
        if (li) {
            li.dataset.priority = newPriority;
            const priorityBtn = li.querySelector('.priority-btn');
            if (newPriority === 'high') {
                priorityBtn.classList.add('high');
                priorityBtn.textContent = '★';
                priorityBtn.title = '降低优先级';
            } else {
                priorityBtn.classList.remove('high');
                priorityBtn.textContent = '☆';
                priorityBtn.title = '提高优先级';
            }
        }
    }

    // 删除待办事项
    function deleteTodo(id) {
        if (isStorageSupported) {
            const transaction = db.transaction(['todos'], 'readwrite');
            const objectStore = transaction.objectStore('todos');
            const request = objectStore.delete(id);

            transaction.oncomplete = function() {
                displayTodos();
            };
        } else {
            const li = document.querySelector(`.todo-item[data-id="${id}"]`);
            if (li) {
                li.remove();
            }
        }
    }

    // 显示所有待办事项
    function displayTodos() {
        todoList.innerHTML = '';

        if (!isStorageSupported) {
            // 如果不支持存储，无法获取数据
            return;
        }

        const transaction = db.transaction(['todos'], 'readonly');
        const objectStore = transaction.objectStore('todos');
        const request = objectStore.getAll();

        request.onsuccess = function(event) {
            let todos = event.target.result;

            // 应用筛选
            const categoryFilter = filterCategory.value;
            if (categoryFilter !== 'all') {
                todos = todos.filter(todo => todo.category === categoryFilter);
            }

            // 应用排序
            const sortByValue = sortBy.value;
            const sortOrderValue = sortOrder.value;

            todos.sort(function(a, b) {
                if (sortByValue === 'date-added') {
                    return sortOrderValue === 'asc' ? a.dateAdded - b.dateAdded : b.dateAdded - a.dateAdded;
                } else if (sortByValue === 'priority') {
                    // 高优先级在前
                    if (a.priority === b.priority) return 0;
                    return sortOrderValue === 'asc' ?
                        (a.priority === 'high' ? -1 : 1) :
                        (a.priority === 'high' ? 1 : -1);
                } else if (sortByValue === 'alphabetical') {
                    return sortOrderValue === 'asc' ?
                        a.text.localeCompare(b.text) :
                        b.text.localeCompare(a.text);
                }
                return 0;
            });

            // 渲染排序后的待办事项
            todos.forEach(todo => {
                renderTodo(todo);
            });
        };
    }

    // 分享待办事项
    function shareTodo(todo) {
        // 创建分享链接
        const shareData = {
            id: todo.id,
            text: todo.text,
            category: todo.category,
            completed: todo.completed,
            dateAdded: todo.dateAdded
        };

        const shareString = JSON.stringify(shareData);
        const encodedShareString = encodeURIComponent(shareString);
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodedShareString}`;

        // 创建分享弹窗
        let modal = document.querySelector('.share-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'share-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>分享待办事项</h3>
                    <input type="text" id="share-link" readonly>
                    <div>
                        <button class="close-btn">关闭</button>
                        <button class="copy-btn">复制链接</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // 添加事件监听
            modal.querySelector('.close-btn').addEventListener('click', function() {
                modal.style.display = 'none';
            });

            modal.querySelector('.copy-btn').addEventListener('click', function() {
                const shareLinkInput = document.getElementById('share-link');
                shareLinkInput.select();
                document.execCommand('copy');
                this.textContent = '已复制!';
                setTimeout(() => {
                    this.textContent = '复制链接';
                }, 2000);
            });

            // 点击模态框外部关闭
            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // 设置分享链接
        document.getElementById('share-link').value = shareUrl;

        // 显示弹窗
        modal.style.display = 'flex';
    }

    // 处理分享链接
    function handleShareLink() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareParam = urlParams.get('share');

        if (shareParam) {
            try {
                const decodedShareParam = decodeURIComponent(shareParam);
                const sharedTodo = JSON.parse(decodedShareParam);

                // 隐藏待办应用，显示分享的待办事项
                document.getElementById('todo-app').style.display = 'none';
                document.querySelector('.instructions').style.display = 'none';

                // 格式化日期
                const date = new Date(sharedTodo.dateAdded);
                const formattedDate = date.toLocaleString();

                // 创建分享视图
                const shareView = document.createElement('div');
                shareView.className = 'share-view';
                shareView.innerHTML = `
                    <h2>分享的待办事项</h2>
                    <div class="todo-item">
                        <input type="checkbox" ${sharedTodo.completed ? 'checked' : ''} disabled>
                        <span class="todo-text ${sharedTodo.completed ? 'todo-completed' : ''}">${sharedTodo.text}</span>
                        <span class="todo-category category-${sharedTodo.category}">${getCategoryName(sharedTodo.category)}</span>
                    </div>
                    <p>添加时间: ${formattedDate}</p>
                    <a href="${window.location.origin}${window.location.pathname}">返回待办应用</a>
                `;

                document.querySelector('main').appendChild(shareView);
            } catch (e) {
                console.error('解析分享链接失败:', e);
            }
        }
    }

    // 事件监听
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    filterCategory.addEventListener('change', displayTodos);
    sortBy.addEventListener('change', displayTodos);
    sortOrder.addEventListener('change', displayTodos);

    // 分类模态框相关元素
    const categoryModal = document.getElementById('category-modal');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const cancelCategoryBtn = document.getElementById('cancel-category-btn');
    const confirmCategoryBtn = document.getElementById('confirm-category-btn');
    const newCategoryInput = document.getElementById('new-category-input');

    // 打开分类模态框
    addCategoryBtn.addEventListener('click', function() {
        categoryModal.style.display = 'flex';
        newCategoryInput.value = '';
        newCategoryInput.focus();
    });

    // 关闭分类模态框
    cancelCategoryBtn.addEventListener('click', function() {
        categoryModal.style.display = 'none';
    });

    // 确认添加新分类
    confirmCategoryBtn.addEventListener('click', function() {
        const categoryName = newCategoryInput.value.trim();
        if (categoryName) {
            addCategory(categoryName);
            categoryModal.style.display = 'none';
        } else {
            alert('请输入分类名称');
        }
    });

    // 按Enter键确认添加分类
    newCategoryInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            confirmCategoryBtn.click();
        }
    });

    // 点击模态框外部关闭
    categoryModal.addEventListener('click', function(event) {
        if (event.target === categoryModal) {
            categoryModal.style.display = 'none';
        }
    });

    // 初始化
    async function init() {
        const storageSupported = await initDB();
        if (storageSupported) {
            displayTodos();
        }
        handleShareLink();
    }

    init();
});