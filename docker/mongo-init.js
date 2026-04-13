// Runs once on first container start as the root admin user.
// Creates an app-scoped user with readWrite on myblock_dev.
db = db.getSiblingDB('myblock_dev');

db.createUser({
  user: 'myblock_app',
  pwd: 'devpassword',
  roles: [{ role: 'readWrite', db: 'myblock_dev' }],
});
