var Discord = require('discord.js');
var fs = require('fs');
var bot = new Discord.Client();
const { getAudioDurationInSeconds } = require('get-audio-duration');


var isReady = true;
var voiceChannel = null;
var globalConnection = null;
var timeOut = null;
var dispatcherInstance = null;
const config = require("./config.json");
var curryBotChannel = config.channelId;

bot.on('ready', () => {
    console.log('CurryBot initiated.');
});

bot.on('message', message => {
    // Only listen to currybot channel.
    if (message.channel.id === curryBotChannel && isReady)
    {
        switch (message.content) {
            case 'CB init':
                init(message);
                break;
            case 'CB exit':
                leave();
                break;
            case 'CB reboot':
                leave();
                init(message);
                break;
            case 'sounds':
                availableSounds(message);
                break;
            default:
                playSoundByMessage(message);

        }
    }
});

/**
 * Play sound by message.
 *
 * @param message
 */
function playSoundByMessage(message) {
    if (isReady)
    {
        isReady = false;
        playSound(message.content);
        isReady = true;
    }
}

/**
 *
 * @param name
 */
function playSound(name) {
    fs.readFile('./audio.json', 'utf8', function (err, data) {
        if (err) throw err;
        var audio = JSON.parse(data);
        if (audio[name]) {
            var connection = getConnection();
            getAudioDurationInSeconds(config.audio_folder + audio[name]).then((duration) => {
                const dispatcher = connection.playFile(config.audio_folder + audio[name]);
                dispatcher.on("end", end => {
                    console.log('Playing sound: ' + audio[name]);
                });
                setTimer(function() {
                    dispatcher.end()
                },duration * 1000 + 300);
            });
        }
    });
}

function availableSounds(message) {
    // Tell what sounds are available.
    fs.readFile('./audio.json', 'utf8', function (err, data) {
        if (err) throw err;
        var audio = JSON.parse(data);
        let sounds = "Soundboard currently contains: \n";
        Object.keys(audio).forEach(function(key) {
           sounds += key + "\n"
        });
        message.reply(sounds);
    });
}

/**
 * Clear any current timer and set new one.
 * @param handler
 * @param duration
 */
function setTimer(handler, duration) {
    if (timeOut) {
        clearTimeout(timeOut);
    }
    timeOut = setTimeout(handler, duration);
}

/**
 * Set voice channel globally.
 * @param message
 */
function ensureVoiceChannel(message) {
    voiceChannel = message.member.voiceChannel;
}

/**
 *
 * @param connection
 */
function setConnection(connection) {
    globalConnection = connection;
}

/**
 *
 * @returns {*}
 */
function getConnection() {
    return globalConnection;
}

/**
 *
 * @param message
 */
function init(message) {
    isReady = false;
    ensureVoiceChannel(message);
    voiceChannel.join().then(connection =>
    {
        setConnection(connection);
    }).catch(err => console.log(err));
    isReady = true;
}

/**
 *
 */
function leave() {
    isReady = false;
    if (voiceChannel) {
        voiceChannel.leave();
    }
    isReady = true;
}

bot.login(config.token);
