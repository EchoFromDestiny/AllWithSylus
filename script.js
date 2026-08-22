let allData = null;
let currentPath = []; // 当前导航路径
let savedScrollPosition = 0;//保存滚动位置
let isAppReady = false;
let preloadedArticle = null;
let preloadedFilePath = null;

// ========== 背景图预加载 ==========
function preloadBackgroundImage(url) {
    return new Promise((resolve, reject) => {
        if (!url) {
            resolve(); // 没有背景图，直接跳过
            return;
        }
        const img = new Image();
        img.onload = function() {
            resolve();
        };
        img.onerror = function() {
            // 加载失败也继续，不阻塞页面
            resolve();
        };
        img.src = url;
    });
}

// ========== 获取当前选中的背景图 URL ==========
function getSelectedBgUrl() {
    try {
        const savedKey = localStorage.getItem('selectedBg');
        if (savedKey) {
            const found = BG_LIST.find(item => item.key === savedKey);
            if (found && found.image) {
                return found.image;
            }
        }
    } catch(e) { /* 忽略 */ }
    return null;
}

// ========== 预加载文章内容（提前拉取，点击时秒开） ==========
async function preloadArticle(filePath) {
    // 如果已经预加载了同一篇文章，跳过
    if (preloadedFilePath === filePath && preloadedArticle !== null) {
        return;
    }
    
    try {
        const res = await fetch(filePath);
        const markdown = await res.text();
        preloadedArticle = markdown;
        preloadedFilePath = filePath;
        console.log('📄 文章已预加载:', filePath);
    } catch(e) {
        console.warn('预加载文章失败:', e);
        preloadedArticle = null;
        preloadedFilePath = null;
    }
}

// ========== 获取当前层级的第一篇文章 ==========
function getFirstArticleInCurrentLevel() {
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
    
    // 提取所有文章
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
    return articles.length > 0 ? articles[0] : null;
}

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
    // ========== 列表渲染完成后，预加载第一篇文章 ==========
    setTimeout(() => {
        const firstArticle = getFirstArticleInCurrentLevel();
        if (firstArticle && firstArticle.file) {
            preloadArticle(firstArticle.file);
        }
    }, 300); // 延迟 300ms，让列表先渲染出来
    // ========== 预加载结束 ==========
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
        savedScrollPosition = window.scrollY;//记录滚动位置
        loadAndShowArticle(item.file);
    });

    return div;
}

