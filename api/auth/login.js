/* eslint-disable no-unused-vars */
const express = require('express'), cookieParser = require('cookie-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
var validator = require('validator');
dotenv.config();


const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'maple_auth'
});

router.use(express.json());
router.use(cookieParser());


function generateToken(user) {
    return jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '604800s' });
}

router.post('/create', (req, res) => {
    const { username, password } = req.body;
    const isStrongPassword = validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
        returnScore: false,
        pointsPerUnique: 1,
        pointsPerRepeat: 0.5,
        pointsForContainingLower: 10,
        pointsForContainingUpper: 10,
        pointsForContainingNumber: 10,
        pointsForContainingSymbol: 10,
    });

    if (!isStrongPassword) {
        return res.status(400).json({ error: 'Password is not strong enough', passwordStrength: isStrongPassword });
    }

    connection.query("SELECT username FROM users WHERE username= ?", [username], function (err, row){
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error checking username' });
        }

        if (row.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
  
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.status(500).json({ error: 'Error hashing password' });
            }

            const id = uuidv4();
            const sql = 'INSERT INTO users (id, username, password) VALUES (?, ?, ?)';
            connection.query(sql, [id, username, hash], (error, results) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ error: 'Error creating user' });
                }

                return res.status(200).json({ message: 'User created successfully'});
            });
        });
    });
});

router.post('/', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM users WHERE username = ?';
    connection.query(sql, [username], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error fetching user' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error comparing passwords' });
            }

            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = generateToken({ id: user.id});
            res.cookie('token', token, { httpOnly: true, secure: true, expires: new Date(Date.now() + 604800000), sameSite: 'none' });
            return res.status(200).json({status: "Success", user: { id: user.id, username: user.username } });
        });
    });
});

module.exports = router;