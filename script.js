let allData = null;
let currentPath = []; // 当前导航路径

// 加载数据
async function loadData() {
    const res = await fetch('posts.json');
    allData = await res.json();
    return allData;
}

// 渲染树（根据当前路径）
function renderTree(path) {
    // 保存当前路径，供返回上一级使用
    window.currentLevelPath = path;

    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    // 找到当前层级的数据
    let currentLevel = allData.categories;
    let breadcrumbText = '首页';

    if (path.length > 0) {
        let temp = allData.categories;
        for (let i = 0; i < path.length; i++) {
            const found = temp.find(item => item.name === path[i]);
            if (found && found.children) {
                temp = found.children;
                breadcrumbText += ' / ' + path[i];
            } else {
                path = [];
                currentLevel = allData.categories;
                breadcrumbText = '首页';
                break;
            }
        }
        if (path.length > 0) {
            currentLevel = temp;
        }
    }

    // 更新面包屑（每一级都可点击返回）
    const homeBtn = document.getElementById('home-btn');
    const pathSpan = document.getElementById('breadcrumb-path');

    if (path.length === 0) {
        pathSpan.innerHTML = '';
    } else {
        let html = '';
        path.forEach((name, index) => {
            const targetPath = path.slice(0, index + 1);
            html += ` / <span class="breadcrumb-link" data-path="${targetPath.join(',')}">${name}</span>`;
        });
        pathSpan.innerHTML = html;

        document.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', function() {
                const pathStr = this.getAttribute('data-path');
                const targetPath = pathStr ? pathStr.split(',') : [];
                currentPath = targetPath;
                renderTree(targetPath);
            });
        });
    }

    // 如果当前层级是文章列表（没有 children 或 children 都是文件）
    const hasFolder = currentLevel.some(item => item.children);
    const hasFile = currentLevel.some(item => item.file);

    if (hasFile && !hasFolder) {
        currentLevel.forEach(item => {
            if (item.file) {
                const div = createFileItem(item);
                container.appendChild(div);
            }
        });
    } else {
        currentLevel.forEach(item => {
            if (item.children) {
                const div = createFolderItem(item, path);
                container.appendChild(div);
            } else if (item.file) {
                const div = createFileItem(item);
                container.appendChild(div);
            }
        });
    }
}

// 创建文件夹/分类元素
function createFolderItem(item, parentPath) {
    const div = document.createElement('div');
    div.className = 'tree-item folder';

    const isRootCategory = parentPath.length === 0;
    const icon = item.icon || (isRootCategory ? '📁' : '📂');

    div.innerHTML = `
        <span class="file-icon">${icon}</span>
        <span style="font-weight:600;">${item.name}</span>
        <span class="post-date">${item.children ? item.children.length : 0} 篇</span>
    `;

    div.addEventListener('click', () => {
        const newPath = [...parentPath, item.name];
        currentPath = newPath;
        renderTree(newPath);
    });

    return div;
}

// 创建文章元素
function createFileItem(item) {
    const div = document.createElement('div');
    div.className = 'tree-item';
    div.innerHTML = `
        <span class="file-icon">📄</span>
        <span>${item.name}</span>
        <span class="post-date">${item.date || ''}</span>
    `;

    div.addEventListener('click', () => {
        loadAndShowArticle(item.file);
    });

    return div;
}

