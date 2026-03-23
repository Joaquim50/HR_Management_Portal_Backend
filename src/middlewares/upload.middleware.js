import multer from "multer";
import path from "path";

// Set storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Check file type
function checkFileType(file, cb) {
    const filetypes = /xlsx|xls|csv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype) || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (extname) {
        return cb(null, true);
    } else {
        cb("Error: Excel Files Only!");
    }
}

// Init upload
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    }
});

export default upload;
