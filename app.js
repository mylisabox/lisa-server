import express from 'express';
import bodyParser from 'express';
import fs from 'fs/promises';
import logger from 'morgan';
import multer from 'multer';
import path from 'path';
import servicesMiddleware from './lib/common/middlewares/services.js';
import tokenChecker from './lib/common/middlewares/tokenChecker.js';
import indexRouter from './lib/common/routes.js';
import removeNull from "./lib/common/utils/stripedJSON.js";

const __dirname = path.resolve();
global.appRoot = path.resolve(__dirname);
const storageAvatar = multer({dest: path.join(global.appRoot, 'public/uploads/')});
const storageVoiceConfig = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(global.appRoot, 'config/speech/'));
        }, filename: function (req, file, cb) {
            cb(null, 'LISA-gfile.json');
        }
    })
});

const app = express();

app.use(logger('dev'));
app.use(servicesMiddleware());
app.use(express.json());
app.use(function (req, res, next) {
    res.json = function (data) {
        const stripedData = JSON.stringify(removeNull(data));

        // content-type
        if (!this.get('Content-Type')) {
            this.set('Content-Type', 'application/json');
        }

        return this.send(stripedData);
    }.bind(res);
    next();
});
app.use(bodyParser());
app.use(express.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/avatar', express.static(path.join(__dirname, 'public/uploads')));
app.use(function (req, res, next) {
    res.setHeader('X-Powered-By', 'L.I.S.A.');
    next();
});
app.use(tokenChecker);
app.use(function (req, res, next) {
    req.storageAvatar = storageAvatar;
    req.storageVoiceConfig = storageVoiceConfig;
    next();
});

app.use('/api/v1', indexRouter);

app.get('/', function (req, res) {
    res.send('It works!');
});

app.use(function (req, res, next) {
    res.status(404).json({
        errorCode: '404',
        message: 'Sorry can\'t find that!',
    });
});

app.use(function (err, req, res, next) {
    if (err.name === 'ServiceError') {
        res.status(err.status).json({
            errorCode: err.errorCode,
            message: err.message,
            error: err.error,
        });
    }
    else if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
        err.name = err.name.replace('Sequelize', '');
        console.error(err);
        res.status(400).json({
            errorCode: '400',
            message: 'Payload is incorrect!',
            error: err,
        });
    }
    else {
        console.error(err);
        res.status(500).json({
            errorCode: '500',
            message: 'An error as occurred!',
            error: err,
        });
    }
});

export default app;

// Add method to strings
String.prototype.toCamelCase = function () {
    const regex = new RegExp(/(?:_|-)(.)/g);
    if (regex.test(this)) {
        return this.toLowerCase().replace(regex, (match, group1) => {
            return group1.toUpperCase();
        });
    }
    return this + '';
};

// Add method exists to fs promises
fs.exists = function (file) {
    return fs.access(file, fs.F_OK)
        .then(() => true)
        .catch(() => false)
}
