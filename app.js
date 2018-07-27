process.title = 'CatGifs';

const fs = require('fs');

// Server & express config
var http	      = require('http');
var express 		= require('express');
var app 		    = express();

var config = require("./config.json");

// Image downloader to download de gif from Giphy
const download = require('image-downloader');

// Giphy config
var giphyApiHost = config.giphy.apiHost;
var giphyApiKey = config.giphy.apiKey;
var giphyTag = config.giphy.tag;
var giphyRandomPath = `/v1/gifs/random?api_key=${giphyApiKey}&tag=${giphyTag}&rating=g`;
var contentRute = 'content';

// Telegram bot
const TelegramBot = require('node-telegram-bot-api');
const token = config.telegram.token;
const bot = new TelegramBot(token, {polling: true});

// Sets up the server and the urls
app.get('/SendCatGif', SendCatGif);
app.listen(3000, () => console.log('CatGifs app listening on port 3000!'));

var chatIDs = config.telegram.chatIDs;

bot.on('message', (msg) => {
  var currentChatID = msg.chat.id;

  if (!(currentChatID.toString() in chatIDs)) {
    chatIDs[currentChatID.toString()] = true;

    updateConfig();    

    bot.sendMessage(currentChatID, 'Gracias por hablarme! A partir de ahora, te enviaré fotos de gatetes :) BTW: También puedes pedirlas tú diciéndome cualquier cosa!');
    bot.sendMessage(currentChatID, 'Si quieres que deje de enviarte imágenes sin que las pidas... Escribe /stop');
  } else if (msg.text === "/stop") {
    chatIDs[currentChatID.toString()] = false;

    updateConfig();

    bot.sendMessage(currentChatID, 'Está bien... Ya paro. PERO si quieres volver a recibir fantásticos gifs de gatitos sin pedirlos, escribe /continue');
  } else if (msg.text === "/continue") {
    chatIDs[currentChatID.toString()] = true;

    updateConfig();
    
    bot.sendMessage(currentChatID, 'BIEEEEN! Ahora recibirás gifs de gatitos 100% llenos de felicidad. Si prefieres no recibirlos sin pedirlos antes, escribe /stop');
  } else {
    SendCatGif(null, null, currentChatID);
  }
});

bot.on('polling_error', (error) => {
  console.log(error);
});

function updateConfig() {
  // Updates config json file
  var json = JSON.stringify(config, null, 4);
  fs.writeFileSync("./config.json", json, 'utf8');
}

function shouldSendGif() {
  var should = false;

  for (var id in config.telegram.chatIDs) {
    // Skip loop if the property is from prototype
    if (!config.telegram.chatIDs.hasOwnProperty(id)) continue;
    
    if (config.telegram.chatIDs[id] === true) {
      should = true;
      break;
    }
  }

  return should;
}

function sendGif(chatID) {
  bot.sendDocument(chatID, `${contentRute}/200w.gif`).then(() => {
    bot.sendMessage(chatID, "Gatete!");
  });
}

// Function called on one of the urls
function SendCatGif(request, response, chatID) {
  if (response && !shouldSendGif()) {
    response.send('Error: No one is subscribed to this bot');
    return;
  }

  // Config for the Giphy API
  var chunks = [];
  var options = {
    host: giphyApiHost,
    path: giphyRandomPath,
    method: 'GET'
  };

  // Giphy API request
  http.request(options, function(res) {
    res.on('data', function (data) {
      chunks.push(data);
    });

    res.on('end', function() {
      var data = JSON.parse(Buffer.concat(chunks));
      download.image({
        url: data.data.images.fixed_width.url,
        dest: contentRute
      }).then(({ filename, image }) => {
        console.log('File saved to', filename);

        if (response) {
          for (var id in config.telegram.chatIDs) {
            // skip loop if the property is from prototype
            if (!config.telegram.chatIDs.hasOwnProperty(id)) continue;
            
            if (config.telegram.chatIDs[id] === false) continue;
  
            sendGif(id);
          }

          response.send('OK. Gif sent!');
        } else {
          sendGif(chatID);
        }

      }).catch((err) => {
        console.error('Error saving file', err);
      });
    });
  }).end();
}