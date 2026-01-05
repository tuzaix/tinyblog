const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
const multer = require('multer');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();

// Port configuration: Command line arg (--port=XXXX) or environment variable (PORT) or default 3001
const getPort = () => {
    // Check command line arguments like --port=4000
    const portArg = process.argv.find(arg => arg.startsWith('--port='));
    if (portArg) {
        return parseInt(portArg.split('=')[1]);
    }
    // Check simple command line argument like: node server.js 4000
    const simpleArg = process.argv[2];
    if (simpleArg && !isNaN(simpleArg)) {
        return parseInt(simpleArg);
    }
    // Fallback to ENV or default
    return process.env.PORT || 3001;
};

const PORT = getPort();

// Configure Multer for Image Upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Use a constant name to overwrite previous custom QR, but keep extension
        const ext = path.extname(file.originalname);
        cb(null, 'qr-custom' + ext);
    }
});
const upload = multer({ storage: storage });

// Configure Multer for Blog Image Uploads
const blogStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});
const uploadBlogImage = multer({ 
    storage: blogStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'my-secret-key-123',
    resave: false,
    saveUninitialized: true
}));

// Helper: Read JSON
const readJson = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return [];
        let data = fs.readFileSync(filePath, 'utf8');
        // Strip BOM if present
        if (data.charCodeAt(0) === 0xFEFF) {
            data = data.slice(1);
        }
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading JSON:', err);
        return [];
    }
};

// Helper: Write JSON
const writeJson = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ARTICLES_META_FILE = path.join(DATA_DIR, 'articles', 'metadata.json');
const CONTENT_DIR = path.join(DATA_DIR, 'content');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const ABOUT_FILE = path.join(DATA_DIR, 'about.md');
const GUIDE_FILE = path.join(__dirname, 'USER_GUIDE.md');
const PRIVACY_FILE = path.join(DATA_DIR, 'privacy.md');

// Helper: Generate Random Key
const generateKey = () => {
    return 'KM' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

// Middleware: Auth Check
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        return res.redirect('/login');
    }
};

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Routes Placeholder
app.get('/', (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    const allArticles = readJson(ARTICLES_META_FILE);
    const articles = allArticles.filter(a => !a.hidden);
    
    // Pagination Logic
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    
    // Validate params
    if (limit < 5) limit = 5;
    if (limit > 50) limit = 50;
    if (page < 1) page = 1;
    
    const total = articles.length;
    const totalPages = Math.ceil(total / limit);
    
    // Adjust page if out of bounds
    if (page > totalPages && total > 0) page = totalPages;
    
    const startIndex = (page - 1) * limit;
    const paginatedArticles = articles.slice(startIndex, startIndex + limit);

    // Get Hot Articles (Top 10 by views) - only visible ones
    const hotArticles = [...articles]
        .map(a => ({ ...a, views: a.views || 0 })) // Ensure views exists
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

    res.render('index', { 
        articles: paginatedArticles, 
        settings, 
        hotArticles,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    });
});

// Article Detail
app.get('/article/:id', (req, res) => {
    const articles = readJson(ARTICLES_META_FILE);
    const article = articles.find(a => a.id === req.params.id);
    const settings = readJson(SETTINGS_FILE);

    if (!article || article.hidden) return res.status(404).send('Article not found');
    
    // Increment views
    article.views = (article.views || 0) + 1;
    writeJson(ARTICLES_META_FILE, articles);
    
    // Check Lock Status
    // Default to locked unless globally disabled, article-specific disabled, or user has valid key
    let isLocked = true;
    let htmlContent = '';
    
    // 1. If verification disabled globally
    if (settings.enable_key_verification === false) {
        isLocked = false;
    } 
    // 2. If verification disabled for this specific article (default is true if undefined)
    else if (article.requiresKey === false) {
        isLocked = false;
    }
    // 3. Or if user already unlocked this article
    else if (req.headers.cookie && req.headers.cookie.includes(`unlocked_${article.id}=true`)) {
        isLocked = false;
    }

    if (!isLocked) {
        try {
            const contentMd = fs.readFileSync(path.join(CONTENT_DIR, article.id + '.md'), 'utf8');
            htmlContent = md.render(contentMd);
        } catch (e) {
            htmlContent = '<p>内容读取失败</p>';
        }
    }

    res.render('article', { article, settings, isLocked, htmlContent });
});

