'use strict';

// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
const Wit = require('node-wit').Wit;
const http = require('http');

var accountSid = 'AC43f00c7fc3b6e1c224112a677c02c56a';
var authToken = '0098aa109fc864c3aea0a68704c0fb8b';
var twilio = require('twilio'),
twilio_client = twilio(accountSid, authToken),
express = require('express'),
bodyParser = require('body-parser'),
app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// This will contain all user sessions.
// Each session has an entry:
// phone_number -> {context: sessionState}
const sessions = {};

const getRec = ((food, minerals, context) => {

  const dailyLimitK = 1500;
  const dailyLimitPh = 800;
  const dailyLimitNa = 2000;

  const ratioK = minerals.potassium/dailyLimitK;
  const ratioPh = minerals.phosphorus/dailyLimitPh;
  const ratioNa = minerals.sodium/dailyLimitNa;
  const max = Math.max(ratioK, ratioPh, ratioNa);
  
  const names = ["Potassium", "Phosphorus", "Sodium"];
  const ratios = [ratioK, ratioPh, ratioNa];
  const problem = names[ratios.indexOf(max)];
  
  var rec;  
  const highRisk = 0.5;
  const medRisk = 0.2;
  const input = context.food.toLowerCase();
  if (max > highRisk) {
    rec = "You probably shouldn't eat that, " + input + " appears to be high in " + problem + ".";
  } else if (max <= highRisk && max > medRisk) {
    rec = "Be careful, " + input + " appears to be pretty high in " + problem + ".";
  } else {
    rec = "Based on what we found, it appears to be pretty safe to have " + input + ".";
  }

  rec += "\n\n" + food + ":";
  for (var i = 0; i < names.length; i++) {
    if (ratios[i] > 0) {
      rec += "\n" + names[i] + ": " + Math.round(ratios[i] * 100) + "%DV/100g";  
    }
  }
  return rec;
});

const getNutrientFacts = ((id, context, callback) => {
  http.get(
    "http://api.nal.usda.gov/ndb/reports/?ndbno=" + id + "&type=f&format=json&api_key=hhrhGfhytRdiE3nDCPKuKU1xx1t3u1eGGFcz2igy",
    function(response) {
      // Continuously update stream with data
      var body = '';
      response.on('data', function(d) {
          body += d;
      });
      response.on('end', function() {
        // Data reception is done, do whatever with it!
        var parsed = JSON.parse(body);
        var sensitives = {};
        const report = parsed.report;
        if (report) {
	  const food = report.food.name;
          const nutrients = report.food.nutrients;
          for (var i = 0; i < nutrients.length; i++) {
            const mineral = nutrients[i].name;
            const quant = nutrients[i].value;
	    switch (mineral) {
              case "Sodium, Na":
                sensitives.sodium = quant;
                break;
              case "Phosphorus, P":
                sensitives.phosphorus = quant;
                break;
              case "Potassium, K":
                sensitives.potassium = quant;
                break;
            }
	  }
          context.advice = getRec(food, sensitives, context);
	}
        callback(context);
      });
  });
});

const getMineralContentForFood = ((context, callback) => {
  console.log("food id started");
    const food = encodeURIComponent(context.food);
    const url = 'http://api.nal.usda.gov/ndb/search/?format=json&q=' + food + '&sort=n&max=25&offset=0&api_key=hhrhGfhytRdiE3nDCPKuKU1xx1t3u1eGGFcz2igy';
    console.log(url);
    http.get(url,
	function(response) {
      // Continuously update stream with data
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        // Data reception is done, do whatever with it!
        const parsed = JSON.parse(body);
	var id;
	if (parsed.list) {
	  const items = parsed.list.item;
	  if (items[0]) {
	    id = items[0].ndbno;
	  }
	}
        getNutrientFacts(id, context, callback);
      });
    });
});

const token = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node index.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
})();


const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};


const actions = {
  say(sessionId, context, message, cb) {
    console.log(message);
    twilio_client.sendMessage({
      to: sessionId,
      from: '+18307420376',
      body: message,
    }, function(err, data) {
      cb();
    }, null, true);
  },
  merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    const food = firstEntityValue(entities, 'food');
    if (food) {
      context.food = food;
    }
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  ['suggest'](sessionId, context, cb) {
    getMineralContentForFood(context, cb);
  },
};

const wit = new Wit(token, actions);

app.post('/message', function (req, res) {
  var resp = new twilio.TwimlResponse();
  const user_msg = req.body.Body;
  const user_num = req.body.From;
  if (!sessions[user_num]) {
    sessions[user_num] = {context:{}};
  }
  delete sessions[user_num].context.advice;
  console.log(user_num, sessions[user_num]);
  wit.runActions(
    user_num,
    user_msg,
    sessions[user_num].context,
    (error, context) => {
      var message = "Something went wrong, please ask again or try again later."
      if (error || !context.advice) {
        console.log('Error:', error);
	resp.message(message);
      } else {
	console.log('New context:', context);
	if (context.advice) {
	  message = context.advice;
	}
	sessions[user_num].context = context;
      }

      res.writeHead(200, {
        'Content-Type':'text/xml'
      });
      res.end(resp.toString());
    }
  );

});

var server = app.listen(process.env.PORT || 4567, function() {
  console.log('Listening on port %d', server.address().port);
});
