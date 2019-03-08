var Discord = require('discord.js');
var fs = require('fs');
var bot = new Discord.Client();

let voiceChannel = null;
let globalConnection = null;
let timeOut = null;
let dispatcherInstance = null;
const config = require("./config.json");
let curryBotChannel = config.channelId;

bot.on('ready', () => {
    console.log('CurryBot initiated.');
});

bot.on('message', message => {
    if (message.channel.id === curryBotChannel)
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
    if (!message.author.bot) {
        playSound(message.content);
    }
}

/**
 * Play sound by trigger word (with soft matching).
 *
 * @param name
 */
function playSound(name) {
    fs.readFile('./audio.json', 'utf8', function (err, data) {
        if (err) throw err;
        let audio = JSON.parse(data);

        if (audio[name]) {
            dispatchSound(audio[name]);
        }
        else {
            let BreakException = {};
            let triggerKey;
            try {
                Object.keys(audio).forEach(function(k) {
                    if (name.includes(k)) {
                        triggerKey = k;
                        throw BreakException;
                    }
                });
            } catch (e) {
                dispatchSound(audio[triggerKey]);
            }
        }
    });
}

/**
 * Sound dispatcher that ensures previous dispatcher is ended.
 *
 * @param filename
 */
function dispatchSound(filename) {
    let connection = getConnection();

    if (dispatcherInstance) {
        clearDispatcher();
    }

    dispatcherInstance = connection.playFile(config.audio_folder + filename);
    dispatcherInstance.on("start", () => {
        console.log('Playing sound: ' + filename);
    });
}

/**
 * End the dispatcher to stop playing of sounds.
 */
function clearDispatcher() {
    if (dispatcherInstance) {
        dispatcherInstance.end();
        dispatcherInstance = null;
    }
    if (timeOut) {
        console.log('Clearing timer.');
        clearTimer();
    }
}

/**
 * Get the available sounds.
 *
 * @param message
 */
function availableSounds(message) {
    fs.readFile('./audio.json', 'utf8', function (err, data) {
        if (err) throw err;
        let audio = JSON.parse(data);
        let sounds = "Soundboard currently contains: \n";
        Object.keys(audio).forEach(function(key) {
           sounds += key + "\n"
        });
        message.reply(sounds);
    });
}

/**
 * Clear any current timer and set new one.
 *
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
 * Clear active timer object.
 */
function clearTimer() {
    if (timeOut) {
        clearTimeout(timeOut);
    }
}

/**
 * Set voice channel globally.
 *
 * @param message
 */
function ensureVoiceChannel(message) {
    voiceChannel = message.member.voiceChannel;
}

/**
 * Set the global connection.
 *
 * @param connection
 */
function setConnection(connection) {
    globalConnection = connection;
}

/**
 * Get the active connection.
 *
 * @returns globalConnection
 */
function getConnection() {
    return globalConnection;
}

/**
 * Initialize connection.
 *
 * @param message
 */
function init(message) {
    voiceChannel = null;
    ensureVoiceChannel(message);
    voiceChannel.join().then(connection =>
    {
        setConnection(connection);
    }).catch(err => console.log(err));
}

/**
 * Leave the active channel.
 */
function leave() {
    if (voiceChannel) {
        voiceChannel.leave();
    }
}

bot.login(config.token)
    .then(() => {
        console.log('Successfully logged in CurryBot.')
    }).catch(err => console.log(err));