// About Page
app.get('/about', (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    let content = '';
    if (fs.existsSync(ABOUT_FILE)) {
        content = fs.readFileSync(ABOUT_FILE, 'utf8');
    }
    const htmlContent = md.render(content);
    res.render('about', { settings, content: htmlContent, title: '关于我们' });
});

// Privacy Policy Page
app.get('/privacy', (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    let content = '';
    if (fs.existsSync(PRIVACY_FILE)) {
        content = fs.readFileSync(PRIVACY_FILE, 'utf8');
    } else {
        content = '# 隐私政策\n\n本站非常重视您的隐私。目前本站仅记录基本的浏览器指纹用于卡密验证，不收集任何个人敏感信息。';
    }
    const htmlContent = md.render(content);
    res.render('about', { settings, content: htmlContent, title: '隐私政策' });
});

// Admin - Edit About
app.get('/admin/about', requireAuth, (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    let content = '';
    if (fs.existsSync(ABOUT_FILE)) {
        content = fs.readFileSync(ABOUT_FILE, 'utf8');
    }
    res.render('about_editor', { settings, content });
});

// Admin - View Guide
app.get('/admin/guide', requireAuth, (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    let content = '';
    if (fs.existsSync(GUIDE_FILE)) {
        content = fs.readFileSync(GUIDE_FILE, 'utf8');
    }
    const htmlContent = md.render(content);
    res.render('guide', { settings, content: htmlContent });
});

// Admin - Save About
app.post('/admin/about/save', requireAuth, (req, res) => {
    const content = req.body.content;
    fs.writeFileSync(ABOUT_FILE, content, 'utf8');
    res.redirect('/admin');
});

// Unlock API
app.post('/api/unlock', (req, res) => {
    const { article_id, key, fingerprint } = req.body;
    const keys = readJson(KEYS_FILE);
    const keyData = keys.find(k => k.code === key);
    
    if (!keyData) {
        return res.json({ success: false, message: '无效的卡密' });
    }
    
    const now = new Date();
    
    // Status Check
    if (keyData.status === 'expired') {
        return res.json({ success: false, message: '卡密已过期' });
    }
    
    // Fingerprint and Activation Logic
    const settings = readJson(SETTINGS_FILE);
    const maxDevices = settings.max_devices_per_key || 2;
    if (!keyData.fingerprints) keyData.fingerprints = [];

    if (keyData.status === 'unused') {
        // First time activation
        keyData.status = 'active';
        keyData.bound_article_id = article_id;
        keyData.activate_time = now.toISOString();
        if (fingerprint) keyData.fingerprints = [fingerprint]; // Record first device
        
        if (keyData.duration_hours !== -1) {
            const expireTime = new Date(now.getTime() + keyData.duration_hours * 60 * 60 * 1000);
            keyData.expire_time = expireTime.toISOString();
        }
        
        writeJson(KEYS_FILE, keys);
    } else if (keyData.status === 'active') {
        // Check Binding
        if (keyData.bound_article_id !== article_id) {
            return res.json({ success: false, message: '此卡密已绑定其他文章，请使用新卡密' });
        }
        
        // Check Fingerprint
        if (fingerprint && !keyData.fingerprints.includes(fingerprint)) {
            if (keyData.fingerprints.length < maxDevices) {
                // Allow binding a new device within limit
                keyData.fingerprints.push(fingerprint);
                writeJson(KEYS_FILE, keys);
                console.log(`Key ${key} bound to a new device. Total: ${keyData.fingerprints.length}`);
            } else {
                console.warn(`Device limit reached for key ${key}. Max: ${maxDevices}`);
                return res.json({ success: false, message: '此卡密已绑定其他设备，请使用新卡密' });
            }
        }
        
        // Check Expiration
        if (keyData.expire_time && new Date(keyData.expire_time) < now) {
            keyData.status = 'expired';
            writeJson(KEYS_FILE, keys);
            return res.json({ success: false, message: '卡密已过期' });
        }
    }
    
    // Auth Success: Read Content
    try {
        const contentMd = fs.readFileSync(path.join(CONTENT_DIR, article_id + '.md'), 'utf8');
        const contentHtml = md.render(contentMd);
        return res.json({ success: true, content: contentHtml });
    } catch (e) {
        return res.json({ success: false, message: '文章内容读取失败' });
    }
});

