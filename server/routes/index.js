var express = require('express');
var router = express.Router();

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('./store/db.json');
let db = low(adapter);

router.get('/', function (req, res, next) {
  res.send('use /lookup/:hash');
});

router.get('/lookup/:hash', function(req, res, next) {
  //lookup a hash
  let record = db.get(req.params.hash).value();
  if(record) {
    res.json({
      auth: true,
      hash: req.params.hash,
      signature: record
    });
  } else {
    res.json({
      auth: false
    });
  }
});

module.exports = router;