// 加载并显示文章
async function loadAndShowArticle(filePath) {
    // ========== 显示加载提示，隐藏正文 ==========
    const loadingEl = document.getElementById('loading-placeholder');
    const articleBody = document.getElementById('article-body');
    const postNavBottom = document.getElementById('post-nav-bottom');
    
    loadingEl.style.display = 'block';
    articleBody.style.display = 'none';
    postNavBottom.style.display = 'none';

    //实际显示正文
    const res = await fetch(filePath);
    const markdown = await res.text();

    let lines = markdown.split('\n');
    let html = '';

    lines.forEach(line => {
        let trimmed = line.trim();

        if (trimmed === '') {
            return;
        }

        if (trimmed.match(/^# /)) {
            html += trimmed.replace(/^# (.*$)/, '<h1>$1</h1>\n');
            return;
        }
        if (trimmed.match(/^## /)) {
            html += trimmed.replace(/^## (.*$)/, '<h2>$1</h2>\n');
            return;
        }

        if (trimmed.match(/^- /)) {
            html += trimmed.replace(/^- (.*$)/, '<li>$1</li>\n');
            return;
        }

        if (trimmed === '---') {
            html += '<hr>\n';
            return;
        }

        let content = line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        html += '<p>' + content + '</p>\n';
    });

    //隐藏加载提示，显示正文
    loadingEl.style.display = 'none';
    articleBody.style.display = 'block';
    postNavBottom.style.display = 'flex';
    //隐藏结束
    
    document.getElementById('tree-container').style.display = 'none';
    document.getElementById('search').style.display = 'none';
    document.getElementById('breadcrumb').style.display = 'block';
    document.getElementById('post-content').style.display = 'block';
    document.getElementById('article-body').innerHTML = html;

    updatePrevNext(filePath);
}

// 更新上一篇/下一篇按钮
function updatePrevNext(currentFile) {
    let currentLevel = allData.categories;
    let targetPath = window.currentLevelPath || [];

    if (targetPath.length > 0) {
        let temp = allData.categories;
        for (let i = 0; i < targetPath.length; i++) {
            const found = temp.find(item => item.name === targetPath[i]);
            if (found && found.children) {
                temp = found.children;
            } else {
                break;
            }
        }
        currentLevel = temp;
    }

    function getAllArticles(items) {
        let result = [];
        items.forEach(item => {
            if (item.file) {
                result.push(item);
            }
            if (item.children) {
                result = result.concat(getAllArticles(item.children));
            }
        });
        return result;
    }

    const articles = getAllArticles(currentLevel);
    const currentIndex = articles.findIndex(item => item.file === currentFile);

    const prevBtn = document.getElementById('prev-article');
    const nextBtn = document.getElementById('next-article');

    if (currentIndex > 0) {
        const prevArticle = articles[currentIndex - 1];
        prevBtn.textContent = '← ' + prevArticle.name;
        prevBtn.className = 'nav-btn';
        prevBtn.onclick = function() {
            loadAndShowArticle(prevArticle.file);
        };
    } else {
        prevBtn.textContent = '← 已是第一篇';
        prevBtn.className = 'nav-btn disabled';
        prevBtn.onclick = null;
    }

    if (currentIndex < articles.length - 1) {
        const nextArticle = articles[currentIndex + 1];
        nextBtn.textContent = nextArticle.name + ' →';
        nextBtn.className = 'nav-btn';
        nextBtn.onclick = function() {
            loadAndShowArticle(nextArticle.file);
        };
    } else {
        nextBtn.textContent = '已是最后一篇 →';
        nextBtn.className = 'nav-btn disabled';
        nextBtn.onclick = null;
    }
}

// 返回列表
document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('tree-container').style.display = 'block';
    document.getElementById('search').style.display = 'block';
    document.getElementById('breadcrumb').style.display = 'block';
    document.getElementById('post-content').style.display = 'none';
    const targetPath = window.currentLevelPath || [];
    currentPath = targetPath;
    renderTree(targetPath);
});

// 搜索功能（扁平化搜索所有文章）
function flattenTree(items, path = []) {
    let result = [];
    items.forEach(item => {
        if (item.file) {
            result.push({ ...item, path: [...path, item.name] });
        }
        if (item.children) {
            result = result.concat(flattenTree(item.children, [...path, item.name]));
        }
    });
    return result;
}

document.getElementById('search').addEventListener('input', function(e) {
    const keyword = e.target.value.trim();
    const container = document.getElementById('tree-container');
    container.innerHTML = '';

    if (!keyword) {
        renderTree(currentPath);
        return;
    }

    const allArticles = flattenTree(allData.categories);
    const filtered = allArticles.filter(item =>
        item.name.includes(keyword) || item.path.some(p => p.includes(keyword))
    );

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#888;padding:40px;">没有找到相关文章</div>';
        return;
    }

    filtered.forEach(item => {
        const div = createFileItem(item);
        const pathStr = item.path.slice(0, -1).join(' / ');
        div.innerHTML += `<span style="color:#999;font-size:12px;margin-left:8px;">(${pathStr})</span>`;
        container.appendChild(div);
    });
});

// 初始化
async function init() {
    await loadData();
    currentPath = [];
    renderTree([]);

    document.getElementById('home-btn').addEventListener('click', function() {
        currentPath = [];
        renderTree([]);
    });

    document.getElementById('back-to-level').addEventListener('click', function() {
        document.getElementById('tree-container').style.display = 'block';
        document.getElementById('search').style.display = 'block';
        document.getElementById('breadcrumb').style.display = 'block';
        document.getElementById('post-content').style.display = 'none';
        const targetPath = window.currentLevelPath || [];
        currentPath = targetPath;
        renderTree(targetPath);
    });

    // 自动更新版权年份
    document.getElementById('current-year').textContent = new Date().getFullYear();
}

init();
