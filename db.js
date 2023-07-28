const mongoose = require('mongoose');
require('dotenv').config()
const crypto = require('crypto');


const hashAlgorithm = "sha1";
var Schema = mongoose.Schema;

const url = 'mongodb://127.0.0.1:27017';
const dbName = 'tic-tac-toe';
mongoose.connect(url + "/" + dbName);

let Data = new Schema({
    data: Array,
    player: String,
    type: String,
    name: String
});

const Board = mongoose.model('Board', Data)

const userSchema = new Schema({
    username: {type: String, required: true, unique: true},
    password: {type: String, required: true}
});

const User = mongoose.model('User', userSchema);


// Check if the first user exists
checkAdmin();

async function checkAdmin() {
    var adminUser = await User.findOne({username: process.env.USERNAME});
    if (adminUser) {
        //clean up old admin user
        adminUser.deleteOne();
    }
    let password = "snyk2023";
    let hashedPassword = crypto.createHash(hashAlgorithm).update(password).digest('hex');

    const newUser = new User({
        username: process.env.USERNAME,
        password: hashedPassword
    });
    newUser.save();

}


async function login(username, password) {
    let user = await User.findOne({username: username, password: password});
    if (user) {
        //found with encrypted password
        return true;
    }
    let hashedPassword = crypto.createHash(hashAlgorithm).update(String(password)).digest('hex');

    user = await User.findOne({username: username, password: hashedPassword});
    if (user) {
        return true;
    }
    return false;
}


module.exports = {Board, User, login}
