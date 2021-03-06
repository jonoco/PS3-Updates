var express = require('express');
var app = express();
var PORT = process.env.PORT || 9000;
var https = require('https');
var parseString = require('xml2js').parseString;
var util = require('util');
var bodyParser = require('body-parser');
var db = require('./db.js');

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'jade');
app.set('views', __dirname + '/src/views');

app.get('/', function(req, res) {

  var query = req.query;
  if (query.hasOwnProperty('title')) {

    searchByTitle(query.title).then(function(results) {

      if (results.length > 1) {
        res.render('index', {list: results});

      } else if (results.length == 0) { // No results from the DB
        res.render('index', {error: `Nothing in the game list found for \"${query.title}\"`});

      } else {
        var id = (results.length > 0) ? results[0].dataValues.code : query.title;
        res.redirect('/id/' + id);
      }

    }, function(error) {
      console.log(error);
      res.render('index', {error: error});
    });

  } else if (query.hasOwnProperty('id')) {

    searchByID(query.id).then(function(result) {

      var id = (result) ? result.dataValues.code : query.id.toUpperCase();
      res.redirect('/id/' + id);

    }, function(error) {
      console.log(error);
    });
  } else {
    res.render('index', {});
  }
});

app.get('/id/:id', function(req, res) {
  var id = req.params.id;

  getXML(id).then(function(xml) {
    parseString(xml, function(err, result) {

      // store successful searches in the db
      var pkgs = result.titlepatch.tag[0].package;
      var title = pkgs[pkgs.length-1].paramsfo[0]['TITLE'][0];
      var alias = title.toLowerCase();

      saveGame(id, title, alias);

      res.render('index', {json: result});
    });
  }).catch(function(e) {
    res.render('index', {error: e});
  });
});


/*
 * Start scan for titles of given [type], with an optional [min] and [max] serial
 * [min] defaults to 0, [max] defaults to 99999
 */
app.get('/scan', function(req, res) {
  // var type = req.params.type;
  var query = req.query;
  var type = query.hasOwnProperty('type') ? query.type : null;
  var min = query.hasOwnProperty('min') ? query.min : null;
  var max = query.hasOwnProperty('max') ? query.max : null;

  console.log(`${type} : ${min} : ${max}`)

  if (!type) {
    return res.render('index', {error: 'you must include a [type]'});
  }

  scan(min, max, type.toUpperCase());
  res.render('index', {error: `no error; scan is running for ${type}`});
});

app.get('/list', function(req, res) {
  getGameList().then(function(results) {
    res.render('index', {list: results});
  }, function(error) {
    console.log(error);
    res.render('index', {error: 'error'});
  });
});

/* Check if a range of title serials for a type exists
 * Saving title on success, otherwise continuing
 */
function scan(i, max , type) {
  // scan sony server for titles
  i = i ? Number(i) : 0;
  max = max ? Number(max) : 99999;
  var serial = ("00000" + i).slice(-5);
  var id = `${type}${serial}`;

  if (i >= max) return;

  console.log(`scanning ${type} : ${i} : ${max}`);

  getXML(id).then(function(xml) {
      parseString(xml, function(err, result) {

        // store successful searches in the db
        var pkgs = result.titlepatch.tag[0].package;
        var title = pkgs[pkgs.length-1].paramsfo[0]['TITLE'][0];
        var alias = title.toLowerCase();

        saveGame(id, title, alias);

        scan(i+1, max, type);
      });
    }).catch(function(e) {
      scan(i+1, max, type);
    });

}

// return a full list of games
function getGameList() {
  return db.game.findAll({
    order: 'title ASC'
  });
};

// save game to db
function saveGame(id, title, alias) {
  db.game.findOrCreate({
    where: {
      code: id,
      title: title,
      alias: alias
    }
  }).then(function(game) {
    console.log('game saved successfully: ' + game);
  })
};

// search for game by title
function searchByTitle(title) {
  return db.game.findAll({
    where: {
      alias: {
        $like: '%' + title.toLowerCase() + '%'
      }
    }
  });
};

// search for game by id
function searchByID(id) {
  return db.game.findOne({
    where: {
      code: id
    }
  });
};

function getXML(id) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'a0.ww.np.dl.playstation.net',
      port: 443,
      path: `/tpl/np/${id}/${id}-ver.xml`,
      method: 'GET',
      agent: false
    };

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var req = https.request(options, (res) => {
      //console.log('statusCode: ', res.statusCode);
      //console.log('headers: ', res.headers);

      if (res.statusCode == 404) {
        reject('No title with that id found');
      }

      // Package found, but no content
      if (res.headers['content-length'] == '0') {
        reject('We couldn\'t find any updates for that title');
      }

      res.on('data', (d) => {
        resolve(d);
      });
    });
    req.end();

    req.on('error', (e) => {
      reject(e);
    });
  });
};

process.on('uncaughtException', function(e) {
  var timeStamp = new Date().toUTCString();
  console.log("Error | " + timeStamp + " : " + e);
});

//db
db.sequelize.sync().then(function() {
  app.listen(PORT, function() {
    console.log('Listening on port ' + PORT + ' ...');
  });
});