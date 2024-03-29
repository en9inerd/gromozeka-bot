import { readFile } from 'fs/promises';

import dotenv from 'dotenv'; // it's only for dev environment, don't use dotenv on production
dotenv.config();

const description = 'Bot deletes all of your messages from chat/channel/dialog on Telegram without admin ' +
    'privilege. Official Telegram clients don\'t support deletion for all own messages ' +
    'from chat with one click (you need to manually select messages that you want to ' +
    'delete and you can delete only 100 selected meesages per time).\n' +
    'Gromozeka bot decides this problem.';
const about = 'Bot deletes all of your messages from chat/channel/dialog on Telegram without admin privilege.';
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url))).version;

export default {
    dbConfig: {
        host: process.env.MONGO_DB_HOST || 'localhost',
        name: process.env.MONGO_INITDB_DATABASE,
        port: process.env.MONGO_DB_PORT || 27017,
        user: process.env.MONGO_DB_USERNAME,
        password: process.env.MONGO_DB_PASSWORD,
        maxPoolSize: process.env.MONGO_DB_MAX_POOL_SIZE || 10,
        collections: {
            handlers: process.env.HANDLERS_COLLECTION_NAME || 'handlers',
            userSessions: process.env.USER_SESSIONS_COLLECTION_NAME || 'userSessions',
        }
    },
    botConfig: {
        botDirInfo: process.env.TG_BOT_DIR_INFO || './botInfo',
        apiId: parseInt(process.env.TG_BOT_API_ID),
        apiHash: process.env.TG_BOT_API_HASH,
        token: process.env.TG_BOT_TOKEN,
        deviceModel: process.env.TG_BOT_DEVICE_MODEL || 'BotServer',
        appVersion: process.env.TG_BOT_APP_VERSION || version,
        systemVersion: process.env.TG_BOT_SYSTEM_VERSION || '1.0',
        connectionLangCode: process.env.TG_BOT_CONNECTION_LANG_CODE || 'en',
        systemLangCode: process.env.TG_BOT_SYSTEM_LANG_CODE || 'en',
        connectionRetries: parseInt(process.env.TG_BOT_CONNECTION_RETRIES) || 5,

        // Bot info
        profilePhotoUrl: process.env.TG_BOT_PROFILE_PHOTO_URL || null,
        name: process.env.TG_BOT_NAME || 'Gromozeka',
        about: process.env.TG_BOT_ABOUT || about,
        description: process.env.TG_BOT_DESCRIPTION || description,
        botInfoLangCode: process.env.TG_BOT_INFO_LANG_CODE || '',
    }
};

