// dotenv loads parameters (port and database config) from .env
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
// ...rest of the initial code omitted for simplicity.
const { check, validationResult } = require('express-validator');
const connection = require('./db');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


// Define userValidationMiddleware
const userValidationMiddleWare = [
  // Check that email is valid
  check('email').isEmail(),
  // Check that password length is ok
  check('password').isLength({ min: 8 }),
  // Check that name length is ok
  check('name').isLength({ min: 3 }),
];

// respond to requests on `/api/users`
app.get('/api/users', (req, res) => {
  // send an SQL query to get all users
  connection.query('SELECT * FROM user', (err, results) => {
    if (err) {
      // If an error has occurred, then the client is informed of the error
      res.status(500).json({
        error: err.message,
        sql: err.sql,
      });
    } else {
      // If everything went well, we send the result of the SQL query as JSON
      res.json(results);
    }
  });
});

// POST user with express-validator
app.post('/api/users',
  userValidationMiddleWare,
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    const formData = req.body;
    return connection.query('INSERT INTO user SET ?', formData, (err, results) => {
      if (err) {
        // MySQL reports a duplicate entry
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            error: 'Email already exists',
          });
        }
        // Other errors
        res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
      return connection.query('SELECT * FROM user WHERE id = ?', results.insertId, (err2, records) => {
        if (err2) {
          return res.status(500).json({
            error: err2.message,
            sql: err2.sql,
          });
        }
        // If no error, records is an array from which we use the first item
        const insertedUser = records[0];
        // Extract all the fields except from password as a new object(user)
        const { password, ...user } = insertedUser;
        // Get the host + port (localhost: 3000) from the request headers
        const host = req.get('host');
        // Compute the full location, e.g. http://localhost:3000/api/users/122
        // This will help the client to know where the new resource can be found
        const location = `http://${host}${req.url}/${user.id}`;
        return res
          .status(201)
          .set('Location', location)
          .json(user);
      });
    });
  });

// PUT user with express-validator
app.put('/api/users/:id',
  userValidationMiddleWare,
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    // If no error, update the user corresponding to id
    const idUser = req.params.id;
    const formData = req.body;
    connection.query('UPDATE user SET ? WHERE id = ?', [formData, idUser], (err, results) => {
      if (err) {
        res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
      return connection.query('SELECT * FROM user WHERE id = ?', idUser, (err2, records) => {
        if (err2) {
          return res.status(500).json({
            error: err2.message,
            sql: err2.sql,
          });
        }
        // If no error, records is an array from which we use the first item
        const modifiedUser = records[0];
        // Extract all the fields except from password as a new object(user)
        const { password, ...user } = modifiedUser;
        // Get the host + port (localhost: 3000) from the request headers
        const host = req.get('host');
        // Compute the full location, e.g. http://localhost:3000/api/users/122
        // This will help the client to know where the new resource can be found
        const location = `http://${host}${req.url}/${user.id}`;
        return res
          .status(200)
          .set('Location', location)
          .json(user);
      });
    });
  });

app.listen(process.env.PORT, (err) => {
  if (err) {
    throw new Error('Something bad happened...');
  }

  console.log(`Server is listening on ${process.env.PORT}`);
});
