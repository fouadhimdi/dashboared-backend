const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// إعدادات CORS للنشر
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, /\.render\.com$/, /\.onrender\.com$/]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// تقديم الملفات الثابتة من مجلد public
app.use('/public', express.static(path.join(__dirname, 'public')));

// دالة موحدة للوصول إلى المجلدات وقراءة محتوياتها
function readDirectoryHandler(dirName) {
  return (req, res) => {
    const directoryPath = path.join(__dirname, `public/data/${dirName}`);
    
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        return res.status(500).send({
          message: `Unable to scan directory ${dirName}: ${err}`,
        });
      }
      
      res.json(files);
    });
  };
}

const validFolders = ['ED', 'LAB', 'BB', 'OR', 'RAD'];

// مسارات API مع prefix /api
validFolders.forEach(folder => {
  app.get(`/api/data/${folder}`, readDirectoryHandler(folder));
});

// مسارات API بدون prefix للتوافق مع النسخة القديمة
validFolders.forEach(folder => {
  app.get(`/data/${folder}`, readDirectoryHandler(folder));
});

// مسارات تحميل الملفات مع prefix /api
app.get(`/api/data/:folderName/:fileName`, (req, res) => {
  const { folderName, fileName } = req.params;

  if (!validFolders.includes(folderName)) {
    return res.status(403).send({ message: 'Access denied: Invalid folder' });
  }

  const filePath = path.join(__dirname, `public/data/${folderName}/${fileName}`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send({ message: `File not found: ${fileName}` });
    }
  });
});

// مسارات تحميل الملفات بدون prefix للتوافق مع النسخة القديمة
app.get(`/data/:folderName/:fileName`, (req, res) => {
  const { folderName, fileName } = req.params;

  if (!validFolders.includes(folderName)) {
    return res.status(403).send({ message: 'Access denied: Invalid folder' });
  }

  const filePath = path.join(__dirname, `public/data/${folderName}/${fileName}`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send({ message: `File not found: ${fileName}` });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// تقديم تطبيق React من مجلد build
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  // Catch all handler لـ React Router
  app.get('*', (req, res) => {
    // تجنب API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/data')) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Build folder not found. Run npm run build first.' });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// الاستماع على المنفذ المطلوب
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Serving files from: ${buildPath}`);
  console.log(`🔗 Available at: http://localhost:${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🚀 Production server ready!`);
  }
});
