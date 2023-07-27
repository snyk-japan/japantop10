const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const session = require('express-session');
const db = require("./db");
var marked = require('marked');
var st = require('st');
const _ = require('lodash');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const parseURL = require('url').parse;
const fs = require('fs');
const http = require('http');
const path = require('path');
const sanitizeHtml = require('sanitize-html');


// setup route middlewares
//const csrfProtection = csrf({ cookie: true });

// Set up middleware
app.use(session({
    secret: Math.random() + 'key',
    resave: false,
    saveUninitialized: true
}));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(st({path: './public', url: '/public'}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(session({cookie: {}}));
app.use(cookieParser());
marked.setOptions({sanitize: true});
app.locals.marked = marked;

// Enable rate limit for all requests
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});

app.use(limiter);


// REST API to save game data to MongoDB
app.post('/api/save', express.json(), function (req, res) {
    let player = req.body.player;
    let type = req.body.type;
    let name = req.body.name;
    new db.Board({
        data: req.body.data,
        player: player,
        type: type,
        name: name
    }).save();
    res.send(name+" saved");
});

app.get('/', async (req, res) => {
    const boards = await db.Board.find(); //load previous games
    res.cookie('gameId', Math.random(), {httpOnly: false});
    res.render('index', {board: [], player: 'X\'s turn', boards: boards});
});

app.get('/images', async (req, res) => {
    const absoluteFilePath = path.join(__dirname, "/images");
    const fileName = req.query.file;
    fs.readFile( path.resolve(absoluteFilePath, fileName), (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }
        res.end(data);
    });
});

app.get('/board/:id', async (req, res) => {
    const boardid = req.params.id;
    const loadboard = await db.Board.findOne({_id: boardid}).exec();
    boarddata = JSON.parse(JSON.stringify(loadboard.data));
    newmessage = loadboard.type == 'draw' ? "It was a draw!" : loadboard.player + ' Won!';
    const boards = await db.Board.find(); //load previous games
    res.render('index', {board: boarddata, player: loadboard.name + ' ' + newmessage, boards: boards});
});

app.get('/admin', requireAuth, async (req, res) => {
    // query the database to get all collections
    const boards = await db.Board.find();
    // render the collections in the EJS template
    res.render('admin', {boards, csrfToken: ""/*req.csrfToken()*/});
});

app.post('/delete', requireAuth, async (req, res) => {
    const deleteAll = req.body['deleteAll'];
    const ids = req.body['ids[]'];
    try {
        if (deleteAll) {
            await db.Board.find().deleteMany();
        } else {
            await db.Board.deleteMany({_id: {$in: ids}});
        }
        res.redirect('/admin',);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/logout', function (req, res, next) {
    req.session.destroy();
    res.redirect('/');
});

app.post('/login', async function (req, res, next) {
    try {
        let username = req.body.username;
        let password = req.body.password;
        if (await db.login(username, password)) {
            req.session.authenticated = true;
            return res.redirect("/admin")
        } else {
            return res.redirect("/login")
        }
    } catch (err) {
        console.log(err);
        res.sendStatus(500, "server error");

    }
})
;

function requireAuth(req, res, next) {
    let options = {};
    _.merge(options, req.body);

    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.listen(3001, () => console.log('Server started on port 3001'));