// 加载并显示文章
async function loadAndShowArticle(filePath) {
    //进入文章滚动至顶部
    window.scrollTo(0,0);
    // ========== 显示加载提示，隐藏正文 ==========
    const loadingEl = document.getElementById('loading-placeholder');
    const articleBody = document.getElementById('article-body');
    const postNavBottom = document.getElementById('post-nav-bottom');
    
    loadingEl.style.display = 'flex';
    articleBody.style.display = 'none';
    postNavBottom.style.display = 'none';

    // ========== 优先使用预加载的内容 ==========
    let markdown;
    if (preloadedFilePath === filePath && preloadedArticle !== null) {
        // 命中缓存！直接使用预加载的内容
        markdown = preloadedArticle;
        console.log('文章从缓存加载:', filePath);
    } else {
        // 没有缓存，正常请求
        const res = await fetch(filePath);
        markdown = await res.text();
        console.log('文章从网络加载:', filePath);
    }
    // ========== 预加载结束 ==========

    let lines = markdown.split('\n');
    let html = '';
    let prevLineWasEmpty = false;

    lines.forEach((line, index) => {
        let trimmed = line.trim();
        let content = line;  // 保留原始行内容（含缩进空格）

        // 跳过空行
        if (trimmed === '') {
            prevLineWasEmpty = true;
            return;
        }

        // 处理标题（# 开头）
        if (trimmed.match(/^# /)) {
            html += trimmed.replace(/^# (.*$)/, '<h1>$1</h1>\n');
            prevLineWasEmpty = false;
            return;
        }
        if (trimmed.match(/^## /)) {
            html += trimmed.replace(/^## (.*$)/, '<h2>$1</h2>\n');
            prevLineWasEmpty = false;
            return;
        }

        // 处理列表（- 开头）
        if (trimmed.match(/^- /)) {
            html += trimmed.replace(/^- (.*$)/, '<li>$1</li>\n');
            prevLineWasEmpty = false;
            return;
        }

        // 处理分隔线（--- 单独一行）
        if (trimmed === '---') {
            html += '<hr>\n';
            prevLineWasEmpty = false;
            return;
        }

        // 判断是否为题记（只识别以破折号开头的行，或明确包含"题记"关键词的行）
        const isEpigraph = trimmed.match(/^[—\-–]/) ||          // 以破折号开头
                           trimmed.match(/^——\s*题记/) ||         // 以"——题记"开头
                           trimmed === '——题记' ||                 // 精确匹配"——题记"
                           trimmed === '—— 题记';                  // 精确匹配"—— 题记"
        
        if (isEpigraph) {
            let contentWithFormat = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
            html += `<p class="epigraph">${contentWithFormat}</p>\n`;
            prevLineWasEmpty = false;
            return;
        }

        //判断空行间距
        if(prevLineWasEmpty){
            html += `<p class="keep-indent">${contentWithFormat}</p>\n`;
        } else {
            // 没有空行：紧凑段落（适合小说里的自然分段）
            html += `<p class="keep-indent compact">${contentWithFormat}</p>\n`;
        }
        
        prevLineWasEmpty = false;
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
    if (currentIndex < articles.length - 1) {
        const nextArticle = articles[currentIndex + 1];
        nextBtn.textContent = nextArticle.name + ' →';
        nextBtn.className = 'nav-btn';
        nextBtn.onclick = function() {
            loadAndShowArticle(nextArticle.file);
        };
        // ========== 预加载下一篇 ==========
        preloadArticle(nextArticle.file);
        // ========== 预加载结束 ==========
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
    //恢复滚动位置
    window.scrollTo({ top: savedScrollPosition, behavior: 'instant'});
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

// ========== 预设背景库（8 张你自己的图） ==========
// 把 bg1.jpg ~ bg8.jpg 放在 images/ 文件夹里
const BG_LIST = [
    { key: 'default', label: '默认', thumb: '', image: '' },
    { key: 'bg1', label: '时锢之钥', thumb: 'images/bg1.jpg', image: 'images/bg1.jpg' },
    { key: 'bg2', label: '万象遇你', thumb: 'images/bg2.jpg', image: 'images/bg2.jpg' },
    { key: 'bg3', label: '昔日掠影', thumb: 'images/bg3.jpg', image: 'images/bg3.jpg' },
    { key: 'bg4', label: 'Bedge 1', thumb: 'images/bg4.PNG', image: 'images/bg4.PNG' },
    { key: 'bg5', label: 'Bedge 2', thumb: 'images/bg5.PNG', image: 'images/bg5.PNG' },
    { key: 'bg6', label: 'Bedge 3', thumb: 'images/bg6.PNG', image: 'images/bg6.PNG' },
    { key: 'bg7', label: '五花八们', thumb: 'images/bg7.jpg', image: 'images/bg7.jpg' },
    { key: 'bg8', label: '天放', thumb: 'images/bg8.jpg', image: 'images/bg8.jpg' },
];

// ========== DOM 元素 ==========
const themeToggle = document.getElementById('theme-toggle');
const themePanel = document.getElementById('theme-panel');
const panelOverlay = document.getElementById('panel-overlay');
const panelClose = document.getElementById('panel-close');
const bgGrid = document.getElementById('bg-grid');
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value-panel');
const postContent = document.getElementById('post-content');

// ========== 生成背景选项 ==========
let currentBgKey = 'default';

// ========== 生成背景选项（懒加载小图） ==========
function renderBgOptions() {
    bgGrid.innerHTML = '';
    BG_LIST.forEach(item => {
        const div = document.createElement('div');
        div.className = 'bg-option';
        div.setAttribute('data-bg', item.key);
        
        // 小图预览（懒加载）
        const thumb = document.createElement('div');
        thumb.className = 'bg-thumb';
        thumb.setAttribute('data-src', item.thumb || '');
        
        // 默认背景显示灰色占位
        if (!item.thumb) {
            thumb.style.background = '#f0f0f0';
            thumb.style.border = '2px solid #ddd';
        } else {
            // 占位色，等滚动到可见区域再加载真实图片
            thumb.style.background = '#e8e8e8';
            thumb.dataset.loaded = 'false';
        }
        
        const label = document.createElement('span');
        label.textContent = item.label;
        
        div.appendChild(thumb);
        div.appendChild(label);
        
        div.addEventListener('click', function() {
            selectBg(item.key);
        });
        
        bgGrid.appendChild(div);
    });
    
    // 启动懒加载监听
    setupLazyLoading();
}

// ========== 懒加载：只加载可见区域的小图 ==========
function setupLazyLoading() {
    // 使用 Intersection Observer API
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const thumb = entry.target;
                    const src = thumb.dataset.src;
                    if (src && thumb.dataset.loaded === 'false') {
                        thumb.style.backgroundImage = `url('${src}')`;
                        thumb.dataset.loaded = 'true';
                    }
                    observer.unobserve(thumb);
                }
            });
        }, {
            rootMargin: '50px',  // 提前50px开始加载
            threshold: 0.01
        });
        
        document.querySelectorAll('.bg-thumb[data-src]').forEach(thumb => {
            observer.observe(thumb);
        });
    } else {
        // 浏览器不支持 Intersection Observer，直接全部加载
        document.querySelectorAll('.bg-thumb[data-src]').forEach(thumb => {
            const src = thumb.dataset.src;
            if (src) {
                thumb.style.backgroundImage = `url('${src}')`;
            }
        });
    }
}

// ========== 选择背景（优先加载选中的图） ==========
async function selectBg(key) {
    currentBgKey = key;
    const selected = BG_LIST.find(item => item.key === key);
    
    // 更新高亮
    document.querySelectorAll('.bg-option').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-bg') === key);
    });
    
    if (selected && selected.image) {
        // 先预加载背景图
        await preloadBackgroundImage(selected.image);
        
        // 预加载完成后，再显示
        document.body.style.backgroundImage = `url('${selected.image}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.classList.add('bg-image');
        
        // 预加载当前选中的小图
        const thumbs = document.querySelectorAll('.bg-thumb');
        thumbs.forEach(thumb => {
            const parent = thumb.closest('.bg-option');
            if (parent && parent.getAttribute('data-bg') === key) {
                if (thumb.dataset.loaded === 'false' && selected.thumb) {
                    thumb.style.backgroundImage = `url('${selected.thumb}')`;
                    thumb.dataset.loaded = 'true';
                }
            }
        });
    } else {
        // 默认背景
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundAttachment = '';
        document.body.style.backgroundRepeat = '';
        document.body.classList.remove('bg-image');
    }
    
    try {
        localStorage.setItem('selectedBg', key);
    } catch(e) { /* 忽略 */ }
}

// ========== 打开/关闭面板 ==========
function openPanel() {
    themePanel.style.display = 'block';
    panelOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // 延迟一下，让面板渲染完成后再触发加载
    setTimeout(() => {
        // 强制加载当前可见的小图
        const visibleThumbs = document.querySelectorAll('.bg-thumb[data-src]');
        visibleThumbs.forEach(thumb => {
            const rect = thumb.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const src = thumb.dataset.src;
                if (src && thumb.dataset.loaded === 'false') {
                    thumb.style.backgroundImage = `url('${src}')`;
                    thumb.dataset.loaded = 'true';
                }
            }
        });
    }, 100);
}
function closePanel() {
    themePanel.style.display = 'none';
    panelOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

themeToggle.addEventListener('click', openPanel);
panelClose.addEventListener('click', closePanel);
panelOverlay.addEventListener('click', closePanel);

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePanel();
});

// ========== 透明度控制 ==========
opacitySlider.addEventListener('input', function() {
    const val = this.value;
    opacityValue.textContent = val + '%';
    postContent.style.backgroundColor = `rgba(255, 255, 255, ${val / 100})`;
    try {
        localStorage.setItem('contentOpacity', val);
    } catch(e) { /* 忽略 */ }
});

// ========== 加载保存的设置 ==========
function loadSavedSettings() {
    // 加载背景
    try {
        const savedKey = localStorage.getItem('selectedBg');
        if (savedKey && BG_LIST.some(item => item.key === savedKey)) {
            document.body.style.backgroundColor = '#f5f5f5';
            selectBg(savedKey);
        }
        else
        {
            selectBg('default');
        }
    } catch(e) { /* 忽略 */ }
    
    // 加载透明度
    try {
        const savedOpacity = localStorage.getItem('contentOpacity');
        if (savedOpacity) {
            const val = parseInt(savedOpacity);
            opacitySlider.value = val;
            opacityValue.textContent = val + '%';
            postContent.style.backgroundColor = `rgba(255, 255, 255, ${val / 100})`;
        }
    } catch(e) { /* 忽略 */ }
}

// ========== 初始化 ==========
renderBgOptions();

// 初始化（按优先级加载）
async function init() {
    // ========== 第一步：立即加载并显示背景图 ==========
    const bgUrl = getSelectedBgUrl() || 'images/bg.jpg'; // 如果没有保存，用默认背景
    
    if (bgUrl) {
        // 先设置背景占位，让用户知道在加载
        document.body.style.backgroundImage = `url('${bgUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.classList.add('bg-image');
        
        // 预加载背景图（确保渲染完成）
        await preloadBackgroundImage(bgUrl);
    }
    
    // ========== 第二步：加载文章数据 ==========
    await loadData();
    
    // ========== 第三步：渲染页面 ==========
    currentPath = [];
    renderTree([]);

    document.getElementById('home-btn').addEventListener('click', function() {
        currentPath = [];
        renderTree([]);
        window.scrollTo({ top: savedScrollPosition, behavior: 'instant' });
    });

    document.getElementById('back-to-level').addEventListener('click', function() {
        document.getElementById('tree-container').style.display = 'block';
        document.getElementById('search').style.display = 'block';
        document.getElementById('breadcrumb').style.display = 'block';
        document.getElementById('post-content').style.display = 'none';
        const targetPath = window.currentLevelPath || [];
        currentPath = targetPath;
        renderTree(targetPath);
        window.scrollTo({ top: savedScrollPosition, behavior: 'instant' });
    });

    // 自动更新版权年份
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // 加载保存的设置（透明度等）
    loadSavedSettings();
}

init();

// ========== 键盘左右键翻页 ==========
document.addEventListener('keydown', function(e) {
    // 只在文章阅读模式下生效（文章正文可见）
    const postContent = document.getElementById('post-content');
    if (postContent.style.display !== 'block') {
        return; // 不在文章页面，不处理
    }
    
    // 如果用户在输入框里打字，不触发翻页
    const tagName = document.activeElement.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return;
    }
    
    // 左箭头 ← 上一篇
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevBtn = document.getElementById('prev-article');
        // 如果按钮不是 disabled 状态，触发点击
        if (!prevBtn.classList.contains('disabled')) {
            prevBtn.click();
        }
    }
    
    // 右箭头 → 下一篇
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextBtn = document.getElementById('next-article');
        if (!nextBtn.classList.contains('disabled')) {
            nextBtn.click();
        }
    }
});

// ========== Ctrl + K 快速聚焦搜索框 ==========
document.addEventListener('keydown', function(e) {
    // Ctrl+K 或 Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search');
        // 只有在列表页面（搜索框可见）时才聚焦
        if (searchInput.style.display !== 'none') {
            searchInput.focus();
            searchInput.select();
        }
    }
});
