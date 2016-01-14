var express = require('express');
var app = express();
var PORT = process.env.PORT || 9000;
var https = require('https');
var parseString = require('xml2js').parseString;
var util = require('util');
var bodyParser = require('body-parser');
var db = require('./db.js');

var atlas = []; // {id:string, title:string}

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'jade');
app.set('views', 'src/views');

// // Route level middleware is provided in the route
app.get('/', function(req, res) {
  
  var query = req.query;
  if (query.hasOwnProperty('title')) {
    searchByTitle(query.title).then(function(results) {
    
    console.log('## results', results);

    var first = results[0];
    var id = (results.length > 0) ? first.dataValues.code : query.title;
    res.redirect('/id/' + id);

  }, function(error) {
    console.log(error);
  });

    // use the first entry from the atlas or just the search term
    // TODO: show a list of entries for multiple matches
    // var id = (results) ? results[0].get('id') : query.title;

    // res.redirect('/id/' + id);

  } else if (query.hasOwnProperty('id')) {
    searchByID(query.id).then(function(result) {
      console.log('## results', result);
      
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

      //console.log(util.inspect(result, false, null));
      
      // store successful search
      var pkgs = result.titlepatch.tag[0].package;
      var title = pkgs[pkgs.length-1].paramsfo[0]['TITLE'][0];
      
      saveGame(id, title);

      res.render('index', {json: result});
    });
  }).catch(function(e) {
    res.render('index', {error: id});
  });
});

app.get('/list', function(req, res) {
  var list = getGameList().then(function(results) {
    console.log(results);
    res.render('index', {list: results});
  }, function(error) {
    console.log(error);
    res.render('index', {error: 'error'});
  });
  console.log('list: ' + list);
});

// return a full list of games
function getGameList() {
  return db.game.findAll({});
};

// save game to db
function saveGame(id, title) {
  if (!idExists(id)) {
    atlas.push({ id: id, title: title });  
  }
  
  db.game.findOrCreate({ 
    where: {
      code: id,
      title: title 
    }
  }).then(function(game) {
    console.log('game saved successfully');
  })
};

// search for game by title
function searchByTitle(title) {
  return db.game.findAll({
    where: {
      title: {
        $like: '%' + title + '%'
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

function idExists(id) {
  var exists = atlas.some(function(entry) {
    if (entry.id == id.toUpperCase()) {
      return true;
    }
  });
  return exists;
};

function searchAtlas(search) {
  var regex = new RegExp(search, 'gi');
  
  var entries = atlas.filter(function(entry) {
    if (entry.title.search(regex) !== -1) return entry
  });

  console.log(`found ${entries.length} entries`);

  return entries;
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
      console.log('statusCode: ', res.statusCode);
      console.log('headers: ', res.headers);
      
      if (res.statusCode == 404) {
        reject();
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

// hydrate the list
atlas.push({id: 'NPUB31419', title:'Minecraft'});

//db
db.sequelize.sync().then(function() {
  app.listen(PORT, function() {
    console.log('Listening on port ' + PORT + ' ...');  
  }); 
});