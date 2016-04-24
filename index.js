'use strict';

// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
const Wit = require('node-wit').Wit;
const http = require('http');

// var accountSid = 'AC43f00c7fc3b6e1c224112a677c02c56a';
// var authToken = '0098aa109fc864c3aea0a68704c0fb8b'
// var twilio_client = require('twilio')(accountSid, authToken),
// cronJob = require('cron').CronJob;
//
// var textJob = new cronJob( '0 18:41 * * *', function(){
//   twilio_client.sendMessage( { to: '1-210-219-7018', from: '+18307420376',
//       body:'Hello! Hope you’re having a good day!' }, function( err, data ) {});
// },  null, true);

const getNutrientFacts = ((id, context, callback) => {

  http.get("http://api.nal.usda.gov/ndb/reports/?ndbno=" + id + "&type=f&format=json&api_key=hhrhGfhytRdiE3nDCPKuKU1xx1t3u1eGGFcz2igy"
  //   {
  //     host: 'api.nal.usda.gov',
  //     path: '/ndb/reports/?ndbno=' + id + '&type=f&format=json&api_key=hhrhGfhytRdiE3nDCPKuKU1xx1t3u1eGGFcz2igy'
  // }
  , function(response) {
      // Continuously update stream with data
      var body = '';
      response.on('data', function(d) {
          body += d;
      });
      response.on('end', function() {
        // Data reception is done, do whatever with it!
        var parsed = JSON.parse(body);
        //console.log(parsed.report.food.nutrients);
        var sensitives = {};
        const report = parsed.report;
        const nutrients = report.food.nutrients;
        // console.log(nutrients);
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
        context.advice = "Sodium: " + sensitives.sodium +
          ", Phosphorus: " + sensitives.phosphorus +
          ", Potassium: " + sensitives.potassium;
        console.log("--------" + context.advice);
        callback(context);
        // callback({
        //     sodium: sensitives.sodium,
        //     phosphorous: sensitives.phosphorus,
        //     potassium: sensitives.potassium,
        // });
      });
  });
});

const getFoodId = ((context, callback) => {
  console.log("food id started");
    var food = callback.food;
    http.get({
        host: 'api.nal.usda.gov',
        path: '/ndb/search/?format=json&q=' + food
        + '&sort=n&max=25&offset=0&api_key=hhrhGfhytRdiE3nDCPKuKU1xx1t3u1eGGFcz2igy'
    }, function(response) {
      console.log("response");
      // Continuously update stream with data
      var body = '';
      response.on('data', function(d) {
        // console.log(d);
        body += d;
      });
      response.on('end', function() {
        // Data reception is done, do whatever with it!
        var parsed = JSON.parse(body);
        console.log(parsed.errors.error[0]);
          // var sensitives = {};
          // for (var k in parsed.nutrients) {
          //   switch (k.name) {
          //     case "Sodium, Na":
          //       sensitives.sodium = k.value;
          //       break;
          //     case "Phosphorus, P":
          //       sensitives.phosphorus = k.value;
          //       break;
          //     case "Potassium, K":
          //       sensitives.potassium = k.value;
          //   }
          // }

          // callback({
          //     sodium: sensitives.sodium,
          //     phosphorous: sensitives.phosphorus,
          //     potassium: sensitives.potassium,
          // });
          const id = "18003";
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
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    const food = firstEntityValue(entities, 'food');
    if (food) {
      console.log(food);
      context.food = food;
    }
    if (!context.food) {
      context.food = "bananas";
    }
    console.log(context);
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  ['suggest'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    console.log(context);
    const id = "18003";
    getNutrientFacts(id, context, cb);

    context.advice = 'don\'t';
    // cb(context);
  },
};

const client = new Wit(token, actions);
client.interactive();