// --- ADMIN ROUTES ---

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { error: null, settings: readJson(SETTINGS_FILE) });
});

// Login Action
app.post('/login', (req, res) => {
    const { password, token } = req.body;
    const settings = readJson(SETTINGS_FILE);
    
    // Hash both input and stored password for comparison (Timing Attack protection)
    const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');
    const storedHash = crypto.createHash('sha256').update(settings.admin_password || '').digest('hex');

    if (inputHash === storedHash) {
        // Password Correct
        if (settings.two_fa_enabled) {
            if (!token) {
                // Step 2 Required
                return res.render('login-2fa', { password, error: null, settings });
            } else {
                // Verify 2FA
                const verified = speakeasy.totp.verify({
                    secret: settings.two_fa_secret,
                    encoding: 'base32',
                    token: token
                });
                if (verified) {
                    req.session.isAdmin = true;
                    return res.redirect('/admin');
                } else {
                    return res.render('login-2fa', { password, error: '验证码错误', settings });
                }
            }
        } else {
            // Login Success (No 2FA)
            req.session.isAdmin = true;
            res.redirect('/admin');
        }
    } else {
        res.render('login', { error: '密码错误', settings });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Admin Dashboard
app.get('/admin', requireAuth, (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    const articles = readJson(ARTICLES_META_FILE);
    const keys = readJson(KEYS_FILE);

    // Sort Logic (Articles)
    const sort = req.query.sort || 'date_desc';
    
    articles.sort((a, b) => {
        if (sort === 'date_asc') return (a.date || '').localeCompare(b.date || '');
        if (sort === 'date_desc') return (b.date || '').localeCompare(a.date || '');
        if (sort === 'views_asc') return (a.views || 0) - (b.views || 0);
        if (sort === 'views_desc') return (b.views || 0) - (a.views || 0);
        return 0;
    });

    // Sort Logic (Keys)
    const keySort = req.query.keySort || 'status_desc';
    
    keys.sort((a, b) => {
        let result = 0;
        if (keySort === 'status_asc') result = a.status.localeCompare(b.status);
        else if (keySort === 'status_desc') result = b.status.localeCompare(a.status);
        
        // Secondary sort: Newest first if primary sort is same
        if (result === 0) {
            result = new Date(b.create_time || 0) - new Date(a.create_time || 0);
        }

        if (keySort.startsWith('status')) return result;
        
        // Other sorts (duration, time)
        if (keySort === 'duration_asc') {
            const getDuration = (d) => d === -1 ? Infinity : d;
            return getDuration(a.duration_hours) - getDuration(b.duration_hours);
        }
        if (keySort === 'duration_desc') {
            const getDuration = (d) => d === -1 ? Infinity : d;
            return getDuration(b.duration_hours) - getDuration(a.duration_hours);
        }
        if (keySort === 'time_asc') return new Date(a.create_time || 0) - new Date(b.create_time || 0);
        if (keySort === 'time_desc') return new Date(b.create_time || 0) - new Date(a.create_time || 0);
        
        return result;
    });

    const activeSection = req.query.section || (req.query.sort || req.query.articlePage ? 'articles' : (req.query.keySort ? 'keys' : 'dashboard'));

    // Article Pagination Logic
    let articlePage = parseInt(req.query.articlePage) || 1;
    let articleLimit = parseInt(req.query.articleLimit) || 10;
    if (articleLimit < 1) articleLimit = 10;
    if (articlePage < 1) articlePage = 1;

    const articleTotal = articles.length;
    const articleTotalPages = Math.ceil(articleTotal / articleLimit);
    if (articlePage > articleTotalPages && articleTotal > 0) articlePage = articleTotalPages;

    const articleStartIndex = (articlePage - 1) * articleLimit;
    const paginatedArticles = articles.slice(articleStartIndex, articleStartIndex + articleLimit);

    // Key Pagination Logic
    let keyPage = parseInt(req.query.keyPage) || 1;
    let keyLimit = parseInt(req.query.keyLimit) || 5;
    if (keyLimit < 1) keyLimit = 5;
    if (keyPage < 1) keyPage = 1;

    const keyTotal = keys.length;
    const keyTotalPages = Math.ceil(keyTotal / keyLimit);
    if (keyPage > keyTotalPages && keyTotal > 0) keyPage = keyTotalPages;

    const keyStartIndex = (keyPage - 1) * keyLimit;
    const paginatedKeys = keys.slice(keyStartIndex, keyStartIndex + keyLimit);

    res.render('admin', { 
        articles: paginatedArticles, 
        allArticles: articles,
        keys: paginatedKeys, 
        settings, 
        currentSort: sort, 
        currentKeySort: keySort, 
        activeSection,
        articlePagination: {
            page: articlePage,
            limit: articleLimit,
            total: articleTotal,
            totalPages: articleTotalPages
        },
        keyPagination: {
            page: keyPage,
            limit: keyLimit,
            total: keyTotal,
            totalPages: keyTotalPages
        }
    });
});

// Settings Update
app.post('/admin/settings', requireAuth, upload.single('qr_image'), (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    
    settings.site_name = req.body.site_name;
    if (req.body.admin_password) settings.admin_password = req.body.admin_password;
    settings.popup_title = req.body.popup_title;
    settings.watermark_text = req.body.watermark_text;
    settings.default_key_duration_hours = parseInt(req.body.default_key_duration_hours) || 24;
    settings.max_devices_per_key = parseInt(req.body.max_devices_per_key) || 2;
    
    // Toggle
    settings.enable_key_verification = req.body.enable_key_verification === 'on';

    // Handle File Upload
    if (req.file) {
        // Add timestamp to force browser cache refresh
        settings.wechat_qr_image = '/images/' + req.file.filename + '?v=' + Date.now();
    }
    
    writeJson(SETTINGS_FILE, settings);
    res.redirect('/admin');
});

// 2FA Routes
app.get('/admin/2fa/setup', requireAuth, (req, res) => {
    const secret = speakeasy.generateSecret({ name: "MyBlog Admin" });
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
        res.json({ secret: secret.base32, qr_code: data_url });
    });
});

app.post('/admin/2fa/verify', requireAuth, (req, res) => {
    const { token, secret } = req.body;
    const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token
    });
    
    if (verified) {
        const settings = readJson(SETTINGS_FILE);
        settings.two_fa_secret = secret;
        settings.two_fa_enabled = true;
        writeJson(SETTINGS_FILE, settings);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: '验证码错误' });
    }
});

