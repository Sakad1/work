const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();


// Use CSRF protection middleware for routes that require it

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const db = mysql.createConnection({
    host: 'sql12.freemysqlhosting.net',
    user: 'sql12647034',
    password: 'YIvDMgvYpg',
    database: 'sql12647034',
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

// Initialize session middleware
app.use(session({
    secret: 'YIvDMgvYpg', // Use a long, random string here
    resave: false,
    saveUninitialized: false,
}));
// GET route for the login page
app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/signup.html');
});
// GET route for the login page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
// POST route for handling signup
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;

    // Check if the user already exists
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error checking user existence');
        } else {
            if (results.length === 0) {
                // User doesn't exist, create a new user
                db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                    [username, email, password],
                    (insertErr, result) => {
                        if (insertErr) {
                            console.error(insertErr);
                            res.status(500).send('Error creating user');
                        } else {
                            // Get the user ID of the newly created user
                            const userId = result.insertId;
                            
                            // Create a table for worked hours for the new user
                            const tableName = `worked_hours_user${userId}`;
                            db.query(`CREATE TABLE IF NOT EXISTS ${tableName} (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                worked_hours DECIMAL(8, 2),
                                date_submit TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )`, (tableErr) => {
                                if (tableErr) {
                                    console.error(tableErr);
                                    res.status(500).send('Error creating user table for worked hours');
                                } else {
                                    res.redirect('/'); // Redirect to the login page after successful signup
                                }
                            });
                        }
                    });
            } else {
                // User already exists
                res.status(400).send('User already exists');
            }
        }
    });
});

// POST route for handling login
app.post('/', (req, res) => {
    const { email, password } = req.body;

    // Check if the provided email exists in the database
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error checking email existence');
        } else {
            if (results.length === 1) {
                // Email exists, check if the password matches
                const user = results[0];
                if (user.password === password) {
                    // Password matches, set the user ID in the session
                    req.session.userId = user.id;
                    res.redirect('/home'); // Redirect to the home page after successful login
                } else {
                    // Password does not match
                    res.status(401).send('Invalid email or password');
                }
            } else {
                // Email does not exist
                res.status(401).send('Invalid email or password');
            }
        }
    });
});

// GET route for the home page
app.get('/home', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }

    res.sendFile(__dirname + '/home.html');
});


// POST route for handling logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error logging out');
        } else {
            res.redirect('/');
        }
    });
});




// POST route for handling the form submission to add worked hours
app.post('/addhours', (req, res) => {
    const userId = req.session.userId;
    const { hoursWorked } = req.body;

    // Check if the user is logged in
    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    // Capture the current date and time in a JavaScript Date object
    const currentDate = new Date();

    // Dynamically generate the table name for worked hours based on the user's ID
    const tableName = `worked_hours_user${userId}`;

    // Insert a new row for the worked hours
    db.query(`INSERT INTO ${tableName} (worked_hours, date_submit) VALUES (?, ?)`, [hoursWorked, currentDate], (insertErr) => {
        if (insertErr) {
            console.error(insertErr);
            res.status(500).send('Error adding worked hours');
        } else {
            res.redirect('/home')
           
        }
    });
});

// GET route to display worked hours for a specific user
app.get('/workedhours', (req, res) => {
    const userId = req.session.userId;

    // Check if the user is logged in
    if (!userId) {
        return res.status(401).send('Unauthorized');
    }

    // Dynamically generate the table name for worked hours based on the user's ID
    const tableName = `worked_hours_user${userId}`;

    // Retrieve worked hours data for the user
    db.query(`SELECT date_submit, worked_hours FROM ${tableName}`, (queryErr, results) => {
        if (queryErr) {
            console.error(queryErr);
            res.status(500).send('Error fetching worked hours data');
        } else {
            // Create an array to hold the rows of data
            const rows = results.map((row) => `
                <tr>
                    <td>${row.date_submit}</td>
                    <td>${row.worked_hours}</td>
                </tr>
            `);

            // Construct the HTML page with the table rows
            const html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Worked Hours</title>
                    <style>
                        /* Add your CSS styles here */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }

                        table, th, td {
                            border: 1px solid #ccc;
                        }

                        th, td {
                            padding: 8px;
                            text-align: left;
                        }

                        th {
                            background-color: #f2f2f2;
                        }
                    </style>
                </head>
                <body>
                    <h1>Worked Hours</h1>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Worked Hours</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.join('')}
                        </tbody>
                    </table>
                    <a href="/home">Back to Homepage</a>
                </body>
                </html>
            `;

            // Send the HTML page as the response
            res.send(html);
        }
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
