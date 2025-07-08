const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

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

// مسارات للوصول إلى المجلدات المختلفة
app.get('/data/ED', readDirectoryHandler('ED'));
app.get('/data/LAB', readDirectoryHandler('LAB'));
app.get('/data/BB', readDirectoryHandler('BB'));
app.get('/data/OR', readDirectoryHandler('OR'));
app.get('/data/RAD', readDirectoryHandler('RAD'));

// مسار للوصول إلى المجلدات الديناميكية (قائمة الملفات)
app.get('/data/:folderName', (req, res) => {
  const { folderName } = req.params;
  
  // التحقق من صحة اسم المجلد لأسباب أمنية
  const validFolders = ['ED', 'LAB', 'BB', 'OR', 'RAD'];
  if (!validFolders.includes(folderName)) {
    return res.status(403).send({ 
      message: 'Access denied: Invalid folder' 
    });
  }
  
  // إرجاع قائمة الملفات في المجلد
  readDirectoryHandler(folderName)(req, res);
});

// مسار للوصول إلى الملفات الديناميكية
app.get('/data/:folderName/:fileName', (req, res) => {
  const { folderName, fileName } = req.params;
  
  // التحقق من صحة اسم المجلد لأسباب أمنية
  const validFolders = ['ED', 'LAB', 'BB', 'OR', 'RAD'];
  if (!validFolders.includes(folderName)) {
    return res.status(403).send({ 
      message: 'Access denied: Invalid folder' 
    });
  }

  // إرجاع الملف المطلوب
  const filePath = path.join(__dirname, `public/data/${folderName}/${fileName}`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send({
        message: `File not found: ${fileName}`
      });
    }
  });
});

// تقديم الملفات الثابتة من مجلد public
app.use(express.static('public'));

const PORT = process.env.PORT || 3001;
// تقديم تطبيق React من مجلد build في الإنتاج
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});