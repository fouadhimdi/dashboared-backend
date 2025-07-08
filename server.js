const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// تقديم الملفات الثابتة من مجلد public
app.use(express.static('public'));

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

// مسارات للوصول إلى المجلدات الثابتة والديناميكية
validFolders.forEach(folder => {
  app.get(`/data/${folder}`, readDirectoryHandler(folder));
});

app.get('/data/:folderName/:fileName', (req, res) => {
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

// تقديم تطبيق React من مجلد build
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// الاستماع على المنفذ المطلوب
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
