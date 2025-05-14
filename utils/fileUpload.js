const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for profile pictures
const profilePictureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/uploads/profile-pictures';

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Use userId + timestamp to ensure uniqueness
    const userId = req.user.id;
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);

    cb(null, `${userId}-${timestamp}${fileExtension}`);
  }
});

// Configure storage for documents
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/uploads/documents';

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Use userId + timestamp + original filename to ensure uniqueness
    const userId = req.user.id;
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fileName = file.originalname.replace(fileExtension, '').replace(/[^a-zA-Z0-9]/g, '_');

    cb(null, `${userId}-${timestamp}-${fileName}${fileExtension}`);
  }
});

// File filter to only allow image files
const imageFileFilter = (req, file, cb) => {
  // Accept only image files
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

// File filter for documents - allow common document types
const documentFileFilter = (req, file, cb) => {
  // Accept common document types
  if (!file.originalname.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|jpg|jpeg|png|gif|zip|rar)$/i)) {
    return cb(new Error('Unsupported file type!'), false);
  }
  cb(null, true);
};

// Create multer upload instance for profile pictures
const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: imageFileFilter
}).single('profilePicture');

// Create multer upload instance for documents
const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  fileFilter: documentFileFilter
}).single('document');

// Create multer upload instance for document versions
const uploadDocumentVersion = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  fileFilter: documentFileFilter
}).single('document');

module.exports = {
  uploadProfilePicture,
  uploadDocument,
  uploadDocumentVersion
};