app.post('/admin/2fa/disable', requireAuth, (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    settings.two_fa_enabled = false;
    delete settings.two_fa_secret;
    writeJson(SETTINGS_FILE, settings);
    res.redirect('/admin');
});

// Key Generation
app.post('/admin/keys/generate', requireAuth, (req, res) => {
    const keys = readJson(KEYS_FILE);
    let duration = parseInt(req.body.duration);
    if (isNaN(duration)) duration = -1; // Default to infinite
    const count = parseInt(req.body.count) || 1;
    
    for (let i = 0; i < count; i++) {
        const newKey = {
            code: generateKey(),
            status: 'unused',
            bound_article_id: null,
            create_time: new Date().toISOString(),
            activate_time: null,
            expire_time: null,
            duration_hours: duration
        };
        keys.unshift(newKey); // Add to top
    }
    
    writeJson(KEYS_FILE, keys);
    res.redirect('/admin?section=keys');
});

// Delete Key
app.post('/admin/keys/delete/:code', requireAuth, (req, res) => {
    const code = (req.params.code || '').trim();
    console.log(`Attempting to delete key: ${code}`);
    let keys = readJson(KEYS_FILE);
    const initialCount = keys.length;
    
    const keyToDelete = keys.find(k => k.code === code);
    
    if (!keyToDelete) {
        console.warn(`Key not found: ${code}`);
        return res.json({ success: false, message: '卡密不存在' });
    }
    
    // Check if bound article exists
    let isArticleDeleted = false;
    if (keyToDelete.bound_article_id) {
        const articles = readJson(ARTICLES_META_FILE);
        const article = articles.find(a => a.id === keyToDelete.bound_article_id);
        if (!article) {
            isArticleDeleted = true;
        }
    }
    
    if (keyToDelete.status !== 'unused' && !isArticleDeleted) {
        console.warn(`Cannot delete used key: ${code} (status: ${keyToDelete.status})`);
        return res.json({ success: false, message: '已使用的卡密无法删除' });
    }
    
    keys = keys.filter(k => k.code !== code);
    
    if (keys.length === initialCount) {
        console.error(`Filter failed to remove key: ${req.params.code}`);
        return res.json({ success: false, message: '删除失败：内部错误' });
    }

    writeJson(KEYS_FILE, keys);
    console.log(`Successfully deleted key: ${req.params.code}`);
    res.json({ success: true });
});

