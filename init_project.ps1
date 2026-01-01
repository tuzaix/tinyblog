# Create directories
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\data"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\data\articles"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\data\content"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\public"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\public\css"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\public\js"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\public\images"
New-Item -ItemType Directory -Force -Path "d:\develop\myblog\views"

# Create package.json
$packageJson = @{
  "name" = "my-private-blog"
  "version" = "1.0.0"
  "description" = "File-based private blog with key access"
  "main" = "server.js"
  "scripts" = @{
    "start" = "node server.js"
    "dev" = "nodemon server.js"
  }
  "dependencies" = @{
    "express" = "^4.18.2"
    "body-parser" = "^1.20.2"
    "ejs" = "^3.1.9"
    "markdown-it" = "^13.0.1"
    "multer" = "^1.4.5-lts.1"
    "express-session" = "^1.17.3"
  }
}
$packageJson | ConvertTo-Json -Depth 4 | Out-File "d:\develop\myblog\package.json" -Encoding utf8

# Create settings.json
$settings = @{
  "site_name" = "My Private Blog"
  "admin_password" = "admin"
  "popup_title" = "Locked Content"
  "popup_message" = "Please scan the QR code to get an access key."
  "wechat_qr_image" = "/images/qr-placeholder.png"
  "default_key_duration_hours" = 24
  "default_theme" = "light"
  "watermark_text" = "Private Content IP: 127.0.0.1"
}
$settings | ConvertTo-Json | Out-File "d:\develop\myblog\data\settings.json" -Encoding utf8

# Create empty keys.json and metadata.json
"[]" | Out-File "d:\develop\myblog\data\keys.json" -Encoding utf8
"[]" | Out-File "d:\develop\myblog\data\articles\metadata.json" -Encoding utf8

# Create server.js content
$serverJs = @"
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

const app = express();
const PORT = 3000;

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
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading JSON:', err);
        return [];
    }
};

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ARTICLES_META_FILE = path.join(DATA_DIR, 'articles', 'metadata.json');

// Routes Placeholder
app.get('/', (req, res) => {
    let settings = {};
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (e) { settings = {}; }
    
    const articles = readJson(ARTICLES_META_FILE);
    res.render('index', { articles, settings });
});

app.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
});
"@
$serverJs | Out-File "d:\develop\myblog\server.js" -Encoding utf8

# Create a dummy index.ejs to avoid errors
$indexEjs = @"
<!DOCTYPE html>
<html>
<head>
    <title><%= settings.site_name %></title>
</head>
<body>
    <h1><%= settings.site_name %></h1>
    <div class="articles">
        <% if (articles && articles.length > 0) { %>
            <% articles.forEach(function(article) { %>
                <div class="article-card">
                    <h2><%= article.title %></h2>
                    <p><%= article.summary %></p>
                </div>
            <% }); %>
        <% } else { %>
            <p>No articles found.</p>
        <% } %>
    </div>
</body>
</html>
"@
$indexEjs | Out-File "d:\develop\myblog\views\index.ejs" -Encoding utf8