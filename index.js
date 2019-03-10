const Discord = require('discord.js');
const fs = require('fs');
const bot = new Discord.Client();
const config = require("./config.json");
const audioJson = 'audio.json';
const statsJson = 'stats.json';

let voiceChannel = null;
let globalConnection = null;
let dispatcherInstance = null;
let audio;
let curryBotChannel = config.channelId;
let stats = [];

bot.on('ready', () => {
    console.log('CurryBot initiated.');
    parseAudioJson();
    setInterval(parseAudioJson, 10000);
});

bot.on('message', message => {
    if (message.channel.id === curryBotChannel)
    {
        let commandMatch = false;
        let contentLC = message.content.toLowerCase();
        switch (contentLC) {
            case 'cb init':
                init(message);
                commandMatch = true;
                break;
            case 'cb exit':
                leave();
                commandMatch = true;
                break;
            case 'cb reboot':
                leave();
                init(message);
                commandMatch = true;
                break;
            case 'sounds':
                availableSounds(message);
                commandMatch = true;
                break;
            case 'stats':
                printStats(message);
                commandMatch = true;
                break;
            default:
                playSoundByMessage(message);
        }

        if (commandMatch) {
            deleteMessage(message);
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
        playSound(message, message.member.id);
    }
}

/**
 * Play sound by trigger word (with soft matching).
 *
 * @param message
 * @param userId
 */
function playSound(message, userId) {
    let name = message.content;
    let nameLC = name.toLowerCase();
    let dispatched = false;
    let triggerKey;
    if (audio[nameLC]) {
        triggerKey = nameLC;
        dispatchSound(audio[triggerKey]);
        dispatched = true;
    }
    else {
        let BreakException = {};
        try {
            Object.keys(audio).forEach(function(k) {
                if (nameLC.includes(k)) {
                    triggerKey = k;
                    throw BreakException;
                }
            });
        } catch (e) {
            dispatchSound(audio[triggerKey]);
            dispatched = true;
        }
    }

    if (dispatched) {
        updateStats(triggerKey, userId);
        message.delete(5000);
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
    fs.readFile(audioJson, 'utf8', function (err, data) {
        if (err) throw err;
        let audio = JSON.parse(data);
        let sounds = "Soundboard currently contains: \n";
        Object.keys(audio).forEach(function(key) {
           sounds += key + "\n"
        });
        message.reply(sounds).then(function(reply) {
            cleanupReplies(reply, message.author.id);
        }).catch(err => console.log(err));
    });
}

/**
 * Cleanup replies that excludes the given message and matches on replies to userId.
 *
 * @param message
 * @param userId
 */
function cleanupReplies(message, userId) {
    bot.channels.get(curryBotChannel).fetchMessages().then(function(messages) {
        messages.forEach(function (msg) {
            if (msg.author.bot && msg.id !== message.id && msg.mentions.users.first()) {
                if (msg.mentions.users.first().id === userId) {
                    msg.delete().then(function() {
                        console.log(msg.id + " deleted.");
                    }).catch(err => console.log(err));
                }
            }
        })
    }).catch(err => console.log(err));
}

/**
 * Print user stats.
 *
 * @param message
 */
function printStats(message) {
    getStats().then(function(statistics) {
        let msg = "";
        let userId = message.member.id;
        // let user = getUsernameById(userId);
        let userStatsMsg = "No stats have been recorded for you yet. Get spammin'! \n";
        if (statistics.hasOwnProperty(userId)) {
            userStatsMsg = "You've been spammin', hot dayumn! \n";
            let totalPlayCount = 0;
            let userStats = statistics[userId];
            Object.keys(userStats).forEach(function(k){
                totalPlayCount += userStats[k];
                userStatsMsg += k + ": " + userStats[k] + "\n";
            });
            userStatsMsg += "Total play count: "+ totalPlayCount;
        }
        msg += userStatsMsg;
        message.reply(msg).then(function (reply) {
            cleanupReplies(reply, message.author.id);
        }).catch(err => console.log(err));
    }).catch(err => console.log(err));
}

/**
 * Stats getter that ensures file exists.
 *
 * @return {Promise<JSON>}
 */
function getStats() {
    return new Promise(function (resolve, reject) {
        try {
            if (fs.existsSync(statsJson)) {
                fs.readFile(statsJson, 'utf8', function (err, data) {
                    if (err) reject(err);
                    stats = JSON.parse(data);
                    resolve(stats);
                });
            }
            else {
                let json = {};
                fs.writeFile(statsJson, JSON.stringify(json), 'utf8', function (err) {
                    if (err) reject(err);
                    stats = json;
                    resolve(stats);
                });
            }
        } catch(err) {
            console.error(err);
        }
    });
}

/**
 * Write stats to disk.
 *
 * @param statistics
 */
function setStats(statistics) {
    fs.writeFile(statsJson, JSON.stringify(statistics), 'utf8', function (err) {
        if (err) throw err;
        console.log(err);
    });
}

/**
 * Update stats per user/trigger.
 *
 * @param key
 * @param userId
 */
function updateStats(key, userId) {
    getStats().then(function(statistics) {
        // Get current play count.
        let updates = {};
        let initialUpdate = {
            [userId]: {
                [key]: 1,
            },
        };

        if (!statistics.hasOwnProperty(userId)) {
            // No records for current user yet, apply updates.
            updates = initialUpdate;
        }
        else {
            // We have a record for userId.
            if (statistics[userId].hasOwnProperty(key)) {
                // We have a record for key, up play count.
                updates[userId] = statistics[userId];
                updates[userId][key] += 1;
            }
            else {
                // We don't have a record for key.
                updates[userId] = statistics[userId];
                updates[userId][key] = 1;
            }
        }
        statistics = {...statistics, ...updates};
        setStats(statistics);
    }).catch(err => console.log(err));
}

/**
 * Return user by ID.
 *
 * @param userId
 * @return {V}
 */
function getUsernameById(userId) {
    return bot.users.find('id', userId);
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
 * Parse the audio JSON file.
 */
function parseAudioJson() {
    fs.readFile(audioJson, 'utf8', function (err, data) {
        if (err) throw err;
        let newJson = JSON.parse(data);
        if (audio) {
            compareJson(audio, newJson);
        }
        audio = newJson;
    });
}

/**
 * Broadcast new sounds added to the soundboard.
 *
 * @param oldJson
 * @param newJson
 */
function compareJson(oldJson, newJson) {
    let newSounds;
    for(let i in newJson) {
        if(!oldJson.hasOwnProperty(i) || newJson[i] !== oldJson[i]) {
            newSounds += i + "\n"
        }
    }
    if (newSounds) {
        let msg = "New sounds added: \n" + newSounds;
        sendToChannel(msg);
    }
}

/**
 * Send message to CurryBot channel.
 * @param msg
 */
function sendToChannel(msg) {
    bot.channels.get(curryBotChannel).send(msg);
}

/**
 * Deletes a message on a timeout.
 *
 * @param message
 */
function deleteMessage(message) {
    message.delete(5000);
}

bot.login(config.token)
    .then(() => {
        console.log('Successfully logged in CurryBot.')
    }).catch(err => console.log(err));