// --- IMAGE UPLOAD ---
app.post('/admin/upload-image', requireAuth, uploadBlogImage.single('image'), (req, res) => {
    if (!req.file) {
        return res.json({ success: false, message: '没有检测到上传的文件' });
    }
    const imageUrl = '/uploads/' + req.file.filename;
    res.json({ success: true, url: imageUrl });
});

// --- ARTICLE MANAGEMENT ---

// New Article Page
app.get('/admin/article/new', requireAuth, (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    res.render('editor', { settings, article: {}, content: '' });
});

// Edit Article Page
app.get('/admin/article/edit/:id', requireAuth, (req, res) => {
    const settings = readJson(SETTINGS_FILE);
    const articles = readJson(ARTICLES_META_FILE);
    const article = articles.find(a => a.id === req.params.id);
    
    if (!article) return res.redirect('/admin');
    
    let content = '';
    try {
        content = fs.readFileSync(path.join(CONTENT_DIR, article.id + '.md'), 'utf8');
    } catch (e) { content = ''; }
    
    res.render('editor', { settings, article, content });
});

// Save Article
app.post('/admin/article/save', requireAuth, (req, res) => {
    const { id, title, summary, content, hidden, requiresKey } = req.body;
    let articles = readJson(ARTICLES_META_FILE);
    let articleId = id;
    const isHidden = hidden === 'on';
    const isRequiresKey = requiresKey === 'on';
    
    if (!articleId) {
        // Create new
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        
        articleId = `post-${year}${month}${day}-${hour}${minute}${second}-${Math.random().toString(36).substr(2, 4)}`;
        
        const newArticle = {
            id: articleId,
            title,
            summary,
            date: now.toISOString().split('T')[0],
            hidden: isHidden,
            requiresKey: isRequiresKey
        };
        articles.unshift(newArticle);
    } else {
        // Update existing
        const index = articles.findIndex(a => a.id === articleId);
        if (index !== -1) {
            articles[index].title = title;
            articles[index].summary = summary;
            articles[index].hidden = isHidden;
            articles[index].requiresKey = isRequiresKey;
        }
    }
    
    // Save Metadata
    writeJson(ARTICLES_META_FILE, articles);
    
    // Save Content
    fs.writeFileSync(path.join(CONTENT_DIR, articleId + '.md'), content, 'utf8');
    
    res.redirect('/admin');
});

// Toggle Article Visibility
app.get('/admin/article/toggle-visibility/:id', requireAuth, (req, res) => {
    const articleId = req.params.id;
    let articles = readJson(ARTICLES_META_FILE);
    const article = articles.find(a => a.id === articleId);
    
    if (article) {
        article.hidden = !article.hidden;
        writeJson(ARTICLES_META_FILE, articles);
        res.json({ success: true, hidden: article.hidden });
    } else {
        res.status(404).json({ success: false, message: '文章不存在' });
    }
});

app.get('/admin/article/toggle-key-requirement/:id', requireAuth, (req, res) => {
    const articleId = req.params.id;
    let articles = readJson(ARTICLES_META_FILE);
    const article = articles.find(a => a.id === articleId);
    
    if (article) {
        // Toggle requiresKey, default to true if it's undefined
        const currentStatus = article.requiresKey !== false;
        article.requiresKey = !currentStatus;
        writeJson(ARTICLES_META_FILE, articles);
        res.json({ success: true, requiresKey: article.requiresKey });
    } else {
        res.status(404).json({ success: false, message: '文章不存在' });
    }
});

// Delete Article
app.get('/admin/article/delete/:id', requireAuth, (req, res) => {
    const articleId = req.params.id;
    let articles = readJson(ARTICLES_META_FILE);
    
    // Remove from metadata
    articles = articles.filter(a => a.id !== articleId);
    writeJson(ARTICLES_META_FILE, articles);
    
    // Remove content file
    try {
        fs.unlinkSync(path.join(CONTENT_DIR, articleId + '.md'));
    } catch (e) { console.error('Error deleting file:', e); }
    
    // Redirect back with section and pagination info if available
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const sort = req.query.sort || 'date_desc';
    res.redirect(`/admin?section=articles&articlePage=${page}&articleLimit=${limit}&sort=${sort}`);
});

app.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
});
