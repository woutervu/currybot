const Discord = require('discord.js');
const fs = require('fs');
const bot = new Discord.Client();
const config = require("./config.json");
const md5File = require('md5-file');
const audioJson = 'audio.json';

let voiceChannel = null;
let globalConnection = null;
let dispatcherInstance = null;
let audioFileHash;
let audio;
let curryBotChannel = config.channelId;

bot.on('ready', () => {
    console.log('CurryBot initiated.');
    updateAudio();
    setInterval(updateAudio, 60000);
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
    if (!message.author.bot && getVoiceChannel() === message.member.voiceChannel) {
        playSound(message.content);
    }
}

/**
 * Play sound by trigger word (with soft matching).
 *
 * @param name
 */
function playSound(name) {
    let nameLC = name.toLowerCase();
    if (audio[nameLC]) {
        dispatchSound(audio[nameLC]);
    }
    else {
        let BreakException = {};
        let triggerKey;
        try {
            Object.keys(audio).forEach(function(k) {
                if (nameLC.includes(k)) {
                    triggerKey = k;
                    throw BreakException;
                }
            });
        } catch (e) {
            dispatchSound(audio[triggerKey]);
        }
    }
}

/**
 * Sound dispatcher that plays sound.
 *
 * @param filename
 */
function dispatchSound(filename) {
    let connection = getConnection();
    dispatcherInstance = connection.playFile(config.audio_folder + filename);
    dispatcherInstance.on("start", () => {
        // Reset pausedTime to prevent incrementing delay.
        connection.player.streamingData.pausedTime = 0;
        console.log('Playing sound: ' + filename);
    });
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
 * Set voice channel globally.
 *
 * @param message
 */
function ensureVoiceChannel(message) {
    voiceChannel = message.member.voiceChannel;
}

/**
 * Get the active voiceChannel.
 *
 * @return voiceChannel
 */
function getVoiceChannel() {
    // @todo: get the actual voice channel, CurryBot may have been moved?
    return voiceChannel;
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

/**
 * Check the md5 hash of the audio JSON and update if necessary.
 */
function updateAudio() {
    md5File(audioJson, (err, hash) => {
       if (err) console.log(err);

       if (audioFileHash !== hash) {
           console.log('JSON file changed. Updating audio.');
           parseAudioJson();
           audioFileHash = hash;
       }
    });
}

/**
 * Parse the audio JSON file.
 */
function parseAudioJson() {
    fs.readFile(audioJson, 'utf8', function (err, data) {
        if (err) throw err;
        audio = JSON.parse(data);
    });
}

bot.login(config.token)
    .then(() => {
        console.log('Successfully logged in CurryBot.')
    }).catch(err => console.log(err));

