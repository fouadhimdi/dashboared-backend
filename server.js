const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// مسار لقراءة محتويات مجلد data/ED
app.get('/data/ED', (req, res) => {
  const directoryPath = path.join(__dirname, 'public/data/ED');
  
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).send({
        message: 'Unable to scan directory: ' + err,
      });
    }
    
    res.json(files);
  });
});

// تقديم الملفات الثابتة من مجلد public
app.use(express.static('public'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 